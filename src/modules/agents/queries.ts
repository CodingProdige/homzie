import { and, desc, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { agentProfiles, subscriptions } from "@/db/schema";
import { getStripe } from "@/modules/billing/stripe";
import { syncStripeSubscription } from "@/modules/billing/subscription-sync";

export async function getAgentProfileForUser(userId: string) {
  const [profile] = await db
    .select()
    .from(agentProfiles)
    .where(eq(agentProfiles.userId, userId))
    .limit(1);

  return profile || null;
}

export async function getActiveAgentSubscription(userId: string) {
  const now = new Date();
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.provider, "stripe"),
        eq(subscriptions.status, "active"),
        gt(subscriptions.currentPeriodEnd, now),
      ),
    )
    .orderBy(desc(subscriptions.currentPeriodEnd))
    .limit(1);

  if (subscription) {
    return subscription;
  }

  const [latestSubscription] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.provider, "stripe"),
      ),
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!latestSubscription?.providerReference) {
    return null;
  }

  if (
    latestSubscription.status === "cancelled" ||
    latestSubscription.status === "expired"
  ) {
    return null;
  }

  try {
    const stripe = await getStripe();
    const stripeSubscription = await stripe.subscriptions.retrieve(
      latestSubscription.providerReference,
    );

    await syncStripeSubscription(stripeSubscription);
  } catch (error) {
    console.error("[billing] failed to refresh agent subscription access", error);
    return null;
  }

  const [refreshedSubscription] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.provider, "stripe"),
        eq(subscriptions.status, "active"),
        gt(subscriptions.currentPeriodEnd, now),
      ),
    )
    .orderBy(desc(subscriptions.currentPeriodEnd))
    .limit(1);

  return refreshedSubscription || null;
}

export async function hasActiveAgentSubscription(userId: string) {
  return Boolean(await getActiveAgentSubscription(userId));
}
