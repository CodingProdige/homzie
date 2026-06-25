"use server";

import { getServerSession } from "next-auth";
import { desc, eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db";
import { agentProfiles, subscriptions, users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { getAgentProfileForUser } from "@/modules/agents/queries";
import { type AgentPlanInterval } from "./plans";
import {
  hasSubscriptionPaymentMethod,
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
      publishableKey: string;
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

type FinalizeAgentSubscriptionResult =
  | {
      ok: true;
      profilePath: string;
      status: string;
      subscriptionId: string;
    }
  | { ok: false; error: string };

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
  const trialApplied = !user.agentTrialUsedAt;

  try {
    if (previousSubscription?.providerReference) {
      try {
        const existingStripeSubscription = await stripe.subscriptions.retrieve(
          previousSubscription.providerReference,
        );
        const existingSync = await syncStripeSubscription(existingStripeSubscription);

        if (
          existingSync.status === "active" &&
          (existingStripeSubscription.status !== "trialing" ||
            hasSubscriptionPaymentMethod(existingStripeSubscription))
        ) {
          return {
            ok: false,
            error:
              existingStripeSubscription.status === "trialing"
                ? "Your agent trial is already active. Open billing to review it."
                : "Your agent subscription is already active. Open billing to review it.",
          };
        }

        if (
          existingStripeSubscription.status === "trialing" &&
          !hasSubscriptionPaymentMethod(existingStripeSubscription)
        ) {
          await stripe.subscriptions.cancel(existingStripeSubscription.id).catch(() => null);
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

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        checkoutMode: "agent_subscription_setup",
        userId: user.id,
        agentProfileId: agentProfile.id,
        interval,
      },
    });

    if (!setupIntent.client_secret) {
      throw new Error("Stripe did not return a payment form secret.");
    }

      return {
        ok: true,
        clientSecret: setupIntent.client_secret,
        publishableKey,
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

export async function finalizeAgentSubscriptionCheckout(
  interval: AgentPlanInterval = "month",
  paymentMethodId?: string | null,
): Promise<FinalizeAgentSubscriptionResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      ok: false,
      error: "Sign in to start your subscription.",
    };
  }

  if (!paymentMethodId) {
    return {
      ok: false,
      error: "Confirm your card before starting your subscription.",
    };
  }

  if (!isAgentPlanInterval(interval)) {
    return {
      ok: false,
      error: "Choose a valid agent plan.",
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

  if (!user?.username) {
    return {
      ok: false,
      error: "Could not find your profile.",
    };
  }

  const missingEnv = await getMissingStripeConfigKeys();

  if (missingEnv.length > 0) {
    return {
      ok: false,
      error: `Stripe is not configured yet. Missing: ${missingEnv.join(", ")}.`,
    };
  }

  const invalidPriceEnv = await getInvalidStripePriceConfigKeys();

  if (invalidPriceEnv.length > 0) {
    return {
      ok: false,
      error: `Stripe price IDs must start with price_, not prod_. Missing: ${invalidPriceEnv.join(", ")}.`,
    };
  }

  const priceId = await getStripePriceId(interval);

  if (!priceId) {
    return {
      ok: false,
      error: `Stripe price is missing for the ${interval} plan.`,
    };
  }

  const stripe = await getStripe();
  const agentProfile = await ensureAgentProfile(user);
  const trialApplied = !user.agentTrialUsedAt;

  try {
    const [previousSubscription] = await db
      .select({
        providerCustomerId: subscriptions.providerCustomerId,
        providerReference: subscriptions.providerReference,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (previousSubscription?.providerReference) {
      const existingStripeSubscription = await stripe.subscriptions
        .retrieve(previousSubscription.providerReference)
        .catch(() => null);

      if (existingStripeSubscription) {
        const existingSync = await syncStripeSubscription(existingStripeSubscription);

        if (
          existingSync.status === "active" &&
          (existingStripeSubscription.status !== "trialing" ||
            hasSubscriptionPaymentMethod(existingStripeSubscription))
        ) {
          return {
            ok: false,
            error:
              existingStripeSubscription.status === "trialing"
                ? "Your agent trial is already active. Open billing to review it."
                : "Your agent subscription is already active. Open billing to review it.",
          };
        }

        if (
          existingStripeSubscription.status === "trialing" &&
          !hasSubscriptionPaymentMethod(existingStripeSubscription)
        ) {
          await stripe.subscriptions.cancel(existingStripeSubscription.id).catch(() => null);
        }
      }
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    let customerId =
      typeof paymentMethod.customer === "string"
        ? paymentMethod.customer
        : paymentMethod.customer?.id || null;

    if (customerId) {
      const customer = await stripe.customers.retrieve(customerId);

      if (customer.deleted) {
        return {
          ok: false,
          error: "Your Stripe customer was removed. Restart checkout and try again.",
        };
      }

      if (customer.metadata.userId && customer.metadata.userId !== user.id) {
        return {
          ok: false,
          error: "This payment method does not belong to your Homzie account.",
        };
      }
    } else {
      customerId = await getReusableStripeCustomerId({
        previousCustomerId: previousSubscription?.providerCustomerId,
        stripe,
        user,
      });
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
    }

    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    const stripeSubscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      metadata: {
        userId: user.id,
        agentProfileId: agentProfile.id,
        interval,
      },
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      ...(trialApplied ? { trial_period_days: 7 } : {}),
    });
    const synced = await syncStripeSubscription(stripeSubscription);

    return {
      ok: true,
      profilePath: `/users/${user.username}`,
      status: synced.status,
      subscriptionId: stripeSubscription.id,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not start your agent subscription.",
    };
  }
}

export async function syncAgentSubscriptionStatus(
  subscriptionId: string,
  paymentMethodId?: string | null,
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
    let subscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (subscription.metadata.userId !== session.user.id) {
      return {
        ok: false,
        error: "This subscription does not belong to your account.",
      };
    }

    if (paymentMethodId) {
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      const paymentMethodCustomer =
        typeof paymentMethod.customer === "string"
          ? paymentMethod.customer
          : paymentMethod.customer?.id || null;

      if (paymentMethodCustomer && paymentMethodCustomer !== customerId) {
        return {
          ok: false,
          error: "This payment method does not belong to your Stripe customer.",
        };
      }

      if (!paymentMethodCustomer) {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customerId,
        });
      }

      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      subscription = await stripe.subscriptions.update(subscriptionId, {
        default_payment_method: paymentMethodId,
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
      });
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
