import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Building2,
  CircleDollarSign,
  Clapperboard,
  Eye,
  EyeOff,
  Flag,
  RefreshCw,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { sql } from "@/db";
import {
  hideDemoProfileAction,
  refreshDemoProfileAction,
  showDemoProfileAction,
} from "./actions";

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

type DemoProfileSummary = {
  id: string;
  username: string | null;
  name: string;
  profile_visible: boolean;
  search_visible: boolean;
  listing_count: number | string | null;
  published_count: number | string | null;
  sold_count: number | string | null;
  sold_value_cents: number | string | null;
  updated_at: string;
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
      (
        (SELECT count(*) FROM message_reports WHERE status IN ('open', 'in_review', 'waiting_on_user', 'escalated')) +
        (SELECT count(*) FROM moderation_cases WHERE case_type = 'report' AND status IN ('open', 'in_review', 'waiting_on_user', 'escalated'))
      ) AS open_reports,
      (SELECT count(*) FROM property_sale_claims WHERE claim_status IN ('pending', 'in_review', 'waiting_on_user')) AS pending_sale_claims,
      (SELECT count(*) FROM property_sale_disputes WHERE status IN ('pending', 'in_review', 'waiting_on_user', 'escalated')) AS pending_disputes,
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

  const [demoProfile] = await sql<DemoProfileSummary[]>`
    SELECT
      u.id,
      u.username,
      u.name,
      u.profile_visible,
      u.search_visible,
      u.updated_at,
      (
        SELECT count(*)
        FROM property_listings pl
        WHERE pl.user_id = u.id
          AND pl.is_demo_content = true
      ) AS listing_count,
      (
        SELECT count(*)
        FROM property_listings pl
        WHERE pl.user_id = u.id
          AND pl.is_demo_content = true
          AND pl.status = 'published'
      ) AS published_count,
      (
        SELECT count(*)
        FROM property_listings pl
        WHERE pl.user_id = u.id
          AND pl.is_demo_content = true
          AND pl.status = 'sold'
      ) AS sold_count,
      (
        SELECT COALESCE(sum(pl.sold_price_cents), 0)
        FROM property_listings pl
        WHERE pl.user_id = u.id
          AND pl.is_demo_content = true
          AND pl.status = 'sold'
      ) AS sold_value_cents
    FROM users u
    WHERE u.is_demo = true
      AND u.email = 'demo.agent@homzie.co.za'
    ORDER BY u.updated_at DESC
    LIMIT 1
  `;

  return {
    demoProfile,
    metrics,
    recentListings,
    recentOffers,
    recentUsers,
  };
}

function MetricCard({
  detail,
  href,
  icon: Icon,
  label,
  tone = "default",
  value,
}: {
  detail: string;
  href?: string;
  icon: typeof BarChart3;
  label: string;
  tone?: "default" | "warning";
  value: React.ReactNode;
}) {
  const content = (
    <article className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-normal uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
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
      <p className="mt-4 text-sm font-normal leading-6 text-muted-foreground">
        {detail}
      </p>
    </article>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block transition hover:-translate-y-0.5 hover:shadow-md">
      {content}
    </Link>
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
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="px-5 py-8 text-sm font-normal text-muted-foreground">
      {label}
    </div>
  );
}

export default async function AdminPage() {
  const { demoProfile, metrics, recentListings, recentOffers, recentUsers } =
    await getDashboardData();

  const moderationQueue =
    numberFrom(metrics?.open_reports) +
    numberFrom(metrics?.pending_sale_claims) +
    numberFrom(metrics?.pending_disputes);
  const demoProfileIsVisible = Boolean(demoProfile?.profile_visible);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Admin
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Dashboard
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-normal leading-7 text-muted-foreground">
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
            href="/admin/moderation"
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

        <section className="mt-8 rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                    Demo profile
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight">
                    Future-agent showcase
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-sm font-normal leading-6 text-muted-foreground">
                Seed a polished mock agent profile with verified sales history,
                premium listings, and strong performance analytics. Hide it when
                you do not want demo content visible on the public site.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <form action={refreshDemoProfileAction}>
                <Button type="submit" variant="outline">
                  <RefreshCw className="mr-2 size-4" />
                  Refresh
                </Button>
              </form>
              <form
                action={
                  demoProfileIsVisible
                    ? hideDemoProfileAction
                    : showDemoProfileAction
                }
              >
                <Button
                  type="submit"
                  variant={demoProfileIsVisible ? "outline" : "default"}
                >
                  {demoProfileIsVisible ? (
                    <EyeOff className="mr-2 size-4" />
                  ) : (
                    <Eye className="mr-2 size-4" />
                  )}
                  {demoProfileIsVisible ? "Hide" : "Show"}
                </Button>
              </form>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-normal uppercase tracking-[0.08em] text-muted-foreground">
                Status
              </p>
              <p className="mt-2 text-lg font-semibold">
                {demoProfile?.profile_visible ? "Visible" : "Hidden"}
              </p>
              <p className="mt-1 text-xs font-normal text-muted-foreground">
                {demoProfile
                  ? `Updated ${formatDateTime(demoProfile.updated_at)}`
                  : "Not seeded yet"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-normal uppercase tracking-[0.08em] text-muted-foreground">
                Listings
              </p>
              <p className="mt-2 text-lg font-semibold">
                {formatNumber(demoProfile?.listing_count)}
              </p>
              <p className="mt-1 text-xs font-normal text-muted-foreground">
                {formatNumber(demoProfile?.published_count)} active showcase
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-normal uppercase tracking-[0.08em] text-muted-foreground">
                Verified sales
              </p>
              <p className="mt-2 text-lg font-semibold">
                {formatNumber(demoProfile?.sold_count)}
              </p>
              <p className="mt-1 text-xs font-normal text-muted-foreground">
                Sales history powers the analytics page.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-normal uppercase tracking-[0.08em] text-muted-foreground">
                Sold value
              </p>
              <p className="mt-2 text-lg font-semibold">
                {formatMoney(numberFrom(demoProfile?.sold_value_cents), "ZAR")}
              </p>
              <p className="mt-1 text-xs font-normal text-muted-foreground">
                Current-year demo performance.
              </p>
            </div>
          </div>

          {demoProfile?.username ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/admin/settings/demo-profile">Manage demo profile</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/users/${demoProfile.username}`}>Open profile</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/users/${demoProfile.username}/performance`}>
                  Open analytics
                </Link>
              </Button>
            </div>
          ) : null}
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-3">
          <DataPanel title="Recent Users">
            {recentUsers.length ? (
              recentUsers.map((user) => (
                <div key={user.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{user.name}</p>
                      <p className="truncate text-xs font-normal text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase text-primary">
                      {user.role}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-normal text-muted-foreground">
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
                        className="line-clamp-2 text-sm font-semibold transition hover:text-primary"
                      >
                        {listing.title}
                      </Link>
                      <p className="mt-1 truncate text-xs font-normal text-muted-foreground">
                        {listing.agent_name} · {listing.location || "No location"}
                      </p>
                    </div>
                    <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold uppercase text-secondary-foreground">
                      {listing.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-normal text-muted-foreground">
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
                      <p className="text-sm font-semibold">
                        {formatMoney(offer.amount_cents, offer.currency)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs font-normal text-muted-foreground">
                        {offer.listing_title}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase text-primary">
                      {offer.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-normal text-muted-foreground">
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
              <h2 className="text-base font-semibold">Admin Account Setup</h2>
              <p className="mt-2 max-w-2xl text-sm font-normal leading-6 text-muted-foreground">
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
