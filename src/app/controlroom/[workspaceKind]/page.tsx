import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  ArrowRight,
  Building2,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { sql } from "@/db";
import {
  acceptAgencyOwnershipTransferAction,
  declineAgencyOwnershipTransferAction,
} from "@/modules/agencies/actions";
import {
  controlRoomKindForWorkspace,
  controlRoomPathForWorkspace,
  parseControlRoomKind,
} from "@/modules/agencies/control-room";
import {
  agencyRoleLabel,
  agencyTypeLabel,
  getPrimaryAgencyWorkspace,
} from "@/modules/agencies/server";
import { authOptions } from "@/modules/auth/config";
import {
  ControlRoomActivityTrend,
  ControlRoomMetricGrid,
  ControlRoomOversightBreakdown,
  ControlRoomPeriodSelector,
  type ControlRoomContributionRow,
  type ControlRoomMetricCard,
  type ControlRoomStatusRow,
  type ControlRoomTrendPoint,
} from "./control-room-dashboard-widgets";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Control Room Analytics | Homzie",
  description: "Review agency and network control room analytics on Homzie.",
};

type ControlRoomPageProps = {
  params: Promise<{
    workspaceKind: string;
  }>;
  searchParams: Promise<{
    period?: string | string[];
  }>;
};

type AgencySummaryRow = {
  action_count: number | string;
  active_listings: number | string;
  active_members: number | string;
  high_intent_count: number | string;
  invited_members: number | string;
  linked_branches: number | string;
  pending_branches: number | string;
  previous_action_count: number | string;
  previous_high_intent_count: number | string;
  previous_sold_count: number | string;
  previous_view_count: number | string;
  sold_count: number | string;
  view_count: number | string;
};

type IncomingTransferRow = {
  agency_name: string;
  agency_type: "independent" | "network" | "branch";
  expires_at: Date;
  id: string;
  message: string | null;
};

type DashboardPeriod = (typeof dashboardPeriodOptions)[number];

type TrendRow = {
  actions: number | string | null;
  bucket: string | null;
  high_intent: number | string | null;
  sales: number | string | null;
  series: "current" | "previous" | null;
  views: number | string | null;
};

type ContributionQueryRow = {
  action_count: number | string | null;
  active_listings: number | string | null;
  helper: string | null;
  high_intent_count: number | string | null;
  id: string;
  label: string;
  member_count: number | string | null;
  score: number | string | null;
  sold_count: number | string | null;
  view_count: number | string | null;
};

type StatusQueryRow = {
  count: number | string | null;
  status: string | null;
};

const dashboardPeriodOptions = [
  { days: 7, key: "7d", label: "Last 7 days" },
  { days: 30, key: "30d", label: "Last 30 days" },
  { days: 90, key: "90d", label: "Last 90 days" },
  { days: null, key: "all", label: "All time" },
] as const;

