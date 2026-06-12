import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ArrowUpRight, FileCheck2 } from "lucide-react";

import { updateAdminReservationSettlement } from "@/app/admin/actions";
import {
  getReservation,
  reservationDocumentRequirements,
  reservationReleaseStatusOptions,
  reservationStatusOptions,
} from "@/app/admin/reservations/reservation-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "Reservation Details | Homzie Admin",
  description: "Review a listing reservation and record settlement proof.",
};

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

function statusPill(value: string, tone: "primary" | "muted" = "muted") {
  return (
    <span
      className={
        tone === "primary"
          ? "rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-primary"
          : "rounded-full bg-muted px-3 py-1 text-[11px] font-black uppercase tracking-wide text-muted-foreground"
      }
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

export default async function AdminReservationDetailsPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  await connection();

  const { reservationId } = await params;

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      reservationId,
    )
  ) {
    notFound();
  }

  const reservation = await getReservation(reservationId);

  if (!reservation) notFound();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href="/admin/reservations">
          <ArrowLeft className="size-4" />
          Reservations
        </Link>
      </Button>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
            Reservation details
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            {reservation.listing_title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
            {reservation.listing_location || "Location not set"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {statusPill(reservation.status, "primary")}
            {statusPill(reservation.release_status)}
          </div>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href={`/listings/${reservation.listing_id}`} target="_blank">
            Listing
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </div>

      <section className="mt-8 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            Agency amount
          </p>
          <p className="mt-2 text-xl font-black">
            {formatMoney(reservation.amount_cents, reservation.currency)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            Homzie fee
          </p>
          <p className="mt-2 text-xl font-black">
            {formatMoney(reservation.platform_fee_cents, reservation.currency)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            Processing estimate
          </p>
          <p className="mt-2 text-xl font-black">
            {formatMoney(reservation.processing_fee_cents, reservation.currency)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            Total paid
          </p>
          <p className="mt-2 text-xl font-black">
            {formatMoney(reservation.total_paid_cents, reservation.currency)}
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="grid gap-x-5 gap-y-2 text-sm font-semibold text-muted-foreground md:grid-cols-3">
          <span>Buyer: {reservation.buyer_name}</span>
          <span>Agent: {reservation.agent_name}</span>
          <span>Paid: {formatDate(reservation.paid_at)}</span>
          <span>Buyer email: {reservation.buyer_email}</span>
          <span>Agent email: {reservation.agent_email}</span>
          <span>Created: {formatDate(reservation.created_at)}</span>
        </div>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-primary" />
            <h2 className="text-sm font-black">Required documents</h2>
          </div>
          <ul className="mt-4 grid gap-2 text-sm font-semibold leading-6 text-muted-foreground">
            {reservationDocumentRequirements.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
          <div className="mt-6 grid gap-2 text-xs font-bold text-muted-foreground">
            <span>Request sent: {formatDate(reservation.document_request_sent_at)}</span>
            <span>Documents received: {formatDate(reservation.documents_received_at)}</span>
            <span>Reviewed: {formatDate(reservation.reviewed_at)}</span>
            <span>Released: {formatDate(reservation.released_at)}</span>
            <span>Refunded: {formatDate(reservation.refunded_at)}</span>
            <span>Cancelled: {formatDate(reservation.cancelled_at)}</span>
          </div>
        </section>

        <form
          action={updateAdminReservationSettlement}
          className="rounded-lg border border-border bg-card p-5 shadow-sm"
        >
          <input type="hidden" name="reservationId" value={reservation.id} />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <Label htmlFor="status">Reservation status</Label>
              <select
                id="status"
                name="status"
                defaultValue={reservation.status}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm font-semibold"
              >
                {reservationStatusOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <Label htmlFor="releaseStatus">Release status</Label>
              <select
                id="releaseStatus"
                name="releaseStatus"
                defaultValue={reservation.release_status}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm font-semibold"
              >
                {reservationReleaseStatusOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <Label htmlFor="transferAmountRands">Transfer amount (R)</Label>
              <Input
                id="transferAmountRands"
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
              <Label htmlFor="transferReference">Transfer reference</Label>
              <Input
                id="transferReference"
                name="transferReference"
                defaultValue={reservation.transfer_reference || ""}
              />
            </label>
            <label className="grid gap-2 md:col-span-2">
              <Label htmlFor="proofOfTransferUrl">Proof of transfer URL</Label>
              <Input
                id="proofOfTransferUrl"
                name="proofOfTransferUrl"
                defaultValue={reservation.proof_of_transfer_url || ""}
                placeholder="https://..."
              />
            </label>
            <label className="grid gap-2 md:col-span-2">
              <Label htmlFor="adminNotes">Admin notes</Label>
              <textarea
                id="adminNotes"
                name="adminNotes"
                defaultValue={reservation.admin_notes || ""}
                rows={4}
                className="resize-none rounded-md border border-border bg-background px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>
            <label className="grid gap-2 md:col-span-2">
              <Label htmlFor="agentNotes">Agent / document notes</Label>
              <textarea
                id="agentNotes"
                name="agentNotes"
                defaultValue={reservation.agent_notes || ""}
                rows={4}
                className="resize-none rounded-md border border-border bg-background px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="submit">Save reservation review</Button>
            {reservation.proof_of_transfer_url ? (
              <Button asChild variant="outline">
                <Link href={reservation.proof_of_transfer_url} target="_blank">
                  View proof
                  <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </main>
  );
}
