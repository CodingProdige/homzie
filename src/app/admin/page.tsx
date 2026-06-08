import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Building2,
  CircleDollarSign,
  Clapperboard,
  Flag,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { sql } from "@/db";

export const metadata: Metadata = {
  title: "Admin Dashboard | Homzie",
  description: "Homzie admin operations dashboard.",
};

type AdminMetricRow = {
  total_users: number | string | null;
  active_users: number | string | null;
  disabled_users: number | string | null;
  admin_users: number | string | null;
  active_agents: number | string | null;
  active_subscriptions: number | string | null;
  published_listings: number | string | null;
  draft_listings: number | string | null;
  sold_listings: number | string | null;
  rental_listings: number | string | null;
  published_reels: number | string | null;
  pending_offers: number | string | null;
  open_reports: number | string | null;
  pending_sale_claims: number | string | null;
  pending_disputes: number | string | null;
  conversations: number | string | null;
  messages: number | string | null;
  listing_views_24h: number | string | null;
  reel_events_24h: number | string | null;
};

type RecentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
};

type RecentListing = {
  id: string;
  title: string;
  status: string;
  listing_type: string;
  location: string | null;
  agent_name: string;
  created_at: string;
};

type RecentOffer = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  listing_title: string;
  buyer_name: string;
  agent_name: string;
  created_at: string;
};

function numberFrom(value: number | string | null | undefined) {
  return Number(value || 0);
}

