import { eq } from "drizzle-orm";
import Stripe from "stripe";

import { db } from "@/db";
import { agentProfiles, subscriptions } from "@/db/schema";
import { toAppSubscriptionStatus } from "./stripe";

function toDate(seconds: number | null | undefined) {
  return seconds ? new Date(seconds * 1000) : null;
}

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const typedSubscription = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };

  return {
    currentPeriodStart: toDate(typedSubscription.current_period_start),
    currentPeriodEnd: toDate(typedSubscription.current_period_end),
  };
}

export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  const agentProfileId = subscription.metadata.agentProfileId || null;
  const interval = subscription.metadata.interval || "month";
  const status = toAppSubscriptionStatus(subscription.status);
  const { currentPeriodStart, currentPeriodEnd } =
    getSubscriptionPeriod(subscription);

  const firstItem = subscription.items.data[0];
  const amountCents = firstItem?.price.unit_amount || 0;
  const currency = (firstItem?.price.currency || "zar").toUpperCase();
  const customer =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  if (!userId) {
    return { status, currentPeriodEnd };
  }

  const [existing] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.providerReference, subscription.id))
    .limit(1);

  if (existing) {
    await db
      .update(subscriptions)
      .set({
        status,
        amountCents,
        currency,
        interval,
        providerCustomerId: customer,
        currentPeriodStart,
        currentPeriodEnd,
        cancelledAt: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({
      userId,
      agentProfileId,
      provider: "stripe",
      status,
      amountCents,
      currency,
      interval,
      providerCustomerId: customer,
      providerReference: subscription.id,
      currentPeriodStart,
      currentPeriodEnd,
      cancelledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
    });
  }

  if (agentProfileId) {
    await db
      .update(agentProfiles)
      .set({
        status: status === "active" ? "active" : "draft",
        updatedAt: new Date(),
      })
      .where(eq(agentProfiles.id, agentProfileId));
  }

  return { status, currentPeriodEnd };
}
