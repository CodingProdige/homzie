import { and, desc, eq, gt, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { agencyMembers, subscriptions, users } from "@/db/schema";
import { getStripe } from "@/modules/billing/stripe";
import { syncStripeSubscription } from "@/modules/billing/subscription-sync";

export type AgentAccessSource =
  | "admin"
  | "admin_override"
  | "agency"
  | "subscription"
  | "none";

export type AgentAccess = {
  accessSource: AgentAccessSource;
  canCreateListings: boolean;
  canCreateReels: boolean;
  canViewAiBuyerInsights: boolean;
  canViewBuyerIntent: boolean;
  canViewListingPerformance: boolean;
  hasActiveSubscription: boolean;
  hasAdminGrantedProAccess: boolean;
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

export async function hasAdminGrantedProAccess(userId: string) {
  const now = new Date();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.status, "active"),
        eq(users.proAccessOverrideEnabled, true),
        or(
          isNull(users.proAccessOverrideExpiresAt),
          gt(users.proAccessOverrideExpiresAt, now),
        ),
      ),
    )
    .limit(1);

  return Boolean(user);
}

export async function hasAgentProAccess(userId: string) {
  const access = await getAgentAccess(userId);

  return access.canViewBuyerIntent;
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
      .select({
        proAccessOverrideEnabled: users.proAccessOverrideEnabled,
        proAccessOverrideExpiresAt: users.proAccessOverrideExpiresAt,
        role: users.role,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ]);

  const now = new Date();
  const user = userRows[0];
  const hasActiveSubscription = Boolean(subscription);
  const hasAgencyFundedSeat = fundedSeatRows.length > 0;
  const hasAdminGrantedProAccess = Boolean(
    user?.status === "active" &&
      user.proAccessOverrideEnabled &&
      (!user.proAccessOverrideExpiresAt ||
        user.proAccessOverrideExpiresAt > now),
  );
  const isAdmin = user?.role === "admin";
  const canViewBuyerIntent =
    isAdmin ||
    hasActiveSubscription ||
    hasAgencyFundedSeat ||
    hasAdminGrantedProAccess;
  const accessSource: AgentAccessSource = isAdmin
    ? "admin"
    : hasAgencyFundedSeat
      ? "agency"
      : hasAdminGrantedProAccess
        ? "admin_override"
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
    hasAdminGrantedProAccess,
    hasAgencyFundedSeat,
    isAdmin,
  };
}

export async function hasBuyerIntentAccess(userId: string) {
  const access = await getAgentAccess(userId);

  return access.canViewBuyerIntent;
}
