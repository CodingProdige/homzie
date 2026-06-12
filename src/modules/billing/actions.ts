"use server";

import { getServerSession } from "next-auth";
import { desc, eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db";
import { agentProfiles, subscriptions, users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { getAgentProfileForUser } from "@/modules/agents/queries";
import {
  type AgentPlanInterval,
  agentSubscriptionPlans,
} from "./plans";
import {
  sendSubscriptionTrialStartedEmail,
  syncStripeSubscription,
} from "./subscription-sync";
import {
  getInvalidStripePriceConfigKeys,
  getMissingStripeConfigKeys,
  getStripePublishableKey,
  getStripe,
  getStripePriceId,
  isAgentPlanInterval,
} from "./stripe";

type StartAgentCheckoutResult =
  | {
      ok: true;
      clientSecret: string;
      intentType: "payment" | "setup";
      publishableKey: string;
      subscriptionId: string;
      profilePath: string;
      trialApplied: boolean;
    }
  | { ok: false; error: string; missingEnv?: string[] };

type SyncAgentSubscriptionResult =
  | {
      ok: true;
      status: string;
      profilePath: string;
    }
  | { ok: false; error: string };

function toStripeDate(seconds: number | null | undefined) {
  return seconds ? new Date(seconds * 1000) : null;
}

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const typedSubscription = subscription as typeof subscription & {
    current_period_start?: number;
    current_period_end?: number;
    trial_end?: number | null;
  };

  return {
    currentPeriodStart: toStripeDate(typedSubscription.current_period_start),
  currentPeriodEnd:
      toStripeDate(typedSubscription.current_period_end) ||
      toStripeDate(typedSubscription.trial_end),
  };
}

async function getReusableStripeCustomerId({
  stripe,
  user,
  previousCustomerId,
}: {
  previousCustomerId?: string | null;
  stripe: Stripe;
  user: { email: string; id: string; name: string; username: string | null };
}) {
  if (previousCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(previousCustomerId);

      if (!customer.deleted) {
        return customer.id;
      }
    } catch {
      // Fall through and create a fresh customer if the stored one is unavailable.
    }
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: {
      userId: user.id,
      username: user.username,
    },
  });

  return customer.id;
}

async function ensureAgentProfile(user: {
  id: string;
  location: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  locationPlaceData: unknown;
  locationPlaceId: string | null;
  locationProvince: string | null;
  locationSuburb: string | null;
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
      location: user.location,
      locationCity: user.locationCity,
      locationCountry: user.locationCountry,
      locationPlaceData: user.locationPlaceData,
      locationPlaceId: user.locationPlaceId,
      locationProvince: user.locationProvince,
      locationSuburb: user.locationSuburb,
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
      agentTrialUsedAt: users.agentTrialUsedAt,
      id: users.id,
      location: users.location,
      locationCity: users.locationCity,
      locationCountry: users.locationCountry,
      locationPlaceData: users.locationPlaceData,
      locationPlaceId: users.locationPlaceId,
      locationProvince: users.locationProvince,
      locationSuburb: users.locationSuburb,
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

  const missingEnv = await getMissingStripeConfigKeys();

  if (missingEnv.length > 0) {
    return {
      ok: false,
      error: "Stripe is not configured yet.",
      missingEnv,
    };
  }

  const invalidPriceEnv = await getInvalidStripePriceConfigKeys();

  if (invalidPriceEnv.length > 0) {
    return {
      ok: false,
      error: "Stripe price IDs must start with price_, not prod_.",
      missingEnv: invalidPriceEnv,
    };
  }

  const priceId = await getStripePriceId(interval);

  if (!priceId) {
    return {
      ok: false,
      error: `Stripe price is missing for the ${interval} plan.`,
    };
  }

  const agentProfile = await ensureAgentProfile(user);
  const stripe = await getStripe();
  const publishableKey = await getStripePublishableKey();
  const plan = agentSubscriptionPlans[interval];
  const [previousSubscription] = await db
    .select({
      id: subscriptions.id,
      providerCustomerId: subscriptions.providerCustomerId,
      providerReference: subscriptions.providerReference,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, user.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  const trialApplied = !user.agentTrialUsedAt && !previousSubscription;

  try {
    if (previousSubscription?.providerReference) {
      try {
        const existingStripeSubscription = await stripe.subscriptions.retrieve(
          previousSubscription.providerReference,
        );

        if (
          existingStripeSubscription.status === "active" ||
          existingStripeSubscription.status === "trialing"
        ) {
          await syncStripeSubscription(existingStripeSubscription);

          return {
            ok: false,
            error:
              existingStripeSubscription.status === "trialing"
                ? "Your agent trial is already active. Open billing to review it."
                : "Your agent subscription is already active. Open billing to review it.",
          };
        }
      } catch {
        // If Stripe no longer has the old subscription, continue with a new checkout.
      }
    }

    const customerId = await getReusableStripeCustomerId({
      previousCustomerId: previousSubscription?.providerCustomerId,
      stripe,
      user,
    });

    const stripeSubscription = await stripe.subscriptions.create({
      customer: customerId,
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
      ...(trialApplied ? { trial_period_days: 7 } : {}),
      expand: ["latest_invoice.confirmation_secret", "pending_setup_intent"],
    });

    const latestInvoice = stripeSubscription.latest_invoice;
    const invoiceClientSecret =
      latestInvoice && typeof latestInvoice !== "string"
        ? latestInvoice.confirmation_secret?.client_secret
        : null;
    const pendingSetupIntent = stripeSubscription.pending_setup_intent;
    const setupClientSecret =
      pendingSetupIntent && typeof pendingSetupIntent !== "string"
        ? pendingSetupIntent.client_secret
        : null;
    const clientSecret = setupClientSecret || invoiceClientSecret;

    if (!clientSecret) {
      throw new Error("Stripe did not return a payment form secret.");
    }

    const { currentPeriodStart, currentPeriodEnd } =
      getSubscriptionPeriod(stripeSubscription);

    await db.insert(subscriptions).values({
      userId: user.id,
      agentProfileId: agentProfile.id,
      provider: "stripe",
      status: "pending",
      amountCents: plan.amountCents,
      currency: plan.currency,
      interval,
      providerCustomerId: customerId,
      providerTransactionId:
        latestInvoice && typeof latestInvoice !== "string" ? latestInvoice.id : null,
      providerReference: stripeSubscription.id,
      currentPeriodStart,
      currentPeriodEnd,
    });

    if (trialApplied) {
      await db
        .update(users)
        .set({
          agentTrialUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
      await sendSubscriptionTrialStartedEmail({
        trialEndsAt:
          typeof stripeSubscription.trial_end === "number"
            ? new Date(stripeSubscription.trial_end * 1000)
            : null,
        userId: user.id,
      }).catch((error) => {
        console.error("[email] subscription trial failed", error);
      });
    }

    return {
      ok: true,
      clientSecret,
      intentType: setupClientSecret ? "setup" : "payment",
      publishableKey,
      subscriptionId: stripeSubscription.id,
      profilePath: `/users/${user.username}`,
      trialApplied,
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
    const stripe = await getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

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
