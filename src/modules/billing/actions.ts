"use server";

import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { agentProfiles, subscriptions, users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { getAgentProfileForUser } from "@/modules/agents/queries";
import { syncStripeSubscription } from "./subscription-sync";
import {
  type AgentPlanInterval,
  agentSubscriptionPlans,
  getInvalidStripePriceEnvKeys,
  getMissingStripeEnvKeys,
  getStripe,
  getStripePriceId,
  isAgentPlanInterval,
} from "./stripe";

type StartAgentCheckoutResult =
  | {
      ok: true;
      clientSecret: string;
      publishableKey: string;
      subscriptionId: string;
      profilePath: string;
    }
  | { ok: false; error: string; missingEnv?: string[] };

type SyncAgentSubscriptionResult =
  | {
      ok: true;
      status: string;
      profilePath: string;
    }
  | { ok: false; error: string };

async function ensureAgentProfile(user: {
  id: string;
  name: string;
  username: string | null;
}) {
  const existingProfile = await getAgentProfileForUser(user.id);

  if (existingProfile) {
    return existingProfile;
  }

  const [createdProfile] = await db
    .insert(agentProfiles)
    .values({
      userId: user.id,
      displayName: user.name,
      headline: "Property agent",
      status: "draft",
    })
    .returning();

  return createdProfile;
}

export async function startAgentSubscriptionCheckout(
  interval: AgentPlanInterval = "month",
): Promise<StartAgentCheckoutResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      ok: false,
      error: "Sign in to become an agent.",
    };
  }

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    return {
      ok: false,
      error: "Could not find your account.",
    };
  }

  if (!user.username) {
    return {
      ok: false,
      error: "Choose your username before becoming an agent.",
    };
  }

  if (!isAgentPlanInterval(interval)) {
    return {
      ok: false,
      error: "Choose a valid agent plan.",
    };
  }

  const missingEnv = getMissingStripeEnvKeys();

  if (missingEnv.length > 0) {
    return {
      ok: false,
      error: "Stripe is not configured yet.",
      missingEnv,
    };
  }

  const invalidPriceEnv = getInvalidStripePriceEnvKeys();

  if (invalidPriceEnv.length > 0) {
    return {
      ok: false,
      error: "Stripe price IDs must start with price_, not prod_.",
      missingEnv: invalidPriceEnv,
    };
  }

  const priceId = getStripePriceId(interval);

  if (!priceId) {
    return {
      ok: false,
      error: `Stripe price is missing for the ${interval} plan.`,
    };
  }

  const agentProfile = await ensureAgentProfile(user);
  const stripe = getStripe();
  const plan = agentSubscriptionPlans[interval];

  try {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        userId: user.id,
        username: user.username,
      },
    });

    const stripeSubscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      metadata: {
        userId: user.id,
        agentProfileId: agentProfile.id,
        interval,
      },
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.confirmation_secret"],
    });

    const latestInvoice = stripeSubscription.latest_invoice;
    const clientSecret =
      latestInvoice && typeof latestInvoice !== "string"
        ? latestInvoice.confirmation_secret?.client_secret
        : null;

    if (!clientSecret) {
      throw new Error("Stripe did not return a payment form secret.");
    }

    await db.insert(subscriptions).values({
      userId: user.id,
      agentProfileId: agentProfile.id,
      provider: "stripe",
      status: "pending",
      amountCents: plan.amountCents,
      currency: plan.currency,
      interval,
      providerCustomerId: customer.id,
      providerTransactionId:
        latestInvoice && typeof latestInvoice !== "string" ? latestInvoice.id : null,
      providerReference: stripeSubscription.id,
    });

    return {
      ok: true,
      clientSecret,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
      subscriptionId: stripeSubscription.id,
      profilePath: `/users/${user.username}`,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not start Stripe checkout.",
    };
  }
}

export async function syncAgentSubscriptionStatus(
  subscriptionId: string,
): Promise<SyncAgentSubscriptionResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      ok: false,
      error: "Sign in to sync your subscription.",
    };
  }

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.username) {
    return {
      ok: false,
      error: "Could not find your profile.",
    };
  }

  try {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);

    if (subscription.metadata.userId !== session.user.id) {
      return {
        ok: false,
        error: "This subscription does not belong to your account.",
      };
    }

    const synced = await syncStripeSubscription(subscription);

    return {
      ok: true,
      status: synced.status,
      profilePath: `/users/${user.username}`,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not sync your subscription.",
    };
  }
}
