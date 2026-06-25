import { and, desc, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { agencyMembers, subscriptions, users } from "@/db/schema";
import { getStripe } from "@/modules/billing/stripe";
import { syncStripeSubscription } from "@/modules/billing/subscription-sync";

export type AgentAccessSource = "admin" | "agency" | "subscription" | "none";

export type AgentAccess = {
  accessSource: AgentAccessSource;
  canCreateListings: boolean;
  canCreateReels: boolean;
  canViewAiBuyerInsights: boolean;
  canViewBuyerIntent: boolean;
  canViewListingPerformance: boolean;
  hasActiveSubscription: boolean;
  hasAgencyFundedSeat: boolean;
  isAdmin: boolean;
};

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
    console.error("[access] failed to refresh agent subscription access", error);
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

export async function getAgentAccess(userId: string): Promise<AgentAccess> {
  const [subscription, fundedSeatRows, userRows] = await Promise.all([
    getActiveAgentSubscription(userId),
    db
      .select({ id: agencyMembers.id })
      .from(agencyMembers)
      .where(
        and(
          eq(agencyMembers.userId, userId),
          eq(agencyMembers.status, "active"),
          eq(agencyMembers.agencyFunded, true),
          eq(agencyMembers.canViewBuyerActivity, true),
        ),
      )
      .limit(1),
    db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ]);

  const hasActiveSubscription = Boolean(subscription);
  const hasAgencyFundedSeat = fundedSeatRows.length > 0;
  const isAdmin = userRows[0]?.role === "admin";
  const canViewBuyerIntent = isAdmin || hasActiveSubscription || hasAgencyFundedSeat;
  const accessSource: AgentAccessSource = isAdmin
    ? "admin"
    : hasAgencyFundedSeat
      ? "agency"
      : hasActiveSubscription
        ? "subscription"
        : "none";

  return {
    accessSource,
    canCreateListings: true,
    canCreateReels: true,
    canViewAiBuyerInsights: canViewBuyerIntent,
    canViewBuyerIntent,
    canViewListingPerformance: canViewBuyerIntent,
    hasActiveSubscription,
    hasAgencyFundedSeat,
    isAdmin,
  };
}

export async function hasBuyerIntentAccess(userId: string) {
  const access = await getAgentAccess(userId);

  return access.canViewBuyerIntent;
}
