import type { Metadata } from "next";
import { connection } from "next/server";
import { ArrowUpRight, HandCoins } from "lucide-react";

import {
  CanonicalTable,
  type CanonicalTableColumn,
} from "@/components/ui/canonical-table";
import {
  getReservations,
  type ReservationRow,
} from "@/app/admin/reservations/reservation-data";

export const metadata: Metadata = {
  title: "Reservations | Homzie Admin",
  description: "Review paid listing reservations and settlement status.",
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
          ? "inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-primary"
          : "inline-flex rounded-full bg-muted px-3 py-1 text-[11px] font-black uppercase tracking-wide text-muted-foreground"
      }
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

const reservationColumns: Array<CanonicalTableColumn<ReservationRow>> = [
  {
    header: "Reservation",
    key: "reservation",
    render: (reservation) => (
      <div className="min-w-0">
        <p className="font-black text-foreground group-hover/row:text-primary">
          {reservation.listing_title}
        </p>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          {reservation.listing_location || "Location not set"}
        </p>
      </div>
    ),
  },
  {
    header: "Buyer",
    key: "buyer",
    render: (reservation) => (
      <div>
        <p className="font-bold">{reservation.buyer_name}</p>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          {reservation.buyer_email}
        </p>
      </div>
    ),
  },
  {
    header: "Agent",
    key: "agent",
    render: (reservation) => (
      <div>
        <p className="font-bold">{reservation.agent_name}</p>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          {reservation.agent_email}
        </p>
      </div>
    ),
  },
  {
    header: "Status",
    key: "status",
    render: (reservation) => (
      <div className="flex flex-wrap gap-2">
        {statusPill(reservation.status, "primary")}
        {statusPill(reservation.release_status)}
      </div>
    ),
  },
  {
    className: "text-right",
    header: "Total paid",
    key: "total",
    render: (reservation) => (
      <span className="font-black">
        {formatMoney(reservation.total_paid_cents, reservation.currency)}
      </span>
    ),
  },
  {
    header: "Paid",
    key: "paid",
    render: (reservation) => (
      <span className="text-xs font-bold text-muted-foreground">
        {formatDate(reservation.paid_at || reservation.created_at)}
      </span>
    ),
  },
  {
    className: "text-right",
    header: "",
    key: "open",
    render: () => (
      <span className="inline-flex items-center gap-1 text-xs font-black text-primary">
        Open
        <ArrowUpRight className="size-3.5" />
      </span>
    ),
  },
];

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
          Review reservation payments, settlement status, and agency document
          progress.
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
              been reviewed. Open a reservation to record review notes and
              transfer proof.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-black">All reservations</h2>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
            {reservations.length} total
          </p>
        </div>
        <CanonicalTable
          columns={reservationColumns}
          emptyState="No reservations yet."
          getRowHref={(reservation) => `/admin/reservations/${reservation.id}`}
          getRowKey={(reservation) => reservation.id}
          minWidth="1040px"
          rows={reservations}
        />
      </section>
    </main>
  );
}
