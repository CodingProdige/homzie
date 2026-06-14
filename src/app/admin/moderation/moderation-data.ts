import { sql } from "@/db";

export type ModerationSource =
  | "case"
  | "message_report"
  | "sale_claim"
  | "sale_dispute";

export type ModerationStatus =
  | "open"
  | "in_review"
  | "waiting_on_user"
  | "resolved"
  | "rejected"
  | "escalated"
  | "pending"
  | "approved"
  | "dismissed";

export type ModerationRow = {
  content_title: string | null;
  created_at: string;
  details: string | null;
  id: string;
  priority: string;
  reason: string | null;
  reporter_email: string | null;
  reporter_name: string | null;
  source: ModerationSource;
  status: string;
  target_name: string | null;
  target_type: string;
  type: string;
  updated_at: string;
};

export const moderationStatusOptions = [
  ["open", "Open"],
  ["in_review", "In review"],
  ["waiting_on_user", "Waiting on user"],
  ["resolved", "Resolved"],
  ["rejected", "Rejected"],
  ["escalated", "Escalated"],
] as const;

export const saleClaimStatusOptions = [
  ["pending", "Pending"],
  ["in_review", "In review"],
  ["waiting_on_user", "Waiting on user"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
] as const;

export const disputeStatusOptions = [
  ["pending", "Pending"],
  ["in_review", "In review"],
  ["waiting_on_user", "Waiting on user"],
  ["resolved", "Resolved"],
  ["dismissed", "Dismissed"],
  ["escalated", "Escalated"],
] as const;

export const moderationPriorityOptions = [
  ["low", "Low"],
  ["normal", "Normal"],
  ["high", "High"],
  ["urgent", "Urgent"],
] as const;

const moderationRowsSelect = sql`
  SELECT
    'case' AS source,
    mc.id,
    mc.case_type AS type,
    mc.target_type,
    mc.reason,
    mc.details,
    mc.status,
    mc.priority,
    reporter.name AS reporter_name,
    reporter.email AS reporter_email,
    target.name AS target_name,
    coalesce(pl.title, r.caption, target.username, target.name) AS content_title,
    mc.created_at::text,
    mc.updated_at::text
  FROM moderation_cases mc
  LEFT JOIN users reporter ON reporter.id = mc.reporter_user_id
  LEFT JOIN users target ON target.id = mc.target_user_id
  LEFT JOIN property_listings pl ON pl.id = mc.listing_id
  LEFT JOIN reels r ON r.id = mc.reel_id

  UNION ALL

  SELECT
    'message_report' AS source,
    mr.id,
    'report' AS type,
    'message' AS target_type,
    mr.reason,
    mr.details,
    mr.status,
    'normal' AS priority,
    reporter.name AS reporter_name,
    reporter.email AS reporter_email,
    reported.name AS target_name,
    'Message conversation' AS content_title,
    mr.created_at::text,
    mr.updated_at::text
  FROM message_reports mr
  LEFT JOIN users reporter ON reporter.id = mr.reporter_user_id
  LEFT JOIN users reported ON reported.id = mr.reported_user_id

  UNION ALL

  SELECT
    'sale_claim' AS source,
    psc.id,
    'sale_claim' AS type,
    'listing' AS target_type,
    psc.outcome_type AS reason,
    psc.proof_summary AS details,
    psc.claim_status AS status,
    CASE
      WHEN psc.claim_status IN ('pending', 'in_review') THEN 'high'
      ELSE 'normal'
    END AS priority,
    claimant.name AS reporter_name,
    claimant.email AS reporter_email,
    claimant.name AS target_name,
    pl.title AS content_title,
    psc.created_at::text,
    psc.updated_at::text
  FROM property_sale_claims psc
  LEFT JOIN users claimant ON claimant.id = psc.user_id
  LEFT JOIN property_listings pl ON pl.id = psc.listing_id

  UNION ALL

  SELECT
    'sale_dispute' AS source,
    psd.id,
    'dispute' AS type,
    'property' AS target_type,
    psd.reason,
    psd.reason AS details,
    psd.status,
    CASE
      WHEN psd.status IN ('pending', 'in_review', 'escalated') THEN 'high'
      ELSE 'normal'
    END AS priority,
    null AS reporter_name,
    null AS reporter_email,
    null AS target_name,
    coalesce(pi.normalized_address, pi.google_place_id, psd.property_identity_id::text) AS content_title,
    psd.created_at::text,
    psd.updated_at::text
  FROM property_sale_disputes psd
  LEFT JOIN property_identities pi ON pi.id = psd.property_identity_id
`;

export function sourceLabel(source: ModerationSource) {
  if (source === "message_report") return "Message report";
  if (source === "sale_claim") return "Sale claim";
  if (source === "sale_dispute") return "Dispute";
  return "Report";
}

export function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export function isOpenModerationStatus(row: Pick<ModerationRow, "source" | "status">) {
  if (row.source === "sale_claim") {
    return ["pending", "in_review", "waiting_on_user"].includes(row.status);
  }

  if (row.source === "sale_dispute") {
    return ["pending", "in_review", "waiting_on_user", "escalated"].includes(row.status);
  }

  return ["open", "in_review", "waiting_on_user", "escalated"].includes(row.status);
}

export async function getModerationRows() {
  return sql<ModerationRow[]>`
    SELECT *
    FROM (${moderationRowsSelect}) moderation
    ORDER BY created_at DESC
  `;
}

export async function getModerationRow(source: string, id: string) {
  if (!["case", "message_report", "sale_claim", "sale_dispute"].includes(source)) {
    return null;
  }

  const [row] = await sql<ModerationRow[]>`
    SELECT *
    FROM (${moderationRowsSelect}) moderation
    WHERE source = ${source}
      AND id = ${id}::uuid
    LIMIT 1
  `;

  return row || null;
}