function formatNumber(value: number | string | null | undefined) {
  return numberFrom(value).toLocaleString("en-ZA");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

async function getDashboardData() {
  const [metrics] = await sql<AdminMetricRow[]>`
    SELECT
      (SELECT count(*) FROM users) AS total_users,
      (SELECT count(*) FROM users WHERE status = 'active') AS active_users,
      (SELECT count(*) FROM users WHERE status = 'disabled') AS disabled_users,
      (SELECT count(*) FROM users WHERE role = 'admin') AS admin_users,
      (
        SELECT count(*)
        FROM agent_profiles ap
        INNER JOIN users u ON u.id = ap.user_id
        WHERE ap.status = 'active' AND u.status = 'active'
      ) AS active_agents,
      (SELECT count(*) FROM subscriptions WHERE status = 'active') AS active_subscriptions,
      (SELECT count(*) FROM property_listings WHERE status = 'published') AS published_listings,
      (SELECT count(*) FROM property_listings WHERE status = 'draft') AS draft_listings,
      (SELECT count(*) FROM property_listings WHERE status = 'sold') AS sold_listings,
      (SELECT count(*) FROM property_listings WHERE listing_type = 'rental') AS rental_listings,
      (SELECT count(*) FROM reels WHERE status = 'published') AS published_reels,
      (SELECT count(*) FROM property_offers WHERE status = 'pending') AS pending_offers,
      (SELECT count(*) FROM message_reports WHERE status = 'open') AS open_reports,
      (SELECT count(*) FROM property_sale_claims WHERE claim_status = 'pending') AS pending_sale_claims,
      (SELECT count(*) FROM property_sale_disputes WHERE status = 'pending') AS pending_disputes,
      (SELECT count(*) FROM conversations) AS conversations,
      (SELECT count(*) FROM messages WHERE deleted_at IS NULL) AS messages,
      (
        SELECT count(*)
        FROM listing_view_events
        WHERE created_at >= now() - interval '24 hours'
      ) AS listing_views_24h,
      (
        SELECT count(*)
        FROM reel_watch_events
        WHERE created_at >= now() - interval '24 hours'
      ) AS reel_events_24h
  `;

  const recentUsers = await sql<RecentUser[]>`
    SELECT id, name, email, role, status, created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT 6
  `;

  const recentListings = await sql<RecentListing[]>`
    SELECT
      pl.id,
      pl.title,
      pl.status,
      pl.listing_type,
      pl.location,
      u.name AS agent_name,
      pl.created_at
    FROM property_listings pl
    INNER JOIN users u ON u.id = pl.user_id
    ORDER BY pl.created_at DESC
    LIMIT 6
  `;

  const recentOffers = await sql<RecentOffer[]>`
    SELECT
      po.id,
      po.amount_cents,
      po.currency,
      po.status,
      pl.title AS listing_title,
      buyer.name AS buyer_name,
      agent.name AS agent_name,
      po.created_at
    FROM property_offers po
    INNER JOIN property_listings pl ON pl.id = po.listing_id
    INNER JOIN users buyer ON buyer.id = po.buyer_user_id
    INNER JOIN users agent ON agent.id = po.agent_user_id
    ORDER BY po.created_at DESC
    LIMIT 6
  `;

  return {
    metrics,
    recentListings,
    recentOffers,
    recentUsers,
  };
}

function MetricCard({
  detail,
  icon: Icon,
  label,
  tone = "default",
  value,
}: {
  detail: string;
  icon: typeof BarChart3;
  label: string;
  tone?: "default" | "warning";
  value: React.ReactNode;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
        </div>
        <span
          className={
            tone === "warning"
              ? "grid size-11 place-items-center rounded-full bg-amber-500/12 text-amber-700 dark:text-amber-300"
              : "grid size-11 place-items-center rounded-full bg-primary/10 text-primary"
          }
        >
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-muted-foreground">
        {detail}
      </p>
    </article>
  );
}

function DataPanel({
  children,
  id,
  title,
}: {
  children: React.ReactNode;
  id?: string;
  title: string;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 rounded-lg border border-border bg-card shadow-sm"
    >
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-black">{title}</h2>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="px-5 py-8 text-sm font-semibold text-muted-foreground">
      {label}
    </div>
  );
}

export default async function AdminPage() {
  const { metrics, recentListings, recentOffers, recentUsers } =
    await getDashboardData();

  const moderationQueue =
    numberFrom(metrics?.open_reports) +
    numberFrom(metrics?.pending_sale_claims) +
    numberFrom(metrics?.pending_disputes);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
              Admin
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Dashboard
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
              Platform health, moderation signals, and recent account activity
              for Homzie operations.
            </p>
          </div>
        </div>

        <section className="mt-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            detail={`${formatNumber(metrics?.active_users)} active, ${formatNumber(metrics?.disabled_users)} disabled, ${formatNumber(metrics?.admin_users)} admins.`}
            icon={UsersRound}
            label="Users"
            value={formatNumber(metrics?.total_users)}
          />
          <MetricCard
            detail={`${formatNumber(metrics?.published_listings)} published, ${formatNumber(metrics?.draft_listings)} drafts, ${formatNumber(metrics?.sold_listings)} sold.`}
            icon={Building2}
            label="Listings"
            value={formatNumber(
              numberFrom(metrics?.published_listings) +
                numberFrom(metrics?.draft_listings) +
                numberFrom(metrics?.sold_listings),
            )}
          />
          <MetricCard
            detail={`${formatNumber(metrics?.active_agents)} active agents and ${formatNumber(metrics?.active_subscriptions)} active subscriptions.`}
            icon={BadgeCheck}
            label="Agent network"
            value={formatNumber(metrics?.active_agents)}
          />
          <MetricCard
            detail={`${formatNumber(metrics?.open_reports)} reports, ${formatNumber(metrics?.pending_sale_claims)} sale claims, ${formatNumber(metrics?.pending_disputes)} disputes.`}
            icon={AlertTriangle}
            label="Moderation"
            tone={moderationQueue > 0 ? "warning" : "default"}
            value={formatNumber(moderationQueue)}
          />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            detail="Published property reels available for discovery."
            icon={Clapperboard}
            label="Reels"
            value={formatNumber(metrics?.published_reels)}
          />
          <MetricCard
            detail="Pending offers that still need an agent response."
            icon={CircleDollarSign}
            label="Pending offers"
            tone={numberFrom(metrics?.pending_offers) > 0 ? "warning" : "default"}
            value={formatNumber(metrics?.pending_offers)}
          />
          <MetricCard
            detail={`${formatNumber(metrics?.listing_views_24h)} listing views in the last 24 hours.`}
            icon={BarChart3}
            label="24h views"
            value={formatNumber(metrics?.listing_views_24h)}
          />
          <MetricCard
            detail={`${formatNumber(metrics?.reel_events_24h)} reel watch events in the last 24 hours.`}
            icon={Flag}
            label="24h reel activity"
            value={formatNumber(metrics?.reel_events_24h)}
          />
          </div>
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-3">
          <DataPanel title="Recent Users">
            {recentUsers.length ? (
              recentUsers.map((user) => (
                <div key={user.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{user.name}</p>
                      <p className="truncate text-xs font-semibold text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-black uppercase text-primary">
                      {user.role}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">
                    {user.status} · {formatDateTime(user.created_at)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyRow label="No users yet." />
            )}
          </DataPanel>

          <DataPanel title="Recent Listings">
            {recentListings.length ? (
              recentListings.map((listing) => (
                <div key={listing.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/listings/${listing.id}`}
                        className="line-clamp-2 text-sm font-black transition hover:text-primary"
                      >
                        {listing.title}
                      </Link>
                      <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
                        {listing.agent_name} · {listing.location || "No location"}
                      </p>
                    </div>
                    <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-black uppercase text-secondary-foreground">
                      {listing.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">
                    {listing.listing_type} · {formatDateTime(listing.created_at)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyRow label="No listings yet." />
            )}
          </DataPanel>

          <DataPanel title="Recent Offers">
            {recentOffers.length ? (
              recentOffers.map((offer) => (
                <div key={offer.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-black">
                        {formatMoney(offer.amount_cents, offer.currency)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs font-semibold text-muted-foreground">
                        {offer.listing_title}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-black uppercase text-primary">
                      {offer.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">
                    {offer.buyer_name} to {offer.agent_name} ·{" "}
                    {formatDateTime(offer.created_at)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyRow label="No offers yet." />
            )}
          </DataPanel>
        </div>

        <section
          className="mt-8 rounded-lg border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black">Admin Account Setup</h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
                Seed or promote an admin with `ADMIN_EMAIL` and `ADMIN_PASSWORD`
                using `npm run db:seed:admin`. The current signed-in account is
                verified from the database before this page renders.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/settings">Account settings</Link>
            </Button>
          </div>
        </section>
      </main>
  );
}