function statusLabel(status: string) {
  if (status === "pending") return "Pending review";
  if (status === "active") return "Active";
  if (status === "suspended") return "Suspended";

  return status;
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function dashboardPeriodFor(value: string | string[] | undefined): DashboardPeriod {
  const key = firstSearchParam(value);

  return dashboardPeriodOptions.find((option) => option.key === key) || dashboardPeriodOptions[1];
}

function periodStartValue(period: DashboardPeriod) {
  if (!period.days) return null;

  return new Date(Date.now() - period.days * 24 * 60 * 60 * 1000).toISOString();
}

function previousPeriodWindow(period: DashboardPeriod) {
  if (!period.days) {
    return {
      end: null,
      start: null,
    };
  }

  const durationMs = period.days * 24 * 60 * 60 * 1000;
  const currentStart = new Date(Date.now() - durationMs);
  const previousStart = new Date(currentStart.getTime() - durationMs);

  return {
    end: currentStart.toISOString(),
    start: previousStart.toISOString(),
  };
}

function numberFrom(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function shortDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function statusText(value: string | null) {
  if (!value) return "Unknown";

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function buildTrendPoints(
  rows: TrendRow[],
  period: DashboardPeriod,
): ControlRoomTrendPoint[] {
  const today = new Date();
  const start =
    period.days
      ? addDays(today, -period.days + 1)
      : rows[0]?.bucket
        ? new Date(`${rows[0].bucket}T00:00:00.000Z`)
        : addDays(today, -29);
  const dayCount = Math.max(
    1,
    Math.min(
      366,
      Math.ceil((today.getTime() - start.getTime()) / 86_400_000) + 1,
    ),
  );
  const buckets = new Map<string, ControlRoomTrendPoint>();

  for (let index = 0; index < dayCount; index += 1) {
    const date = isoDate(addDays(start, index));

    buckets.set(date, {
      actions: 0,
      date,
      label: shortDateLabel(date),
      offers: 0,
      sales: 0,
      views: 0,
    });
  }

  rows.forEach((row) => {
    if (!row.bucket) return;

    const point =
      buckets.get(row.bucket) ||
      ({
        actions: 0,
        date: row.bucket,
        label: shortDateLabel(row.bucket),
        offers: 0,
        sales: 0,
        views: 0,
      } satisfies ControlRoomTrendPoint);

    point.actions += numberFrom(row.actions);
    point.offers += numberFrom(row.high_intent);
    point.sales += numberFrom(row.sales);
    point.views += numberFrom(row.views);
    buckets.set(row.bucket, point);
  });

  const points = Array.from(buckets.values()).sort((first, second) =>
    first.date.localeCompare(second.date),
  );

  if (points.length <= 32) return points;

  const step = Math.ceil(points.length / 32);
  const compacted: ControlRoomTrendPoint[] = [];

  for (let index = 0; index < points.length; index += step) {
    const slice = points.slice(index, index + step);
    const first = slice[0];

    compacted.push({
      actions: slice.reduce((total, point) => total + point.actions, 0),
      date: first.date,
      label: first.label,
      offers: slice.reduce((total, point) => total + point.offers, 0),
      sales: slice.reduce((total, point) => total + point.sales, 0),
      views: slice.reduce((total, point) => total + point.views, 0),
    });
  }

  return compacted;
}

function mapContributionRows(rows: ContributionQueryRow[]): ControlRoomContributionRow[] {
  return rows.map((row) => ({
    actions: numberFrom(row.action_count),
    helper: row.helper || "",
    id: row.id,
    label: row.label,
    listings: numberFrom(row.active_listings),
    members: numberFrom(row.member_count),
    offers: numberFrom(row.high_intent_count),
    sales: numberFrom(row.sold_count),
    score: numberFrom(row.score),
    views: numberFrom(row.view_count),
  }));
}

function mapStatusRows(rows: StatusQueryRow[]): ControlRoomStatusRow[] {
  return rows.map((row) => ({
    count: numberFrom(row.count),
    label: statusText(row.status),
  }));
}

function trendValues(points: ControlRoomTrendPoint[], metric: keyof ControlRoomTrendPoint) {
  return points.map((point) => numberFrom(point[metric]));
}

function snapshotTrend(value: number) {
  return [0, 0, value];
}

export default async function ControlRoomDashboardPage({
  params,
  searchParams,
}: ControlRoomPageProps) {
  const [{ workspaceKind }, query, session] = await Promise.all([
    params,
    searchParams,
    getServerSession(authOptions),
  ]);
  const kind = parseControlRoomKind(workspaceKind);
  const selectedPeriod = dashboardPeriodFor(query.period);
  const periodStart = periodStartValue(selectedPeriod);
  const previousPeriod = previousPeriodWindow(selectedPeriod);
  const previousPeriodStart = previousPeriod.start;
  const previousPeriodEnd = previousPeriod.end;
  const comparisonShiftDays = selectedPeriod.days || 0;

  if (!kind) {
    redirect("/controlroom");
  }

  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=/controlroom/${kind}`);
  }

  const workspace = await getPrimaryAgencyWorkspace(session.user.id);
  const incomingTransfers = await sql<IncomingTransferRow[]>`
    SELECT
      t.id,
      t.message,
      t.expires_at,
      a.name AS agency_name,
      a.agency_type
    FROM agency_ownership_transfers t
    INNER JOIN agencies a ON a.id = t.agency_id
    INNER JOIN users u ON u.id = ${session.user.id}
    WHERE t.status = 'pending'
      AND t.expires_at > now()
      AND (
        t.recipient_user_id = ${session.user.id}
        OR lower(t.recipient_email) = lower(u.email)
      )
    ORDER BY t.created_at DESC
  `;

  if (workspace && controlRoomKindForWorkspace(workspace) !== kind) {
    redirect(controlRoomPathForWorkspace(workspace));
  }

  if (!workspace) {
    return (
      <main className="mx-auto grid min-h-dvh w-full max-w-4xl place-items-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="w-full rounded-lg border border-border bg-card p-6 text-center shadow-sm sm:p-8">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
            <Building2 className="size-7" />
          </span>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Control room
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Create an agency workspace
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-normal leading-7 text-muted-foreground">
            Set up an agency, branch, or Network HQ before using the control room.
          </p>
          <Button asChild className="mt-6 h-11 px-6 font-semibold">
            <Link href="/agency/apply">
              Create workspace
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </section>

        {incomingTransfers.length ? (
          <section className="mt-4 w-full rounded-lg border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Ownership transfer
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              You have an agency waiting for you
            </h2>
            <div className="mt-4 grid gap-3">
              {incomingTransfers.map((transfer) => (
                <div
                  key={transfer.id}
                  className="rounded-lg border border-border bg-background p-4 text-left"
                >
                  <p className="font-semibold">{transfer.agency_name}</p>
                  <p className="mt-1 text-sm font-normal text-muted-foreground">
                    {agencyTypeLabel(transfer.agency_type)} ownership transfer
                  </p>
                  {transfer.message ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {transfer.message}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={acceptAgencyOwnershipTransferAction}>
                      <input type="hidden" name="transferId" value={transfer.id} />
                      <Button type="submit" size="sm" className="h-9 font-semibold">
                        Accept ownership
                      </Button>
                    </form>
                    <form action={declineAgencyOwnershipTransferAction}>
                      <input type="hidden" name="transferId" value={transfer.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="h-9 font-semibold"
                      >
                        Decline
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    );
  }

  const isNetwork = workspace.agency.agencyType === "network";
  const controlRoomPath = controlRoomPathForWorkspace(workspace);
  const [
    summary,
    trendRows,
    previousTrendRows,
    contributionQueryRows,
    statusQueryRows,
  ] = isNetwork
    ? await Promise.all([
        sql<AgencySummaryRow[]>`
          WITH scoped_agencies AS (
            SELECT a.id
            FROM agencies a
            WHERE a.agency_type IN ('branch', 'independent')
              AND a.parent_agency_id = ${workspace.agency.id}
              AND a.parent_link_status = 'linked'
          ),
          pending_agencies AS (
            SELECT a.id
            FROM agencies a
            WHERE a.agency_type IN ('branch', 'independent')
              AND a.parent_agency_id IS NULL
              AND a.parent_link_status = 'pending'
              AND lower(trim(coalesce(a.requested_parent_agency_name, ''))) = lower(trim(${workspace.agency.name}))
          ),
          scoped_members AS (
            SELECT am.user_id, am.status
            FROM agency_members am
            INNER JOIN scoped_agencies sa ON sa.id = am.agency_id
            WHERE am.status <> 'removed'
          ),
          scoped_listings AS (
            SELECT pl.id, pl.status, pl.sold_at, pl.outcome_at, pl.updated_at
            FROM property_listings pl
            INNER JOIN scoped_members sm ON sm.user_id = pl.user_id
          )
          SELECT
            (SELECT count(*) FROM scoped_agencies)::int AS linked_branches,
            (SELECT count(*) FROM pending_agencies)::int AS pending_branches,
            (SELECT count(DISTINCT user_id) FROM scoped_members WHERE status = 'active')::int AS active_members,
            0::int AS invited_members,
            (SELECT count(*) FROM scoped_listings WHERE status = 'published')::int AS active_listings,
            (
              SELECT count(*)
              FROM scoped_listings
              WHERE status IN ('sold', 'sold_externally')
                AND (${periodStart}::timestamptz IS NULL OR coalesce(sold_at, outcome_at, updated_at) >= ${periodStart}::timestamptz)
            )::int AS sold_count,
            (
              SELECT count(*)
              FROM listing_view_events lve
              INNER JOIN scoped_listings sl ON sl.id = lve.listing_id
              WHERE (${periodStart}::timestamptz IS NULL OR lve.created_at >= ${periodStart}::timestamptz)
            )::int AS view_count,
            (
              SELECT count(*)
              FROM listing_action_events lae
              INNER JOIN scoped_listings sl ON sl.id = lae.listing_id
              WHERE (${periodStart}::timestamptz IS NULL OR lae.created_at >= ${periodStart}::timestamptz)
            )::int AS action_count,
            (
              SELECT count(*)
              FROM listing_action_events lae
              INNER JOIN scoped_listings sl ON sl.id = lae.listing_id
              WHERE lae.action_type IN ('offer_started', 'place_offer', 'reserve_now', 'buy_now', 'contact_agent', 'call_agent', 'email_agent', 'whatsapp_agent')
                AND (${periodStart}::timestamptz IS NULL OR lae.created_at >= ${periodStart}::timestamptz)
            )::int AS high_intent_count,
            (
              SELECT count(*)
              FROM listing_view_events lve
              INNER JOIN scoped_listings sl ON sl.id = lve.listing_id
              WHERE ${previousPeriodStart}::timestamptz IS NOT NULL
                AND lve.created_at >= ${previousPeriodStart}::timestamptz
                AND lve.created_at < ${previousPeriodEnd}::timestamptz
            )::int AS previous_view_count,
            (
              SELECT count(*)
              FROM listing_action_events lae
              INNER JOIN scoped_listings sl ON sl.id = lae.listing_id
              WHERE ${previousPeriodStart}::timestamptz IS NOT NULL
                AND lae.created_at >= ${previousPeriodStart}::timestamptz
                AND lae.created_at < ${previousPeriodEnd}::timestamptz
            )::int AS previous_action_count,
            (
              SELECT count(*)
              FROM listing_action_events lae
              INNER JOIN scoped_listings sl ON sl.id = lae.listing_id
              WHERE ${previousPeriodStart}::timestamptz IS NOT NULL
                AND lae.action_type IN ('offer_started', 'place_offer', 'reserve_now', 'buy_now', 'contact_agent', 'call_agent', 'email_agent', 'whatsapp_agent')
                AND lae.created_at >= ${previousPeriodStart}::timestamptz
                AND lae.created_at < ${previousPeriodEnd}::timestamptz
            )::int AS previous_high_intent_count,
            (
              SELECT count(*)
              FROM scoped_listings
              WHERE ${previousPeriodStart}::timestamptz IS NOT NULL
                AND status IN ('sold', 'sold_externally')
                AND coalesce(sold_at, outcome_at, updated_at) >= ${previousPeriodStart}::timestamptz
                AND coalesce(sold_at, outcome_at, updated_at) < ${previousPeriodEnd}::timestamptz
            )::int AS previous_sold_count
        `,
        sql<TrendRow[]>`
          WITH scoped_agencies AS (
            SELECT a.id
            FROM agencies a
            WHERE a.agency_type IN ('branch', 'independent')
              AND a.parent_agency_id = ${workspace.agency.id}
              AND a.parent_link_status = 'linked'
          ),
          scoped_members AS (
            SELECT am.user_id
            FROM agency_members am
            INNER JOIN scoped_agencies sa ON sa.id = am.agency_id
            WHERE am.status <> 'removed'
          ),
          scoped_listings AS (
            SELECT pl.id, pl.status, pl.sold_at, pl.outcome_at, pl.updated_at
            FROM property_listings pl
            INNER JOIN scoped_members sm ON sm.user_id = pl.user_id
          )
          SELECT
            'current'::text AS series,
            bucket,
            sum(views)::int AS views,
            sum(actions)::int AS actions,
            sum(high_intent)::int AS high_intent,
            sum(sales)::int AS sales
          FROM (
            SELECT date(lve.created_at)::text AS bucket, count(*)::int AS views, 0::int AS actions, 0::int AS high_intent, 0::int AS sales
            FROM listing_view_events lve
            INNER JOIN scoped_listings sl ON sl.id = lve.listing_id
            WHERE (${periodStart}::timestamptz IS NULL OR lve.created_at >= ${periodStart}::timestamptz)
            GROUP BY 1
            UNION ALL
            SELECT date(lae.created_at)::text AS bucket, 0::int AS views, count(*)::int AS actions,
              count(*) FILTER (WHERE lae.action_type IN ('offer_started', 'place_offer', 'reserve_now', 'buy_now', 'contact_agent', 'call_agent', 'email_agent', 'whatsapp_agent'))::int AS high_intent,
              0::int AS sales
            FROM listing_action_events lae
            INNER JOIN scoped_listings sl ON sl.id = lae.listing_id
            WHERE (${periodStart}::timestamptz IS NULL OR lae.created_at >= ${periodStart}::timestamptz)
            GROUP BY 1
            UNION ALL
            SELECT date(coalesce(sl.sold_at, sl.outcome_at, sl.updated_at))::text AS bucket, 0::int AS views, 0::int AS actions, 0::int AS high_intent, count(*)::int AS sales
            FROM scoped_listings sl
            WHERE sl.status IN ('sold', 'sold_externally')
              AND (${periodStart}::timestamptz IS NULL OR coalesce(sl.sold_at, sl.outcome_at, sl.updated_at) >= ${periodStart}::timestamptz)
            GROUP BY 1
          ) events
          GROUP BY bucket
          ORDER BY bucket ASC
        `,
        sql<TrendRow[]>`
          WITH scoped_agencies AS (
            SELECT a.id
            FROM agencies a
            WHERE a.agency_type IN ('branch', 'independent')
              AND a.parent_agency_id = ${workspace.agency.id}
              AND a.parent_link_status = 'linked'
          ),
          scoped_members AS (
            SELECT am.user_id
            FROM agency_members am
            INNER JOIN scoped_agencies sa ON sa.id = am.agency_id
            WHERE am.status <> 'removed'
          ),
          scoped_listings AS (
            SELECT pl.id, pl.status, pl.sold_at, pl.outcome_at, pl.updated_at
            FROM property_listings pl
            INNER JOIN scoped_members sm ON sm.user_id = pl.user_id
          )
          SELECT
            'previous'::text AS series,
            bucket,
            sum(views)::int AS views,
            sum(actions)::int AS actions,
            sum(high_intent)::int AS high_intent,
            sum(sales)::int AS sales
          FROM (
            SELECT date(lve.created_at + (${comparisonShiftDays}::int * interval '1 day'))::text AS bucket, count(*)::int AS views, 0::int AS actions, 0::int AS high_intent, 0::int AS sales
            FROM listing_view_events lve
            INNER JOIN scoped_listings sl ON sl.id = lve.listing_id
            WHERE ${previousPeriodStart}::timestamptz IS NOT NULL
              AND lve.created_at >= ${previousPeriodStart}::timestamptz
              AND lve.created_at < ${previousPeriodEnd}::timestamptz
            GROUP BY 1
            UNION ALL
            SELECT date(lae.created_at + (${comparisonShiftDays}::int * interval '1 day'))::text AS bucket, 0::int AS views, count(*)::int AS actions,
              count(*) FILTER (WHERE lae.action_type IN ('offer_started', 'place_offer', 'reserve_now', 'buy_now', 'contact_agent', 'call_agent', 'email_agent', 'whatsapp_agent'))::int AS high_intent,
              0::int AS sales
            FROM listing_action_events lae
            INNER JOIN scoped_listings sl ON sl.id = lae.listing_id
            WHERE ${previousPeriodStart}::timestamptz IS NOT NULL
              AND lae.created_at >= ${previousPeriodStart}::timestamptz
              AND lae.created_at < ${previousPeriodEnd}::timestamptz
            GROUP BY 1
            UNION ALL
            SELECT date(coalesce(sl.sold_at, sl.outcome_at, sl.updated_at) + (${comparisonShiftDays}::int * interval '1 day'))::text AS bucket, 0::int AS views, 0::int AS actions, 0::int AS high_intent, count(*)::int AS sales
            FROM scoped_listings sl
            WHERE ${previousPeriodStart}::timestamptz IS NOT NULL
              AND sl.status IN ('sold', 'sold_externally')
              AND coalesce(sl.sold_at, sl.outcome_at, sl.updated_at) >= ${previousPeriodStart}::timestamptz
              AND coalesce(sl.sold_at, sl.outcome_at, sl.updated_at) < ${previousPeriodEnd}::timestamptz
            GROUP BY 1
          ) events
          GROUP BY bucket
          ORDER BY bucket ASC
        `,
        sql<ContributionQueryRow[]>`
          WITH scoped_agencies AS (
            SELECT a.id, a.name, a.region
            FROM agencies a
            WHERE a.agency_type IN ('branch', 'independent')
              AND a.parent_agency_id = ${workspace.agency.id}
              AND a.parent_link_status = 'linked'
          ),
          scoped_members AS (
            SELECT sa.id AS agency_id, am.user_id, am.status
            FROM scoped_agencies sa
            LEFT JOIN agency_members am
              ON am.agency_id = sa.id
              AND am.status <> 'removed'
          ),
          scoped_listings AS (
            SELECT sm.agency_id, pl.id, pl.status, pl.sold_at, pl.outcome_at, pl.updated_at
            FROM scoped_members sm
            INNER JOIN property_listings pl ON pl.user_id = sm.user_id
          ),
          member_counts AS (
            SELECT agency_id, count(DISTINCT user_id) FILTER (WHERE status = 'active')::int AS member_count
            FROM scoped_members
            GROUP BY agency_id
          ),
          listing_counts AS (
            SELECT agency_id, count(*) FILTER (WHERE status = 'published')::int AS active_listings
            FROM scoped_listings
            GROUP BY agency_id
          ),
          sales AS (
            SELECT agency_id, count(*)::int AS sold_count
            FROM scoped_listings
            WHERE status IN ('sold', 'sold_externally')
              AND (${periodStart}::timestamptz IS NULL OR coalesce(sold_at, outcome_at, updated_at) >= ${periodStart}::timestamptz)
            GROUP BY agency_id
          ),
          views AS (
            SELECT sl.agency_id, count(lve.id)::int AS view_count
            FROM scoped_listings sl
            INNER JOIN listing_view_events lve ON lve.listing_id = sl.id
            WHERE (${periodStart}::timestamptz IS NULL OR lve.created_at >= ${periodStart}::timestamptz)
            GROUP BY sl.agency_id
          ),
          actions AS (
            SELECT
              sl.agency_id,
              count(lae.id)::int AS action_count,
              count(*) FILTER (WHERE lae.action_type IN ('offer_started', 'place_offer', 'reserve_now', 'buy_now', 'contact_agent', 'call_agent', 'email_agent', 'whatsapp_agent'))::int AS high_intent_count
            FROM scoped_listings sl
            INNER JOIN listing_action_events lae ON lae.listing_id = sl.id
            WHERE (${periodStart}::timestamptz IS NULL OR lae.created_at >= ${periodStart}::timestamptz)
            GROUP BY sl.agency_id
          )
          SELECT
            sa.id,
            sa.name AS label,
            coalesce(sa.region, 'Linked branch') AS helper,
            coalesce(mc.member_count, 0)::int AS member_count,
            coalesce(lc.active_listings, 0)::int AS active_listings,
            coalesce(v.view_count, 0)::int AS view_count,
            coalesce(a.action_count, 0)::int AS action_count,
            coalesce(a.high_intent_count, 0)::int AS high_intent_count,
            coalesce(s.sold_count, 0)::int AS sold_count,
            (
              coalesce(v.view_count, 0)
              + coalesce(a.action_count, 0) * 3
              + coalesce(a.high_intent_count, 0) * 6
              + coalesce(s.sold_count, 0) * 12
              + coalesce(lc.active_listings, 0) * 2
              + coalesce(mc.member_count, 0)
            )::int AS score
          FROM scoped_agencies sa
          LEFT JOIN member_counts mc ON mc.agency_id = sa.id
          LEFT JOIN listing_counts lc ON lc.agency_id = sa.id
          LEFT JOIN views v ON v.agency_id = sa.id
          LEFT JOIN actions a ON a.agency_id = sa.id
          LEFT JOIN sales s ON s.agency_id = sa.id
          ORDER BY score DESC, view_count DESC, label ASC
          LIMIT 10
        `,
        sql<StatusQueryRow[]>`
          WITH scoped_agencies AS (
            SELECT a.id
            FROM agencies a
            WHERE a.agency_type IN ('branch', 'independent')
              AND a.parent_agency_id = ${workspace.agency.id}
              AND a.parent_link_status = 'linked'
          ),
          scoped_members AS (
            SELECT am.user_id
            FROM agency_members am
            INNER JOIN scoped_agencies sa ON sa.id = am.agency_id
            WHERE am.status <> 'removed'
          ),
          scoped_listings AS (
            SELECT pl.status
            FROM property_listings pl
            INNER JOIN scoped_members sm ON sm.user_id = pl.user_id
          )
          SELECT status, count(*)::int AS count
          FROM scoped_listings
          GROUP BY status
          ORDER BY count DESC, status ASC
        `,
      ])
    : await Promise.all([
        sql<AgencySummaryRow[]>`
          WITH scoped_members AS (
            SELECT am.user_id, am.status
            FROM agency_members am
            WHERE am.agency_id = ${workspace.agency.id}
              AND am.status <> 'removed'
          ),
          scoped_listings AS (
            SELECT pl.id, pl.status, pl.sold_at, pl.outcome_at, pl.updated_at
            FROM property_listings pl
            INNER JOIN scoped_members sm ON sm.user_id = pl.user_id
          )
          SELECT
            0::int AS linked_branches,
            0::int AS pending_branches,
            (SELECT count(DISTINCT user_id) FROM scoped_members WHERE status = 'active')::int AS active_members,
            (SELECT count(*) FROM scoped_members WHERE status = 'invited')::int AS invited_members,
            (SELECT count(*) FROM scoped_listings WHERE status = 'published')::int AS active_listings,
            (
              SELECT count(*)
              FROM scoped_listings
              WHERE status IN ('sold', 'sold_externally')
                AND (${periodStart}::timestamptz IS NULL OR coalesce(sold_at, outcome_at, updated_at) >= ${periodStart}::timestamptz)
            )::int AS sold_count,
            (
              SELECT count(*)
              FROM listing_view_events lve
              INNER JOIN scoped_listings sl ON sl.id = lve.listing_id
              WHERE (${periodStart}::timestamptz IS NULL OR lve.created_at >= ${periodStart}::timestamptz)
            )::int AS view_count,
            (
              SELECT count(*)
              FROM listing_action_events lae
              INNER JOIN scoped_listings sl ON sl.id = lae.listing_id
              WHERE (${periodStart}::timestamptz IS NULL OR lae.created_at >= ${periodStart}::timestamptz)
            )::int AS action_count,
            (
              SELECT count(*)
              FROM listing_action_events lae
              INNER JOIN scoped_listings sl ON sl.id = lae.listing_id
              WHERE lae.action_type IN ('offer_started', 'place_offer', 'reserve_now', 'buy_now', 'contact_agent', 'call_agent', 'email_agent', 'whatsapp_agent')
                AND (${periodStart}::timestamptz IS NULL OR lae.created_at >= ${periodStart}::timestamptz)
            )::int AS high_intent_count,
            (
              SELECT count(*)
              FROM listing_view_events lve
              INNER JOIN scoped_listings sl ON sl.id = lve.listing_id
              WHERE ${previousPeriodStart}::timestamptz IS NOT NULL
                AND lve.created_at >= ${previousPeriodStart}::timestamptz
                AND lve.created_at < ${previousPeriodEnd}::timestamptz
            )::int AS previous_view_count,
            (
              SELECT count(*)
              FROM listing_action_events lae
              INNER JOIN scoped_listings sl ON sl.id = lae.listing_id
              WHERE ${previousPeriodStart}::timestamptz IS NOT NULL
                AND lae.created_at >= ${previousPeriodStart}::timestamptz
                AND lae.created_at < ${previousPeriodEnd}::timestamptz
            )::int AS previous_action_count,
            (
              SELECT count(*)
              FROM listing_action_events lae
              INNER JOIN scoped_listings sl ON sl.id = lae.listing_id
              WHERE ${previousPeriodStart}::timestamptz IS NOT NULL
                AND lae.action_type IN ('offer_started', 'place_offer', 'reserve_now', 'buy_now', 'contact_agent', 'call_agent', 'email_agent', 'whatsapp_agent')
                AND lae.created_at >= ${previousPeriodStart}::timestamptz
                AND lae.created_at < ${previousPeriodEnd}::timestamptz
            )::int AS previous_high_intent_count,
            (
              SELECT count(*)
              FROM scoped_listings
              WHERE ${previousPeriodStart}::timestamptz IS NOT NULL
                AND status IN ('sold', 'sold_externally')
                AND coalesce(sold_at, outcome_at, updated_at) >= ${previousPeriodStart}::timestamptz
                AND coalesce(sold_at, outcome_at, updated_at) < ${previousPeriodEnd}::timestamptz
            )::int AS previous_sold_count
        `,
        sql<TrendRow[]>`
          WITH scoped_members AS (
            SELECT am.user_id
            FROM agency_members am
            WHERE am.agency_id = ${workspace.agency.id}
              AND am.status <> 'removed'
          ),
          scoped_listings AS (
            SELECT pl.id, pl.status, pl.sold_at, pl.outcome_at, pl.updated_at
            FROM property_listings pl
            INNER JOIN scoped_members sm ON sm.user_id = pl.user_id
          )
          SELECT
            'current'::text AS series,
            bucket,
            sum(views)::int AS views,
            sum(actions)::int AS actions,
            sum(high_intent)::int AS high_intent,
            sum(sales)::int AS sales
          FROM (
            SELECT date(lve.created_at)::text AS bucket, count(*)::int AS views, 0::int AS actions, 0::int AS high_intent, 0::int AS sales
            FROM listing_view_events lve
            INNER JOIN scoped_listings sl ON sl.id = lve.listing_id
            WHERE (${periodStart}::timestamptz IS NULL OR lve.created_at >= ${periodStart}::timestamptz)
            GROUP BY 1
            UNION ALL
            SELECT date(lae.created_at)::text AS bucket, 0::int AS views, count(*)::int AS actions,
              count(*) FILTER (WHERE lae.action_type IN ('offer_started', 'place_offer', 'reserve_now', 'buy_now', 'contact_agent', 'call_agent', 'email_agent', 'whatsapp_agent'))::int AS high_intent,
              0::int AS sales
            FROM listing_action_events lae
            INNER JOIN scoped_listings sl ON sl.id = lae.listing_id
            WHERE (${periodStart}::timestamptz IS NULL OR lae.created_at >= ${periodStart}::timestamptz)
            GROUP BY 1
            UNION ALL
            SELECT date(coalesce(sl.sold_at, sl.outcome_at, sl.updated_at))::text AS bucket, 0::int AS views, 0::int AS actions, 0::int AS high_intent, count(*)::int AS sales
            FROM scoped_listings sl
            WHERE sl.status IN ('sold', 'sold_externally')
              AND (${periodStart}::timestamptz IS NULL OR coalesce(sl.sold_at, sl.outcome_at, sl.updated_at) >= ${periodStart}::timestamptz)
            GROUP BY 1
          ) events
          GROUP BY bucket
          ORDER BY bucket ASC
        `,
        sql<TrendRow[]>`
          WITH scoped_members AS (
            SELECT am.user_id
            FROM agency_members am
            WHERE am.agency_id = ${workspace.agency.id}
              AND am.status <> 'removed'
          ),
          scoped_listings AS (
            SELECT pl.id, pl.status, pl.sold_at, pl.outcome_at, pl.updated_at
            FROM property_listings pl
            INNER JOIN scoped_members sm ON sm.user_id = pl.user_id
          )
          SELECT
            'previous'::text AS series,
            bucket,
            sum(views)::int AS views,
            sum(actions)::int AS actions,
            sum(high_intent)::int AS high_intent,
            sum(sales)::int AS sales
          FROM (
            SELECT date(lve.created_at + (${comparisonShiftDays}::int * interval '1 day'))::text AS bucket, count(*)::int AS views, 0::int AS actions, 0::int AS high_intent, 0::int AS sales
            FROM listing_view_events lve
            INNER JOIN scoped_listings sl ON sl.id = lve.listing_id
            WHERE ${previousPeriodStart}::timestamptz IS NOT NULL
              AND lve.created_at >= ${previousPeriodStart}::timestamptz
              AND lve.created_at < ${previousPeriodEnd}::timestamptz
            GROUP BY 1
            UNION ALL
            SELECT date(lae.created_at + (${comparisonShiftDays}::int * interval '1 day'))::text AS bucket, 0::int AS views, count(*)::int AS actions,
              count(*) FILTER (WHERE lae.action_type IN ('offer_started', 'place_offer', 'reserve_now', 'buy_now', 'contact_agent', 'call_agent', 'email_agent', 'whatsapp_agent'))::int AS high_intent,
              0::int AS sales
            FROM listing_action_events lae
            INNER JOIN scoped_listings sl ON sl.id = lae.listing_id
            WHERE ${previousPeriodStart}::timestamptz IS NOT NULL
              AND lae.created_at >= ${previousPeriodStart}::timestamptz
              AND lae.created_at < ${previousPeriodEnd}::timestamptz
            GROUP BY 1
            UNION ALL
            SELECT date(coalesce(sl.sold_at, sl.outcome_at, sl.updated_at) + (${comparisonShiftDays}::int * interval '1 day'))::text AS bucket, 0::int AS views, 0::int AS actions, 0::int AS high_intent, count(*)::int AS sales
            FROM scoped_listings sl
            WHERE ${previousPeriodStart}::timestamptz IS NOT NULL
              AND sl.status IN ('sold', 'sold_externally')
              AND coalesce(sl.sold_at, sl.outcome_at, sl.updated_at) >= ${previousPeriodStart}::timestamptz
              AND coalesce(sl.sold_at, sl.outcome_at, sl.updated_at) < ${previousPeriodEnd}::timestamptz
            GROUP BY 1
          ) events
          GROUP BY bucket
          ORDER BY bucket ASC
        `,
        sql<ContributionQueryRow[]>`
          WITH scoped_agents AS (
            SELECT
              am.user_id,
              am.role,
              am.status,
              u.name,
              u.username
            FROM agency_members am
            LEFT JOIN users u ON u.id = am.user_id
            WHERE am.agency_id = ${workspace.agency.id}
              AND am.status <> 'removed'
              AND am.user_id IS NOT NULL
          ),
          scoped_listings AS (
            SELECT sa.user_id, pl.id, pl.status, pl.sold_at, pl.outcome_at, pl.updated_at
            FROM scoped_agents sa
            LEFT JOIN property_listings pl ON pl.user_id = sa.user_id
          ),
          listing_counts AS (
            SELECT user_id, count(id) FILTER (WHERE status = 'published')::int AS active_listings
            FROM scoped_listings
            GROUP BY user_id
          ),
          sales AS (
            SELECT user_id, count(id)::int AS sold_count
            FROM scoped_listings
            WHERE status IN ('sold', 'sold_externally')
              AND (${periodStart}::timestamptz IS NULL OR coalesce(sold_at, outcome_at, updated_at) >= ${periodStart}::timestamptz)
            GROUP BY user_id
          ),
          views AS (
            SELECT sl.user_id, count(lve.id)::int AS view_count
            FROM scoped_listings sl
            INNER JOIN listing_view_events lve ON lve.listing_id = sl.id
            WHERE (${periodStart}::timestamptz IS NULL OR lve.created_at >= ${periodStart}::timestamptz)
            GROUP BY sl.user_id
          ),
          actions AS (
            SELECT
              sl.user_id,
              count(lae.id)::int AS action_count,
              count(*) FILTER (WHERE lae.action_type IN ('offer_started', 'place_offer', 'reserve_now', 'buy_now', 'contact_agent', 'call_agent', 'email_agent', 'whatsapp_agent'))::int AS high_intent_count
            FROM scoped_listings sl
            INNER JOIN listing_action_events lae ON lae.listing_id = sl.id
            WHERE (${periodStart}::timestamptz IS NULL OR lae.created_at >= ${periodStart}::timestamptz)
            GROUP BY sl.user_id
          )
          SELECT
            sa.user_id AS id,
            coalesce(sa.name, sa.username, 'Agent') AS label,
            CASE
              WHEN sa.username IS NOT NULL THEN '@' || sa.username
              ELSE initcap(replace(sa.role::text, '_', ' '))
            END AS helper,
            CASE WHEN sa.status = 'active' THEN 1 ELSE 0 END AS member_count,
            coalesce(lc.active_listings, 0)::int AS active_listings,
            coalesce(v.view_count, 0)::int AS view_count,
            coalesce(a.action_count, 0)::int AS action_count,
            coalesce(a.high_intent_count, 0)::int AS high_intent_count,
            coalesce(s.sold_count, 0)::int AS sold_count,
            (
              coalesce(v.view_count, 0)
              + coalesce(a.action_count, 0) * 3
              + coalesce(a.high_intent_count, 0) * 6
              + coalesce(s.sold_count, 0) * 12
              + coalesce(lc.active_listings, 0) * 2
              + CASE WHEN sa.status = 'active' THEN 1 ELSE 0 END
            )::int AS score
          FROM scoped_agents sa
          LEFT JOIN listing_counts lc ON lc.user_id = sa.user_id
          LEFT JOIN views v ON v.user_id = sa.user_id
          LEFT JOIN actions a ON a.user_id = sa.user_id
          LEFT JOIN sales s ON s.user_id = sa.user_id
          ORDER BY score DESC, view_count DESC, label ASC
          LIMIT 10
        `,
        sql<StatusQueryRow[]>`
          WITH scoped_members AS (
            SELECT am.user_id
            FROM agency_members am
            WHERE am.agency_id = ${workspace.agency.id}
              AND am.status <> 'removed'
          ),
          scoped_listings AS (
            SELECT pl.status
            FROM property_listings pl
            INNER JOIN scoped_members sm ON sm.user_id = pl.user_id
          )
          SELECT status, count(*)::int AS count
          FROM scoped_listings
          GROUP BY status
          ORDER BY count DESC, status ASC
        `,
      ]);
  const summaryValues = summary[0];
  const currentTrendPoints = buildTrendPoints(trendRows, selectedPeriod);
  const previousTrendPoints = selectedPeriod.days
    ? buildTrendPoints(previousTrendRows, selectedPeriod)
    : [];
  const metricCards: ControlRoomMetricCard[] = isNetwork
    ? [
        {
          description: "Branch agencies currently linked to this Network HQ.",
          helper: `${numberFrom(summaryValues?.pending_branches)} pending`,
          label: "Linked branches",
          previousValue: null,
          trend: snapshotTrend(numberFrom(summaryValues?.linked_branches)),
          value: numberFrom(summaryValues?.linked_branches),
        },
        {
          description: "Active public agents across linked branch agencies.",
          helper: "Across linked agencies",
          label: "Active members",
          previousValue: null,
          trend: snapshotTrend(numberFrom(summaryValues?.active_members)),
          value: numberFrom(summaryValues?.active_members),
        },
        {
          description: "Published listings across the linked branch network.",
          helper: "Published now",
          label: "Active listings",
          previousValue: null,
          trend: snapshotTrend(numberFrom(summaryValues?.active_listings)),
          value: numberFrom(summaryValues?.active_listings),
        },
        {
          description: "Listing detail views during the selected period.",
          helper: selectedPeriod.label,
          label: "Buyer views",
          previousValue: selectedPeriod.days
            ? numberFrom(summaryValues?.previous_view_count)
            : null,
          trend: trendValues(currentTrendPoints, "views"),
          value: numberFrom(summaryValues?.view_count),
        },
        {
          description: "High-intent buyer actions such as contact, offer, or reservation starts.",
          helper: selectedPeriod.label,
          label: "High intent",
          previousValue: selectedPeriod.days
            ? numberFrom(summaryValues?.previous_high_intent_count)
            : null,
          trend: trendValues(currentTrendPoints, "offers"),
          value: numberFrom(summaryValues?.high_intent_count),
        },
        {
          description: "Sold or sold externally listing outcomes recorded during the selected period.",
          helper: selectedPeriod.label,
          label: "Sold outcomes",
          previousValue: selectedPeriod.days
            ? numberFrom(summaryValues?.previous_sold_count)
            : null,
          trend: trendValues(currentTrendPoints, "sales"),
          value: numberFrom(summaryValues?.sold_count),
        },
      ]
    : [
        {
          description: "Active agency-funded public agent seats in this agency workspace.",
          helper: `${numberFrom(summaryValues?.invited_members)} invited`,
          label: "Active agents",
          previousValue: null,
          trend: snapshotTrend(numberFrom(summaryValues?.active_members)),
          value: numberFrom(summaryValues?.active_members),
        },
        {
          description: "Published listings owned by linked agency agents.",
          helper: "Published now",
          label: "Active listings",
          previousValue: null,
          trend: snapshotTrend(numberFrom(summaryValues?.active_listings)),
          value: numberFrom(summaryValues?.active_listings),
        },
        {
          description: "Listing detail views during the selected period.",
          helper: selectedPeriod.label,
          label: "Buyer views",
          previousValue: selectedPeriod.days
            ? numberFrom(summaryValues?.previous_view_count)
            : null,
          trend: trendValues(currentTrendPoints, "views"),
          value: numberFrom(summaryValues?.view_count),
        },
        {
          description: "All tracked listing interactions during the selected period.",
          helper: selectedPeriod.label,
          label: "Actions",
          previousValue: selectedPeriod.days
            ? numberFrom(summaryValues?.previous_action_count)
            : null,
          trend: trendValues(currentTrendPoints, "actions"),
          value: numberFrom(summaryValues?.action_count),
        },
        {
          description: "High-intent buyer actions such as contact, offer, or reservation starts.",
          helper: selectedPeriod.label,
          label: "High intent",
          previousValue: selectedPeriod.days
            ? numberFrom(summaryValues?.previous_high_intent_count)
            : null,
          trend: trendValues(currentTrendPoints, "offers"),
          value: numberFrom(summaryValues?.high_intent_count),
        },
        {
          description: "Sold or sold externally listing outcomes recorded during the selected period.",
          helper: selectedPeriod.label,
          label: "Sold outcomes",
          previousValue: selectedPeriod.days
            ? numberFrom(summaryValues?.previous_sold_count)
            : null,
          trend: trendValues(currentTrendPoints, "sales"),
          value: numberFrom(summaryValues?.sold_count),
        },
      ];
  const contributionRows = mapContributionRows(contributionQueryRows);
  const statusRows = mapStatusRows(statusQueryRows);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {kind === "networkhq" ? "Network HQ analytics" : "Agency analytics"}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Control Room Analytics
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-normal leading-7 text-muted-foreground">
            {workspace.agency.name} ·{" "}
            {agencyTypeLabel(workspace.agency.agencyType)} ·{" "}
            {agencyRoleLabel(workspace.membership.role)} ·{" "}
            {statusLabel(workspace.agency.status)} · {selectedPeriod.label}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ControlRoomPeriodSelector
            basePath={controlRoomPath}
            currentPeriod={selectedPeriod.key}
            periods={dashboardPeriodOptions}
          />
          <Button asChild variant="outline" className="h-10 w-fit font-semibold">
            <Link href={`${controlRoomPath}/settings`}>
              <Settings className="size-4" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <ControlRoomMetricGrid metrics={metricCards} />
      </div>

      {incomingTransfers.length ? (
        <section className="mt-8 rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Incoming ownership
          </p>
          <h2 className="mt-2 text-xl font-semibold">Ownership requests for you</h2>
          <div className="mt-4 grid gap-3">
            {incomingTransfers.map((transfer) => (
              <div
                key={transfer.id}
                className="grid gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <p className="font-semibold">{transfer.agency_name}</p>
                  <p className="mt-1 text-sm font-normal text-muted-foreground">
                    {agencyTypeLabel(transfer.agency_type)} ownership transfer
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={acceptAgencyOwnershipTransferAction}>
                    <input type="hidden" name="transferId" value={transfer.id} />
                    <Button type="submit" size="sm" className="h-9 font-semibold">
                      Accept
                    </Button>
                  </form>
                  <form action={declineAgencyOwnershipTransferAction}>
                    <input type="hidden" name="transferId" value={transfer.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      className="h-9 font-semibold"
                    >
                      Decline
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8 grid gap-5">
        <ControlRoomActivityTrend
          currentPoints={currentTrendPoints}
          previousPoints={previousTrendPoints}
        />
        <ControlRoomOversightBreakdown
          contributionLabel={isNetwork ? "Branches" : "Agents"}
          contributionRows={contributionRows}
          statusRows={statusRows}
        />
      </section>
    </main>
  );
}
