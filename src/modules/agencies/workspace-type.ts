import { sql } from "@/db";

export type WorkspaceAccountType = "independent" | "personal";

export type WorkspaceTypeEligibility = {
  agencyId: string;
  currentType: "branch" | "independent" | "network";
  reasons: string[];
  targetType: WorkspaceAccountType;
};

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
          updated_at = now()
        WHERE id = ${agencyId}
      `;
      await tx`
        UPDATE agency_members
        SET
          agency_funded = true,
          can_manage_billing = true,
          updated_at = now()
        WHERE agency_id = ${agencyId}
          AND user_id = ${ownerUserId}
          AND role = 'owner'
          AND status <> 'removed'
      `;
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
}
