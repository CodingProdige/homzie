import { and, desc, eq, gt, isNull, or } from "drizzle-orm";

import { db, sql as rawSql } from "@/db";
import { subscriptions, users } from "@/db/schema";
import { agencyBillingProfileIsReady } from "@/modules/agencies/billing";
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
  agencyFundedSeat: AgencyFundedSeatAccess | null;
  agencyFundedSeatBillingReady: boolean;
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

export type AgencyFundedSeatAccess = {
  agencyId: string;
  agencyName: string;
  agencySlug: string;
  agencyType: "branch" | "independent";
  billingBypassEnabled: boolean;
  billingReady: boolean;
  canManageAgencyBilling: boolean;
  controlRoomBillingHref: string;
  role: "admin" | "agent" | "listing_manager" | "owner";
};

type AgencyFundedSeatRow = {
  agency_id: string;
  agency_name: string;
  agency_slug: string;
  agency_type: "branch" | "independent";
  billing_profile_status: string | null;
  seat_billing_bypass_enabled: boolean | null;
  can_manage_billing: boolean;
  provider_customer_id: string | null;
  provider_payment_method_id: string | null;
  role: "admin" | "agent" | "listing_manager" | "owner";
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

export async function getAgencyFundedSeatAccess(
  userId: string,
): Promise<AgencyFundedSeatAccess | null> {
  const [seat] = await rawSql<AgencyFundedSeatRow[]>`
    SELECT
      a.id AS agency_id,
      a.name AS agency_name,
      a.slug AS agency_slug,
      a.agency_type,
      a.seat_billing_bypass_enabled,
      am.role,
      am.can_manage_billing,
      bp.status AS billing_profile_status,
      bp.provider_customer_id,
      bp.provider_payment_method_id
    FROM agency_members am
    INNER JOIN agencies a ON a.id = am.agency_id
    LEFT JOIN agency_billing_profiles bp ON bp.agency_id = a.id
    WHERE am.user_id = ${userId}
      AND am.status = 'active'
      AND am.agency_funded = true
      AND a.status = 'active'
      AND a.agency_type <> 'network'
    ORDER BY
      CASE am.role
        WHEN 'owner' THEN 0
        WHEN 'admin' THEN 1
        WHEN 'listing_manager' THEN 2
        ELSE 3
      END,
      am.created_at DESC
    LIMIT 1
  `;

  if (!seat) return null;

  const billingBypassEnabled = Boolean(seat.seat_billing_bypass_enabled);
  const billingReady = billingBypassEnabled || agencyBillingProfileIsReady({
    billing_email: null,
    failure_message: null,
    payment_method_label: null,
    provider_customer_id: seat.provider_customer_id,
    provider_payment_method_id: seat.provider_payment_method_id,
    status: seat.billing_profile_status || "missing",
  });

  return {
    agencyId: seat.agency_id,
    agencyName: seat.agency_name,
    agencySlug: seat.agency_slug,
    agencyType: seat.agency_type,
    billingBypassEnabled,
    billingReady,
    canManageAgencyBilling: seat.can_manage_billing,
    controlRoomBillingHref: "/controlroom/agency/settings/billing",
    role: seat.role,
  };
}

export async function hasAgentProAccess(userId: string) {
  const access = await getAgentAccess(userId);

  return access.canViewBuyerIntent;
}

export async function getAgentAccess(userId: string): Promise<AgentAccess> {
  const [subscription, agencyFundedSeat, userRows] = await Promise.all([
    getActiveAgentSubscription(userId),
    getAgencyFundedSeatAccess(userId),
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
  const hasAgencyFundedSeat = Boolean(agencyFundedSeat);
  const agencyFundedSeatBillingReady = Boolean(agencyFundedSeat?.billingReady);
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
    agencyFundedSeatBillingReady ||
    hasAdminGrantedProAccess;
  const accessSource: AgentAccessSource = isAdmin
    ? "admin"
    : agencyFundedSeatBillingReady
      ? "agency"
      : hasAdminGrantedProAccess
        ? "admin_override"
        : hasActiveSubscription
          ? "subscription"
          : "none";

  return {
    accessSource,
    agencyFundedSeat,
    agencyFundedSeatBillingReady,
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
