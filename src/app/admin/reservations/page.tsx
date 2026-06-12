import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight, FileCheck2, HandCoins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sql } from "@/db";
import { updateAdminReservationSettlement } from "@/app/admin/actions";

export const metadata: Metadata = {
  title: "Reservations | Homzie Admin",
  description: "Review paid listing reservations and record settlement proof.",
};

type ReservationRow = {
  id: string;
  listing_id: string;
  listing_title: string;
  listing_location: string | null;
  buyer_name: string;
  buyer_email: string;
  agent_name: string;
  agent_email: string;
  amount_cents: number;
  platform_fee_cents: number;
  processing_fee_cents: number;
  total_paid_cents: number;
  transfer_amount_cents: number | null;
  currency: string;
  status: string;
  release_status: string;
  transfer_reference: string | null;
  proof_of_transfer_url: string | null;
  admin_notes: string | null;
  agent_notes: string | null;
  document_request_sent_at: string | null;
  documents_received_at: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

const statusOptions = [
  ["awaiting_documents", "Awaiting documents"],
  ["documents_received", "Documents received"],
  ["approved_for_release", "Approved for release"],
  ["released", "Released"],
  ["refund_required", "Refund required"],
  ["refunded", "Refunded"],
  ["cancelled", "Cancelled"],
  ["needs_review", "Needs review"],
];

const releaseStatusOptions = [
  ["held", "Held"],
  ["approved", "Approved"],
  ["released", "Released"],
  ["refund_required", "Refund required"],
  ["refunded", "Refunded"],
  ["cancelled", "Cancelled"],
];

const documentRequirements = [
  "Signed mandate or authority to market this property.",
  "Agency registration document or proof of trading entity.",
  "Agency bank confirmation letter.",
  "Written approval from the agency principal, director, or authorized manager.",
  "Instruction or invoice confirming the agency may receive the reservation funds.",
];

function formatMoney(cents: number | null, currency = "ZAR") {
  if (cents === null) return "Not set";

  return new Intl.NumberFormat("en-ZA", {
    currency,
    style: "currency",
  }).format(cents / 100);
}

function formatDate(value: string | null) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function getReservations() {
  return sql<ReservationRow[]>`
    SELECT
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
    FROM listing_reservations lr
    INNER JOIN property_listings pl ON pl.id = lr.listing_id
    INNER JOIN users buyer ON buyer.id = lr.buyer_user_id
    INNER JOIN users agent ON agent.id = lr.agent_user_id
    ORDER BY lr.created_at DESC
    LIMIT 100
  `;
}

function ReservationCard({ reservation }: { reservation: ReservationRow }) {
  return (
    <article className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-primary">
              {reservation.status.replace(/_/g, " ")}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-black uppercase tracking-wide text-muted-foreground">
              {reservation.release_status.replace(/_/g, " ")}
            </span>
          </div>
          <h2 className="mt-3 text-xl font-black">{reservation.listing_title}</h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {reservation.listing_location || "Location not set"}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-muted-foreground">
            <span>Buyer: {reservation.buyer_name}</span>
            <span>Agent: {reservation.agent_name}</span>
            <span>Paid: {formatDate(reservation.paid_at)}</span>
          </div>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href={`/listings/${reservation.listing_id}`} target="_blank">
            Listing
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            Agency amount
          </p>
          <p className="mt-1 text-lg font-black">
            {formatMoney(reservation.amount_cents, reservation.currency)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            Homzie fee
          </p>
          <p className="mt-1 text-lg font-black">
            {formatMoney(reservation.platform_fee_cents, reservation.currency)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            Processing estimate
          </p>
          <p className="mt-1 text-lg font-black">
            {formatMoney(reservation.processing_fee_cents, reservation.currency)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            Total paid
          </p>
          <p className="mt-1 text-lg font-black">
            {formatMoney(reservation.total_paid_cents, reservation.currency)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-primary" />
            <h3 className="text-sm font-black">Required documents</h3>
          </div>
          <ul className="mt-3 grid gap-2 text-sm font-semibold leading-6 text-muted-foreground">
            {documentRequirements.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
          <div className="mt-4 grid gap-2 text-xs font-bold text-muted-foreground">
            <span>Request sent: {formatDate(reservation.document_request_sent_at)}</span>
            <span>Documents received: {formatDate(reservation.documents_received_at)}</span>
            <span>Released: {formatDate(reservation.released_at)}</span>
            <span>Refunded: {formatDate(reservation.refunded_at)}</span>
            <span>Cancelled: {formatDate(reservation.cancelled_at)}</span>
          </div>
        </section>

        <form action={updateAdminReservationSettlement} className="rounded-lg border border-border bg-background p-4">
          <input type="hidden" name="reservationId" value={reservation.id} />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <Label htmlFor={`status-${reservation.id}`}>Reservation status</Label>
              <select
                id={`status-${reservation.id}`}
                name="status"
                defaultValue={reservation.status}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm font-semibold"
              >
                {statusOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <Label htmlFor={`release-${reservation.id}`}>Release status</Label>
              <select
                id={`release-${reservation.id}`}
                name="releaseStatus"
                defaultValue={reservation.release_status}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm font-semibold"
              >
                {releaseStatusOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <Label htmlFor={`amount-${reservation.id}`}>Transfer amount (R)</Label>
              <Input
                id={`amount-${reservation.id}`}
                name="transferAmountRands"
                type="number"
                min="0"
                step="0.01"
                defaultValue={
                  reservation.transfer_amount_cents === null
                    ? String(reservation.amount_cents / 100)
                    : String(reservation.transfer_amount_cents / 100)
                }
              />
            </label>
            <label className="grid gap-2">
              <Label htmlFor={`reference-${reservation.id}`}>Transfer reference</Label>
              <Input
                id={`reference-${reservation.id}`}
                name="transferReference"
                defaultValue={reservation.transfer_reference || ""}
              />
            </label>
            <label className="grid gap-2 md:col-span-2">
              <Label htmlFor={`proof-${reservation.id}`}>Proof of transfer URL</Label>
              <Input
                id={`proof-${reservation.id}`}
                name="proofOfTransferUrl"
                defaultValue={reservation.proof_of_transfer_url || ""}
                placeholder="https://..."
              />
            </label>
            <label className="grid gap-2 md:col-span-2">
              <Label htmlFor={`admin-notes-${reservation.id}`}>Admin notes</Label>
              <textarea
                id={`admin-notes-${reservation.id}`}
                name="adminNotes"
                defaultValue={reservation.admin_notes || ""}
                rows={3}
                className="resize-none rounded-md border border-border bg-background px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>
            <label className="grid gap-2 md:col-span-2">
              <Label htmlFor={`agent-notes-${reservation.id}`}>Agent / document notes</Label>
              <textarea
                id={`agent-notes-${reservation.id}`}
                name="agentNotes"
                defaultValue={reservation.agent_notes || ""}
                rows={3}
                className="resize-none rounded-md border border-border bg-background px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>
          </div>
          {reservation.proof_of_transfer_url ? (
            <Button asChild variant="outline" className="mt-4">
              <Link href={reservation.proof_of_transfer_url} target="_blank">
                View proof
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          ) : null}
          <Button type="submit" className="mt-4 w-full sm:w-auto">
            Save reservation review
          </Button>
        </form>
      </div>
    </article>
  );
}

export default async function AdminReservationsPage() {
  await connection();

  const reservations = await getReservations();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
          Admin
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          Reservations
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
          Review paid reservation deposits, track agency documents, and record
          off-app transfer proof.
        </p>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <HandCoins className="size-5" />
          </span>
          <div>
            <h2 className="text-sm font-black">Settlement rule</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
              Funds must only be transferred to a verified agency or business
              account after mandate, agency, bank, and authority documents have
              been reviewed. Record the transfer proof here after handling the
              transaction off-app.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-5">
        {reservations.length ? (
          reservations.map((reservation) => (
            <ReservationCard key={reservation.id} reservation={reservation} />
          ))
        ) : (
          <div className="rounded-lg border border-border bg-card p-8 text-sm font-semibold text-muted-foreground">
            No reservations yet.
          </div>
        )}
      </div>
    </main>
  );
}
