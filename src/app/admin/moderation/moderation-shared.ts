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

export function sourceLabel(source: ModerationSource) {
  if (source === "message_report") return "Message report";
  if (source === "sale_claim") return "Sale claim";
  if (source === "sale_dispute") return "Dispute";
  return "Report";
}

export function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export function isOpenModerationStatus(
  row: Pick<ModerationRow, "source" | "status">,
) {
  if (row.source === "sale_claim") {
    return ["pending", "in_review", "waiting_on_user"].includes(row.status);
  }

  if (row.source === "sale_dispute") {
    return ["pending", "in_review", "waiting_on_user", "escalated"].includes(
      row.status,
    );
  }

  return ["open", "in_review", "waiting_on_user", "escalated"].includes(
    row.status,
  );
}
