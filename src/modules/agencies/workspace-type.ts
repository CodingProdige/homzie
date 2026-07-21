import { sql } from "@/db";
import { getStripe } from "@/modules/billing/stripe";

export type WorkspaceAccountType = "independent" | "personal";

export type WorkspaceTypeEligibility = {
  agencyId: string;
  currentType: "branch" | "independent" | "network";
  reasons: string[];
  targetType: WorkspaceAccountType;
};

type ScheduledPersonalSubscriptionEnd = {
  activatesAt: Date;
  localSubscriptionId: string;
  stripeSubscriptionId: string;
};

type PersonalSubscriptionCandidate = {
  currentPeriodEnd: Date | null;
  localSubscriptionId: string;
  stripeSubscriptionId: string;
};

async function getPersonalSubscriptionCandidate(
  userId: string,
): Promise<PersonalSubscriptionCandidate | null> {
  const [subscription] = await sql<
    Array<{
      current_period_end: Date | string | null;
      id: string;
      provider_reference: string | null;
    }>
  >`
    SELECT id, provider_reference, current_period_end
    FROM subscriptions
    WHERE user_id = ${userId}
      AND provider = 'stripe'
      AND status IN ('active', 'past_due', 'pending')
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (!subscription?.provider_reference) return null;

  return {
    currentPeriodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end)
      : null,
    localSubscriptionId: subscription.id,
    stripeSubscriptionId: subscription.provider_reference,
  };
}

async function schedulePersonalSubscriptionEnd(
  userId: string,
): Promise<ScheduledPersonalSubscriptionEnd | null> {
  const localSubscription = await getPersonalSubscriptionCandidate(userId);

  if (!localSubscription) return null;

  const stripe = await getStripe();
  const stripeSubscription = await stripe.subscriptions.retrieve(
    localSubscription.stripeSubscriptionId,
  );

  if (stripeSubscription.status === "canceled") return null;

  const updated = (await stripe.subscriptions.update(stripeSubscription.id, {
    cancel_at_period_end: true,
  })) as typeof stripeSubscription & {
    cancel_at?: number | null;
    current_period_end?: number | null;
  };
  const paidThrough =
    updated.cancel_at ||
    updated.current_period_end ||
    (localSubscription.currentPeriodEnd
      ? Math.floor(localSubscription.currentPeriodEnd.getTime() / 1000)
      : 0);

  if (!paidThrough) {
    throw new Error("Stripe did not return the personal subscription end date.");
  }

  const activatesAt = new Date(paidThrough * 1000);

  await sql`
    UPDATE subscriptions
    SET cancelled_at = ${activatesAt}, updated_at = now()
    WHERE id = ${localSubscription.localSubscriptionId}
  `;

  return {
    activatesAt,
    localSubscriptionId: localSubscription.localSubscriptionId,
    stripeSubscriptionId: stripeSubscription.id,
  };
}

async function undoScheduledPersonalSubscriptionEnd(
  transition: ScheduledPersonalSubscriptionEnd | null,
) {
  if (!transition) return;

  try {
    const stripe = await getStripe();
    await stripe.subscriptions.update(transition.stripeSubscriptionId, {
      cancel_at_period_end: false,
      cancel_at: null,
    });
    await sql`
      UPDATE subscriptions
      SET cancelled_at = NULL, updated_at = now()
      WHERE id = ${transition.localSubscriptionId}
    `;
  } catch (error) {
    console.error("[agency-billing-transition] could not undo Stripe cancellation", error);
  }
}

function transitionJson(transition: ScheduledPersonalSubscriptionEnd) {
  return JSON.stringify({
    activatesAt: transition.activatesAt.toISOString(),
    localSubscriptionId: transition.localSubscriptionId,
    status: "scheduled",
    stripeSubscriptionId: transition.stripeSubscriptionId,
  });
}

function awaitingAgencyBillingJson(candidate: PersonalSubscriptionCandidate) {
  return JSON.stringify({
    currentPeriodEnd: candidate.currentPeriodEnd?.toISOString() || null,
    localSubscriptionId: candidate.localSubscriptionId,
    status: "awaiting_agency_billing",
    stripeSubscriptionId: candidate.stripeSubscriptionId,
  });
}

async function agencyBillingIsReady(agencyId: string) {
  const [row] = await sql<Array<{ ready: boolean }>>`
    SELECT (
      a.seat_billing_bypass_enabled = true
      OR (
        bp.status = 'ready'
        AND bp.provider_customer_id IS NOT NULL
        AND bp.provider_payment_method_id IS NOT NULL
      )
    ) AS ready
    FROM agencies a
    LEFT JOIN agency_billing_profiles bp ON bp.agency_id = a.id
    WHERE a.id = ${agencyId}
    LIMIT 1
  `;

  return Boolean(row?.ready);
}

type WorkspaceDependencyRow = {
  agency_type: "branch" | "independent" | "network";
  billing_configured: boolean;
  branch_count: number;
  employee_count: number;
  listing_count: number;
  other_member_count: number;
  pending_transfer_count: number;
};

export async function getWorkspaceTypeEligibility({
  agencyId,
  ownerUserId,
  targetType,
}: {
  agencyId: string;
  ownerUserId: string;
  targetType: WorkspaceAccountType;
}): Promise<WorkspaceTypeEligibility> {
  const [row] = await sql<WorkspaceDependencyRow[]>`
    SELECT
      a.agency_type,
      EXISTS (
        SELECT 1
        FROM agency_billing_profiles abp
        WHERE abp.agency_id = a.id
          AND (
            abp.status NOT IN ('missing', 'disabled')
            OR abp.provider_customer_id IS NOT NULL
            OR abp.provider_payment_method_id IS NOT NULL
          )
      ) AS billing_configured,
      (
        SELECT count(*)::int
        FROM agencies child
        WHERE child.parent_agency_id = a.id
          AND child.parent_link_status IN ('pending', 'linked')
      ) AS branch_count,
      (
        SELECT count(*)::int
        FROM agency_employees ae
        WHERE ae.agency_id = a.id
          AND ae.status <> 'removed'
      ) AS employee_count,
      (
        SELECT count(*)::int
        FROM property_listings pl
        WHERE pl.agency_id = a.id
      ) AS listing_count,
      (
        SELECT count(*)::int
        FROM agency_members am
        WHERE am.agency_id = a.id
          AND am.status <> 'removed'
          AND am.user_id IS DISTINCT FROM ${ownerUserId}
      ) AS other_member_count,
      (
        SELECT count(*)::int
        FROM agency_ownership_transfers aot
        WHERE aot.agency_id = a.id
          AND aot.status = 'pending'
          AND aot.expires_at > now()
      ) AS pending_transfer_count
    FROM agencies a
    WHERE a.id = ${agencyId}
      AND EXISTS (
        SELECT 1
        FROM agency_members owner_member
        WHERE owner_member.agency_id = a.id
          AND owner_member.user_id = ${ownerUserId}
          AND owner_member.role = 'owner'
          AND owner_member.status <> 'removed'
      )
    LIMIT 1
  `;

  if (!row) {
    throw new Error("Only the active workspace owner can change its account type.");
  }

  const reasons: string[] = [];

  if (row.agency_type === "branch") {
    reasons.push("Branch agencies must leave their parent network before changing type.");
  }

  if (targetType === "independent") {
    if (row.agency_type !== "network") {
      reasons.push("Only a Network HQ can be converted to an independent agency.");
    }

    if (row.branch_count > 0) {
      reasons.push(`Resolve ${row.branch_count} linked or pending branch ${row.branch_count === 1 ? "agency" : "agencies"} first.`);
    }
  } else {
    if (row.other_member_count > 0) {
      reasons.push(`Remove ${row.other_member_count} other agency ${row.other_member_count === 1 ? "member" : "members"} first.`);
    }

    if (row.employee_count > 0) {
      reasons.push(`Remove ${row.employee_count} agency ${row.employee_count === 1 ? "employee" : "employees"} first.`);
    }

    if (row.branch_count > 0) {
      reasons.push(`Resolve ${row.branch_count} linked or pending branch ${row.branch_count === 1 ? "agency" : "agencies"} first.`);
    }

    if (row.listing_count > 0) {
      reasons.push(`Move or archive ${row.listing_count} agency ${row.listing_count === 1 ? "listing" : "listings"} first.`);
    }

    if (row.pending_transfer_count > 0) {
      reasons.push(`Cancel ${row.pending_transfer_count} pending ownership ${row.pending_transfer_count === 1 ? "transfer" : "transfers"} first.`);
    }

    if (row.billing_configured) {
      reasons.push("Remove the agency payment method or contact support to close agency billing first.");
    }
  }

  return {
    agencyId,
    currentType: row.agency_type,
    reasons,
    targetType,
  };
}

export async function convertWorkspaceAccountType({
  agencyId,
  ownerUserId,
  targetType,
}: {
  agencyId: string;
  ownerUserId: string;
  targetType: WorkspaceAccountType;
}) {
  const eligibility = await getWorkspaceTypeEligibility({
    agencyId,
    ownerUserId,
    targetType,
  });

  if (eligibility.reasons.length > 0) {
    throw new Error(eligibility.reasons.join(" "));
  }

  const personalSubscriptionCandidate =
    targetType === "independent"
      ? await getPersonalSubscriptionCandidate(ownerUserId)
      : null;
  const billingReady =
    targetType === "independent" && personalSubscriptionCandidate
      ? await agencyBillingIsReady(agencyId)
      : false;
  const personalSubscriptionTransition =
    personalSubscriptionCandidate && billingReady
      ? await schedulePersonalSubscriptionEnd(ownerUserId)
      : null;
  const storedBillingTransition = personalSubscriptionTransition
    ? transitionJson(personalSubscriptionTransition)
    : personalSubscriptionCandidate
      ? awaitingAgencyBillingJson(personalSubscriptionCandidate)
      : null;

  try {
    await sql.begin(async (tx) => {
    const [lockedAgency] = await tx<Array<{ agency_type: string }>>`
      SELECT agency_type
      FROM agencies
      WHERE id = ${agencyId}
      FOR UPDATE
    `;

    if (!lockedAgency || lockedAgency.agency_type !== eligibility.currentType) {
      throw new Error("The workspace changed while this request was being processed. Try again.");
    }

    if (targetType === "independent") {
      await tx`
        UPDATE agencies
        SET
          agency_type = 'independent',
          billing_owner_user_id = ${ownerUserId},
          billing_mode = 'self',
          branding_policy = 'branch_branding_allowed',
          settings = CASE
            WHEN ${storedBillingTransition}::jsonb IS NULL
              THEN settings
            ELSE jsonb_set(
              coalesce(settings, '{}'::jsonb),
              '{billingTransition}',
              ${storedBillingTransition}::jsonb,
              true
            )
          END,
          updated_at = now()
        WHERE id = ${agencyId}
      `;
      await tx`
        UPDATE agency_members
        SET
          agency_funded = ${!personalSubscriptionCandidate},
          can_create_listings = true,
          can_submit_listing_requests = true,
          can_publish_listings = true,
          can_edit_agency_listings = true,
          can_view_buyer_activity = true,
          can_manage_members = true,
          can_manage_billing = true,
          updated_at = now()
        WHERE agency_id = ${agencyId}
          AND user_id = ${ownerUserId}
          AND role = 'owner'
          AND status <> 'removed'
      `;
      if (!personalSubscriptionCandidate) {
        await tx`
          INSERT INTO agency_seat_usage_events (
            agency_id, member_id, event_type, occurred_at
          )
          SELECT ${agencyId}, id, 'seat_started', now()
          FROM agency_members
          WHERE agency_id = ${agencyId}
            AND user_id = ${ownerUserId}
            AND role = 'owner'
            AND status <> 'removed'
        `;
        await tx`
          INSERT INTO agency_billing_profiles (
            agency_id, billing_cycle_anchor_at, updated_at
          )
          VALUES (${agencyId}, now(), now())
          ON CONFLICT (agency_id) DO UPDATE
          SET
            billing_cycle_anchor_at = coalesce(
              agency_billing_profiles.billing_cycle_anchor_at,
              excluded.billing_cycle_anchor_at
            ),
            updated_at = now()
        `;
      }
      await tx`
        UPDATE users
        SET profile_role = 'independent_agency_owner', updated_at = now()
        WHERE id = ${ownerUserId}
      `;
      return;
    }

    await tx`
      UPDATE agency_members
      SET
        status = 'removed',
        agency_funded = false,
        can_create_listings = false,
        can_submit_listing_requests = false,
        can_publish_listings = false,
        can_edit_agency_listings = false,
        can_view_buyer_activity = false,
        can_manage_members = false,
        can_manage_billing = false,
        updated_at = now()
      WHERE agency_id = ${agencyId}
        AND user_id = ${ownerUserId}
        AND role = 'owner'
        AND status <> 'removed'
    `;
    await tx`
      UPDATE agencies
      SET status = 'suspended', billing_owner_user_id = NULL, updated_at = now()
      WHERE id = ${agencyId}
    `;
    await tx`
      UPDATE users
      SET profile_role = 'property_agent', updated_at = now()
      WHERE id = ${ownerUserId}
        AND profile_role IN (
          'agency_owner',
          'independent_agency_owner',
          'branch_agency_owner',
          'network_hq_owner'
        )
    `;
    });
  } catch (error) {
    await undoScheduledPersonalSubscriptionEnd(personalSubscriptionTransition);
    throw error;
  }
}

export async function scheduleIndependentOwnerBillingTransition({
  agencyId,
  ownerUserId,
}: {
  agencyId: string;
  ownerUserId: string;
}) {
  const [workspace] = await sql<Array<{ id: string }>>`
    SELECT a.id
    FROM agencies a
    INNER JOIN agency_members am ON am.agency_id = a.id
    WHERE a.id = ${agencyId}
      AND a.agency_type = 'independent'
      AND a.status = 'active'
      AND am.user_id = ${ownerUserId}
      AND am.role = 'owner'
      AND am.status = 'active'
    LIMIT 1
  `;

  if (!workspace) {
    throw new Error("An active independent-agency owner was not found.");
  }

  if (!(await agencyBillingIsReady(agencyId))) {
    throw new Error("Configure agency billing before moving the personal subscription.");
  }

  const transition = await schedulePersonalSubscriptionEnd(ownerUserId);

  if (!transition) {
    throw new Error("This user does not have an active personal Stripe subscription.");
  }

  try {
    await sql.begin(async (tx) => {
      const [member] = await tx<Array<{ agency_funded: boolean; id: string }>>`
        SELECT id, agency_funded
        FROM agency_members
        WHERE agency_id = ${agencyId}
          AND user_id = ${ownerUserId}
          AND role = 'owner'
          AND status = 'active'
        FOR UPDATE
      `;

      if (!member) throw new Error("The agency owner membership changed. Try again.");

      if (member.agency_funded) {
        await tx`
          INSERT INTO agency_seat_usage_events (
            agency_id, member_id, event_type, occurred_at
          )
          VALUES (${agencyId}, ${member.id}, 'seat_ended', now())
        `;
      }

      await tx`
        UPDATE agency_members
        SET
          agency_funded = false,
          can_create_listings = true,
          can_submit_listing_requests = true,
          can_publish_listings = true,
          can_edit_agency_listings = true,
          can_view_buyer_activity = true,
          can_manage_members = true,
          can_manage_billing = true,
          updated_at = now()
        WHERE id = ${member.id}
      `;
      await tx`
        UPDATE agencies
        SET settings = jsonb_set(
          coalesce(settings, '{}'::jsonb),
          '{billingTransition}',
          ${transitionJson(transition)}::jsonb,
          true
        ), updated_at = now()
        WHERE id = ${agencyId}
      `;
    });
  } catch (error) {
    await undoScheduledPersonalSubscriptionEnd(transition);
    throw error;
  }

  return transition.activatesAt;
}

export async function scheduleAwaitingAgencyBillingTransition(agencyId: string) {
  const [awaiting] = await sql<Array<{ owner_user_id: string | null }>>`
    SELECT owner_member.user_id AS owner_user_id
    FROM agencies a
    LEFT JOIN agency_members owner_member
      ON owner_member.agency_id = a.id
      AND owner_member.role = 'owner'
      AND owner_member.status = 'active'
    WHERE a.id = ${agencyId}
      AND a.agency_type = 'independent'
      AND a.settings #>> '{billingTransition,status}' = 'awaiting_agency_billing'
    LIMIT 1
  `;

  if (!awaiting?.owner_user_id) return null;

  return scheduleIndependentOwnerBillingTransition({
    agencyId,
    ownerUserId: awaiting.owner_user_id,
  });
}

export async function processDueAgencyBillingTransitions(limit = 25) {
  const due = await sql<Array<{ agency_id: string }>>`
    SELECT id AS agency_id
    FROM agencies
    WHERE agency_type = 'independent'
      AND status = 'active'
      AND settings #>> '{billingTransition,status}' = 'scheduled'
      AND (settings #>> '{billingTransition,activatesAt}')::timestamptz <= now()
    ORDER BY (settings #>> '{billingTransition,activatesAt}')::timestamptz ASC
    LIMIT ${limit}
  `;
  const completed: string[] = [];

  for (const row of due) {
    await sql.begin(async (tx) => {
      const [agency] = await tx<Array<{ status: string | null }>>`
        SELECT settings #>> '{billingTransition,status}' AS status
        FROM agencies
        WHERE id = ${row.agency_id}
        FOR UPDATE
      `;

      if (agency?.status !== "scheduled") return;

      const [owner] = await tx<Array<{ id: string }>>`
        SELECT id
        FROM agency_members
        WHERE agency_id = ${row.agency_id}
          AND role = 'owner'
          AND status = 'active'
        ORDER BY created_at ASC
        LIMIT 1
      `;

      if (!owner) throw new Error(`Agency ${row.agency_id} has no active owner.`);

      await tx`
        UPDATE agency_members
        SET agency_funded = true, updated_at = now()
        WHERE id = ${owner.id}
      `;
      await tx`
        INSERT INTO agency_seat_usage_events (
          agency_id, member_id, event_type, occurred_at
        )
        VALUES (${row.agency_id}, ${owner.id}, 'seat_started', now())
      `;
      await tx`
        INSERT INTO agency_billing_profiles (
          agency_id, billing_cycle_anchor_at, updated_at
        )
        VALUES (${row.agency_id}, now(), now())
        ON CONFLICT (agency_id) DO UPDATE
        SET
          billing_cycle_anchor_at = coalesce(
            agency_billing_profiles.billing_cycle_anchor_at,
            excluded.billing_cycle_anchor_at
          ),
          updated_at = now()
      `;
      await tx`
        UPDATE agencies
        SET settings = jsonb_set(
          settings,
          '{billingTransition,status}',
          '"completed"'::jsonb,
          true
        ), updated_at = now()
        WHERE id = ${row.agency_id}
      `;
      completed.push(row.agency_id);
    });
  }

  return completed;
}
