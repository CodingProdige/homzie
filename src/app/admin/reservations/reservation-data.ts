import { sql } from "@/db";

export type ReservationRow = {
  admin_notes: string | null;
  agent_email: string;
  agent_name: string;
  agent_notes: string | null;
  amount_cents: number;
  buyer_email: string;
  buyer_name: string;
  cancelled_at: string | null;
  created_at: string;
  currency: string;
  document_request_sent_at: string | null;
  documents_received_at: string | null;
  id: string;
  listing_id: string;
  listing_location: string | null;
  listing_title: string;
  paid_at: string | null;
  platform_fee_cents: number;
  processing_fee_cents: number;
  proof_of_transfer_url: string | null;
  refunded_at: string | null;
  release_status: string;
  released_at: string | null;
  reviewed_at: string | null;
  status: string;
  total_paid_cents: number;
  transfer_amount_cents: number | null;
  transfer_reference: string | null;
};

export const reservationStatusOptions = [
  ["awaiting_documents", "Awaiting documents"],
  ["documents_received", "Documents received"],
  ["approved_for_release", "Approved for release"],
  ["released", "Released"],
  ["refund_required", "Refund required"],
  ["refunded", "Refunded"],
  ["cancelled", "Cancelled"],
  ["needs_review", "Needs review"],
] as const;

export const reservationReleaseStatusOptions = [
  ["held", "Held"],
  ["approved", "Approved"],
  ["released", "Released"],
  ["refund_required", "Refund required"],
  ["refunded", "Refunded"],
  ["cancelled", "Cancelled"],
] as const;

export const reservationDocumentRequirements = [
  "Signed mandate or authority to market this property.",
  "Agency registration document or proof of trading entity.",
  "Agency bank confirmation letter.",
  "Written approval from the agency principal, director, or authorized manager.",
  "Instruction or invoice confirming the agency may receive the reservation funds.",
];

const reservationSelect = sql`
  lr.id::text,
  lr.listing_id::text,
  pl.title AS listing_title,
  pl.location AS listing_location,
  buyer.name AS buyer_name,
  buyer.email AS buyer_email,
  agent.name AS agent_name,
  agent.email AS agent_email,
  lr.amount_cents,
  lr.platform_fee_cents,
  lr.processing_fee_cents,
  lr.total_paid_cents,
  lr.transfer_amount_cents,
  lr.currency,
  lr.status,
  lr.release_status,
  lr.transfer_reference,
  lr.proof_of_transfer_url,
  lr.admin_notes,
  lr.agent_notes,
  lr.document_request_sent_at::text,
  lr.documents_received_at::text,
  lr.reviewed_at::text,
  lr.paid_at::text,
  lr.released_at::text,
  lr.refunded_at::text,
  lr.cancelled_at::text,
  lr.created_at::text
`;

export async function getReservations() {
  return sql<ReservationRow[]>`
    SELECT ${reservationSelect}
    FROM listing_reservations lr
    INNER JOIN property_listings pl ON pl.id = lr.listing_id
    INNER JOIN users buyer ON buyer.id = lr.buyer_user_id
    INNER JOIN users agent ON agent.id = lr.agent_user_id
    ORDER BY lr.created_at DESC
    LIMIT 100
  `;
}

export async function getReservation(reservationId: string) {
  const [reservation] = await sql<ReservationRow[]>`
    SELECT ${reservationSelect}
    FROM listing_reservations lr
    INNER JOIN property_listings pl ON pl.id = lr.listing_id
    INNER JOIN users buyer ON buyer.id = lr.buyer_user_id
    INNER JOIN users agent ON agent.id = lr.agent_user_id
    WHERE lr.id = ${reservationId}::uuid
    LIMIT 1
  `;

  return reservation || null;
}
