import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Eye, Radar, TrendingDown, TrendingUp, UsersRound } from "lucide-react";

import { AgentProfileAvatar } from "@/components/agent-profile-avatar";
import { Button } from "@/components/ui/button";
import {
  CanonicalTable,
  type CanonicalTableColumn,
} from "@/components/ui/canonical-table";
import { sql } from "@/db";
import { toPublicMediaUrl } from "@/media/paths";
import { authOptions } from "@/modules/auth/config";
import { parseControlRoomKind } from "@/modules/agencies/control-room";
import { clearAgencyBuyerActivityAction } from "@/modules/listings/agency-buyer-activity-actions";
import { getAgencyBuyerActivityAccessForUser } from "@/modules/listings/agency-buyer-activity";
import { ActivityRealtimeRefresh } from "@/modules/listings/components/activity-realtime-refresh";
import {
  activityBadge,
  activityLabel,
  formatDateTime,
  TruncatedText,
} from "@/modules/listings/components/listing-activity-ui";

type AgencyBuyerActivityPageProps = {
  params: Promise<{
    workspaceKind: string;
  }>;
  searchParams?: Promise<{ page?: string }>;
};

type AssignedAgent = {
  avatarUrl: string | null;
  name: string;
  role: "co_agent" | "lead";
  userId: string;
  username: string | null;
};

type AgencyBuyerActivityOverviewRow = {
  action_count: number;
  active_buyer_count: number;
  active_viewer_count: number;
  activity_count: number;
  assigned_agents: unknown;
  cover_image_url: string | null;
  id: string;
  latest_action_type: string | null;
  latest_activity_type: "action" | "view" | null;
  latest_actor_name: string | null;
  latest_seen_at: Date | string | null;
  listed_at: Date | string | null;
  location: string | null;
  price_label: string | null;
  status: string | null;
  title: string;
  unread_viewer_count: number;
  view_count: number;
};

type AgencyBuyerActivityAnalyticsRow = {
  active_buyer_count: number;
  active_viewer_count: number;
  previous_views_24h: number;
  total_views_24h: number;
  unread_viewer_count: number;
};

export const dynamic = "force-dynamic";

function parsePage(value: string | undefined) {
  const page = Number(value || "1");

  if (!Number.isFinite(page) || page < 1) return 1;

  return Math.floor(page);
}

function plural(value: number, singular: string, pluralLabel = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralLabel}`;
}

function formatTrend(current: number, previous: number) {
  if (current === 0 && previous === 0) {
    return { direction: "flat" as const, label: "No change vs previous 24h" };
  }

  if (previous === 0) {
    return current > 0
      ? { direction: "up" as const, label: "Up 100% vs previous 24h" }
      : { direction: "flat" as const, label: "No change vs previous 24h" };
  }

  const percent = Math.round(((current - previous) / previous) * 100);

  if (percent === 0) {
    return { direction: "flat" as const, label: "No change vs previous 24h" };
  }

  return {
    direction: percent > 0 ? "up" as const : "down" as const,
    label: `${percent > 0 ? "Up" : "Down"} ${Math.abs(percent)}% vs previous 24h`,
  };
}

function assignedAgents(value: unknown): AssignedAgent[] {
  return Array.isArray(value)
    ? value.filter((agent): agent is AssignedAgent =>
        Boolean(agent && typeof agent === "object" && "userId" in agent),
      )
    : [];
}

function latestEventLabel(row: AgencyBuyerActivityOverviewRow) {
  if (!row.latest_activity_type) return "No buyer activity yet";

  const label = activityLabel({
    action_type: row.latest_action_type,
    activity_type: row.latest_activity_type,
  }).toLowerCase();

  return row.latest_actor_name
    ? `${row.latest_actor_name} ${label}`
    : label[0]?.toUpperCase() + label.slice(1);
}

function AnalyticsStat({
  description,
  icon: Icon,
  label,
  tone = "purple",
  value,
}: {
  description: string;
  icon: typeof Radar;
  label: string;
  tone?: "green" | "purple" | "red";
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-border px-3 py-3 last:border-b-0 sm:px-4 md:border-b-0 md:border-r md:last:border-r-0">
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-full ${
          tone === "green"
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
            : tone === "red"
              ? "bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-300"
              : "bg-primary/10 text-primary"
        }`}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">
          {value}
        </span>
        <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground/80">
          {description}
        </span>
      </span>
    </div>
  );
}

function CountPill({
  label,
  tone = "muted",
  value,
}: {
  label: string;
  tone?: "muted" | "red" | "green";
  value: number;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        tone === "red"
          ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"
          : tone === "green"
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
            : "bg-muted text-muted-foreground"
      }`}
    >
      <span>{value}</span>
      <span>{label}</span>
    </span>
  );
}

function AgencyListingActivityCell({
  row,
}: {
  row: AgencyBuyerActivityOverviewRow;
}) {
  const coverImageUrl = toPublicMediaUrl(row.cover_image_url);
  const agents = assignedAgents(row.assigned_agents);
  const leadAgent = agents.find((agent) => agent.role === "lead") || agents[0];

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="size-14 shrink-0 overflow-hidden rounded-md bg-muted/70">
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Listing preview image.
          <img src={coverImageUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center bg-primary/10 text-primary">
            <Radar className="size-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{row.title}</p>
        {row.location ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.location}
          </p>
        ) : null}
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
          <CountPill
            label="viewing"
            tone={row.active_viewer_count > 0 ? "green" : "muted"}
            value={row.active_viewer_count}
          />
          <CountPill
            label="new"
            tone={row.unread_viewer_count > 0 ? "red" : "muted"}
            value={row.unread_viewer_count}
          />
          <CountPill
            label={row.activity_count === 1 ? "event" : "events"}
            value={row.activity_count}
          />
          {row.price_label ? (
            <span className="truncate text-[11px] font-normal text-muted-foreground">
              {row.price_label}
            </span>
          ) : null}
        </div>
        {leadAgent ? (
          <div className="mt-2 flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
            <AgentProfileAvatar
              avatarUrl={leadAgent.avatarUrl}
              name={leadAgent.name}
              size="sm"
            />
            <span className="truncate">
              {leadAgent.name}
              {agents.length > 1 ? ` +${agents.length - 1}` : ""}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default async function AgencyBuyerActivityPage({
  params,
  searchParams,
}: AgencyBuyerActivityPageProps) {
  const { workspaceKind } = await params;
  const kind = parseControlRoomKind(workspaceKind);

  if (!kind) {
    notFound();
  }

  if (kind === "networkhq") {
    redirect("/controlroom/networkhq");
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect(`/sign-in?callbackUrl=/controlroom/${kind}/buyer-activity`);
  }

  const access = await getAgencyBuyerActivityAccessForUser(userId);

  if (!access) {
    notFound();
  }

  const query = searchParams ? await searchParams : {};
  const currentPage = parsePage(query.page);
  const pageSize = 25;
  const offset = (currentPage - 1) * pageSize;

  const [countRows, listingRows, analyticsRows] = await Promise.all([
    sql<{ total_rows: number }[]>`
      SELECT count(*)::int AS total_rows
      FROM property_listings
      WHERE agency_id = ${access.agencyId}
        AND status = 'published'
        AND archived_at IS NULL
    `,
    sql<AgencyBuyerActivityOverviewRow[]>`
      WITH listing_page AS (
        SELECT
          id,
          title,
          location,
          cover_image_url,
          price_label,
          status,
          listed_at,
          created_at
        FROM property_listings
        WHERE agency_id = ${access.agencyId}
          AND status = 'published'
          AND archived_at IS NULL
        ORDER BY listed_at DESC NULLS LAST, created_at DESC
        LIMIT ${pageSize}
        OFFSET ${offset}
      ),
      assigned_agents AS (
        SELECT
          pla.listing_id,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'avatarUrl', u.avatar_url,
                'name', u.name,
                'role', pla.role,
                'userId', u.id,
                'username', u.username
              )
              ORDER BY
                CASE pla.role WHEN 'lead' THEN 0 ELSE 1 END,
                pla.sort_order ASC,
                pla.created_at ASC
            ) FILTER (WHERE u.id IS NOT NULL),
            '[]'::jsonb
          ) AS agents
        FROM property_listing_agents pla
        INNER JOIN users u ON u.id = pla.user_id
        INNER JOIN listing_page lp ON lp.id = pla.listing_id
        WHERE pla.removed_at IS NULL
        GROUP BY pla.listing_id
      ),
      activity_rows AS (
        SELECT
          lve.listing_id,
          'view'::text AS activity_type,
          NULL::text AS action_type,
          lve.created_at,
          lve.viewer_user_id,
          lve.viewer_session_id,
          coalesce(lve.view_instance_id, lve.viewer_session_id) AS view_key,
          coalesce(lve.viewer_user_id::text, lve.viewer_session_id) AS viewer_key
        FROM listing_view_events lve
        JOIN listing_page lp ON lp.id = lve.listing_id
        WHERE lve.viewer_user_id IS NULL OR (
          lve.viewer_user_id <> ${userId}
          AND NOT EXISTS (
            SELECT 1
            FROM agency_members am
            WHERE am.agency_id = ${access.agencyId}
              AND am.user_id = lve.viewer_user_id
              AND am.status = 'active'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM agency_employees ae
            WHERE ae.agency_id = ${access.agencyId}
              AND ae.user_id = lve.viewer_user_id
              AND ae.status = 'active'
          )
        )
        UNION ALL
        SELECT
          lae.listing_id,
          'action'::text AS activity_type,
          lae.action_type,
          lae.created_at,
          lae.viewer_user_id,
          lae.viewer_session_id,
          NULL::text AS view_key,
          coalesce(lae.viewer_user_id::text, lae.viewer_session_id) AS viewer_key
        FROM listing_action_events lae
        JOIN listing_page lp ON lp.id = lae.listing_id
        WHERE lae.viewer_user_id IS NULL OR (
          lae.viewer_user_id <> ${userId}
          AND NOT EXISTS (
            SELECT 1
            FROM agency_members am
            WHERE am.agency_id = ${access.agencyId}
              AND am.user_id = lae.viewer_user_id
              AND am.status = 'active'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM agency_employees ae
            WHERE ae.agency_id = ${access.agencyId}
              AND ae.user_id = lae.viewer_user_id
              AND ae.status = 'active'
          )
        )
      ),
      activity_stats AS (
        SELECT
          listing_id,
          count(*)::int AS activity_count,
          count(*) FILTER (WHERE activity_type = 'action')::int AS action_count,
          count(DISTINCT view_key) FILTER (WHERE activity_type = 'view')::int AS view_count,
          max(created_at) AS latest_seen_at
        FROM activity_rows
        GROUP BY listing_id
      ),
      latest_event AS (
        SELECT DISTINCT ON (ar.listing_id)
          ar.listing_id,
          ar.activity_type,
          ar.action_type,
          ar.created_at,
          u.name AS actor_name
        FROM activity_rows ar
        LEFT JOIN users u ON u.id = ar.viewer_user_id
        ORDER BY ar.listing_id, ar.created_at DESC
      ),
      viewer_latest AS (
        SELECT
          listing_id,
          viewer_key,
          max(created_at) AS latest_seen_at
        FROM activity_rows
        WHERE viewer_key IS NOT NULL
        GROUP BY listing_id, viewer_key
      ),
      unread_stats AS (
        SELECT
          vl.listing_id,
          count(*) FILTER (
            WHERE lar.last_read_at IS NULL OR vl.latest_seen_at > lar.last_read_at
          )::int AS unread_viewer_count
        FROM viewer_latest vl
        LEFT JOIN listing_activity_reads lar
          ON lar.listing_id = vl.listing_id
          AND lar.owner_user_id = ${userId}
          AND lar.viewer_key = vl.viewer_key
        GROUP BY vl.listing_id
      ),
      presence_stats AS (
        SELECT
          lps.listing_id,
          count(DISTINCT lps.viewer_session_id)::int AS active_viewer_count,
          count(DISTINCT lps.viewer_user_id) FILTER (WHERE lps.viewer_user_id IS NOT NULL)::int AS active_buyer_count
        FROM listing_presence_sessions lps
        JOIN listing_page lp ON lp.id = lps.listing_id
        WHERE lps.expires_at > now()
          AND (
            lps.viewer_user_id IS NULL OR (
              lps.viewer_user_id <> ${userId}
              AND NOT EXISTS (
                SELECT 1
                FROM agency_members am
                WHERE am.agency_id = ${access.agencyId}
                  AND am.user_id = lps.viewer_user_id
                  AND am.status = 'active'
              )
              AND NOT EXISTS (
                SELECT 1
                FROM agency_employees ae
                WHERE ae.agency_id = ${access.agencyId}
                  AND ae.user_id = lps.viewer_user_id
                  AND ae.status = 'active'
              )
            )
          )
        GROUP BY lps.listing_id
      )
      SELECT
        lp.id,
        lp.title,
        lp.location,
        lp.cover_image_url,
        lp.price_label,
        lp.status,
        lp.listed_at,
        coalesce(aa.agents, '[]'::jsonb) AS assigned_agents,
        coalesce(ast.activity_count, 0)::int AS activity_count,
        coalesce(ast.action_count, 0)::int AS action_count,
        coalesce(ast.view_count, 0)::int AS view_count,
        ast.latest_seen_at,
        le.activity_type AS latest_activity_type,
        le.action_type AS latest_action_type,
        le.actor_name AS latest_actor_name,
        coalesce(us.unread_viewer_count, 0)::int AS unread_viewer_count,
        coalesce(ps.active_viewer_count, 0)::int AS active_viewer_count,
        coalesce(ps.active_buyer_count, 0)::int AS active_buyer_count
      FROM listing_page lp
      LEFT JOIN assigned_agents aa ON aa.listing_id = lp.id
      LEFT JOIN activity_stats ast ON ast.listing_id = lp.id
      LEFT JOIN latest_event le ON le.listing_id = lp.id
      LEFT JOIN unread_stats us ON us.listing_id = lp.id
      LEFT JOIN presence_stats ps ON ps.listing_id = lp.id
      ORDER BY
        coalesce(us.unread_viewer_count, 0) DESC,
        coalesce(ps.active_viewer_count, 0) DESC,
        ast.latest_seen_at DESC NULLS LAST,
        lp.listed_at DESC NULLS LAST
    `,
    sql<AgencyBuyerActivityAnalyticsRow[]>`
      WITH agency_listings AS (
        SELECT id
        FROM property_listings
        WHERE agency_id = ${access.agencyId}
          AND status = 'published'
          AND archived_at IS NULL
      ),
      activity_rows AS (
        SELECT
          lve.listing_id,
          lve.viewer_user_id,
          lve.viewer_session_id,
          coalesce(lve.view_instance_id, lve.viewer_session_id) AS view_key,
          coalesce(lve.viewer_user_id::text, lve.viewer_session_id) AS viewer_key,
          lve.created_at,
          'view'::text AS activity_type
        FROM listing_view_events lve
        JOIN agency_listings al ON al.id = lve.listing_id
        WHERE lve.viewer_user_id IS NULL OR (
          lve.viewer_user_id <> ${userId}
          AND NOT EXISTS (
            SELECT 1
            FROM agency_members am
            WHERE am.agency_id = ${access.agencyId}
              AND am.user_id = lve.viewer_user_id
              AND am.status = 'active'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM agency_employees ae
            WHERE ae.agency_id = ${access.agencyId}
              AND ae.user_id = lve.viewer_user_id
              AND ae.status = 'active'
          )
        )
        UNION ALL
        SELECT
          lae.listing_id,
          lae.viewer_user_id,
          lae.viewer_session_id,
          NULL::text AS view_key,
          coalesce(lae.viewer_user_id::text, lae.viewer_session_id) AS viewer_key,
          lae.created_at,
          'action'::text AS activity_type
        FROM listing_action_events lae
        JOIN agency_listings al ON al.id = lae.listing_id
        WHERE lae.viewer_user_id IS NULL OR (
          lae.viewer_user_id <> ${userId}
          AND NOT EXISTS (
            SELECT 1
            FROM agency_members am
            WHERE am.agency_id = ${access.agencyId}
              AND am.user_id = lae.viewer_user_id
              AND am.status = 'active'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM agency_employees ae
            WHERE ae.agency_id = ${access.agencyId}
              AND ae.user_id = lae.viewer_user_id
              AND ae.status = 'active'
          )
        )
      ),
      viewer_latest AS (
        SELECT listing_id, viewer_key, max(created_at) AS latest_seen_at
        FROM activity_rows
        WHERE viewer_key IS NOT NULL
        GROUP BY listing_id, viewer_key
      ),
      unread_stats AS (
        SELECT count(*) FILTER (
          WHERE lar.last_read_at IS NULL OR vl.latest_seen_at > lar.last_read_at
        )::int AS unread_viewer_count
        FROM viewer_latest vl
        LEFT JOIN listing_activity_reads lar
          ON lar.listing_id = vl.listing_id
          AND lar.owner_user_id = ${userId}
          AND lar.viewer_key = vl.viewer_key
      ),
      presence_stats AS (
        SELECT
          count(DISTINCT lps.viewer_session_id)::int AS active_viewer_count,
          count(DISTINCT lps.viewer_user_id) FILTER (WHERE lps.viewer_user_id IS NOT NULL)::int AS active_buyer_count
        FROM listing_presence_sessions lps
        JOIN agency_listings al ON al.id = lps.listing_id
        WHERE lps.expires_at > now()
          AND (
            lps.viewer_user_id IS NULL OR (
              lps.viewer_user_id <> ${userId}
              AND NOT EXISTS (
                SELECT 1
                FROM agency_members am
                WHERE am.agency_id = ${access.agencyId}
                  AND am.user_id = lps.viewer_user_id
                  AND am.status = 'active'
              )
              AND NOT EXISTS (
                SELECT 1
                FROM agency_employees ae
                WHERE ae.agency_id = ${access.agencyId}
                  AND ae.user_id = lps.viewer_user_id
                  AND ae.status = 'active'
              )
            )
          )
      ),
      view_stats AS (
        SELECT
          count(DISTINCT coalesce(lve.view_instance_id, lve.viewer_session_id)) FILTER (
            WHERE lve.created_at >= now() - interval '24 hours'
          )::int AS total_views_24h,
          count(DISTINCT coalesce(lve.view_instance_id, lve.viewer_session_id)) FILTER (
            WHERE lve.created_at >= now() - interval '48 hours'
              AND lve.created_at < now() - interval '24 hours'
          )::int AS previous_views_24h
        FROM listing_view_events lve
        JOIN agency_listings al ON al.id = lve.listing_id
        WHERE lve.viewer_user_id IS NULL OR (
          lve.viewer_user_id <> ${userId}
          AND NOT EXISTS (
            SELECT 1
            FROM agency_members am
            WHERE am.agency_id = ${access.agencyId}
              AND am.user_id = lve.viewer_user_id
              AND am.status = 'active'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM agency_employees ae
            WHERE ae.agency_id = ${access.agencyId}
              AND ae.user_id = lve.viewer_user_id
              AND ae.status = 'active'
          )
        )
      )
      SELECT
        coalesce(ps.active_viewer_count, 0)::int AS active_viewer_count,
        coalesce(ps.active_buyer_count, 0)::int AS active_buyer_count,
        coalesce(us.unread_viewer_count, 0)::int AS unread_viewer_count,
        coalesce(vs.total_views_24h, 0)::int AS total_views_24h,
        coalesce(vs.previous_views_24h, 0)::int AS previous_views_24h
      FROM presence_stats ps
      CROSS JOIN unread_stats us
      CROSS JOIN view_stats vs
    `,
  ]);

  const totalRows = countRows[0]?.total_rows || 0;
  const analytics = analyticsRows[0] || {
    active_buyer_count: 0,
    active_viewer_count: 0,
    previous_views_24h: 0,
    total_views_24h: 0,
    unread_viewer_count: 0,
  };
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const firstRow = totalRows ? offset + 1 : 0;
  const lastRow = Math.min(offset + listingRows.length, totalRows);
  const trend = formatTrend(analytics.total_views_24h, analytics.previous_views_24h);
  const TrendIcon = trend.direction === "down" ? TrendingDown : TrendingUp;
  const columns: Array<CanonicalTableColumn<AgencyBuyerActivityOverviewRow>> = [
    {
      className: "w-full md:w-[42%]",
      header: "Listing",
      key: "listing",
      render: (row) => <AgencyListingActivityCell row={row} />,
    },
    {
      className: "hidden md:table-cell md:w-[14%] md:px-4",
      header: "Active",
      key: "active",
      render: (row) => (
        <>
          <TruncatedText title={plural(row.active_viewer_count, "viewer")}>
            {row.active_viewer_count}
            <span className="hidden md:inline"> active</span>
          </TruncatedText>
          <TruncatedText
            title={plural(row.active_buyer_count, "signed-in buyer", "signed-in buyers")}
            className="mt-0.5 hidden text-xs text-muted-foreground md:block"
          >
            {plural(row.active_buyer_count, "buyer")}
          </TruncatedText>
        </>
      ),
    },
    {
      className: "hidden md:table-cell md:w-[10%] md:px-4",
      header: "New",
      key: "new",
      render: (row) =>
        row.unread_viewer_count > 0 ? (
          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-red-500 px-2 py-1 text-[10px] font-semibold text-white">
            {row.unread_viewer_count}
          </span>
        ) : (
          <span className="text-xs font-normal text-muted-foreground">-</span>
        ),
    },
    {
      className: "hidden w-[24%] md:table-cell",
      header: "Latest",
      key: "latest",
      render: (row) => {
        const label = latestEventLabel(row);
        const badge = row.latest_activity_type
          ? activityBadge({
              action_type: row.latest_action_type,
              activity_type: row.latest_activity_type,
            })
          : "No activity";

        return (
          <>
            <TruncatedText title={label}>{label}</TruncatedText>
            <TruncatedText title={badge} className="mt-0.5 text-xs text-muted-foreground">
              {badge}
            </TruncatedText>
          </>
        );
      },
    },
    {
      className: "hidden w-[13%] lg:table-cell",
      header: "Last active",
      key: "last-active",
      render: (row) => {
        const label =
          row.active_viewer_count > 0
            ? "Active now"
            : formatDateTime(row.latest_seen_at);

        return (
          <TruncatedText title={label} className="text-muted-foreground">
            {label}
          </TruncatedText>
        );
      },
    },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-10 text-foreground lg:px-8">
      <section className="border-b border-border pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <Radar className="size-4" />
              Agency buyer activity
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight lg:text-5xl">
              Buyer Activity
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-normal leading-6 text-muted-foreground">
              Monitor buyer activity across published listings linked to{" "}
              {access.agencyName}. Internal agency member and employee views are
              excluded where we can identify them.
            </p>
          </div>
          <ActivityRealtimeRefresh />
        </div>
      </section>

      <section className="mt-5 grid overflow-hidden rounded-lg border border-border bg-card shadow-sm md:grid-cols-4">
        <AnalyticsStat
          description="Across agency-linked listings"
          icon={UsersRound}
          label="Potential buyers active now"
          tone={analytics.active_viewer_count > 0 ? "green" : "purple"}
          value={plural(analytics.active_viewer_count, "viewer")}
        />
        <AnalyticsStat
          description={plural(analytics.active_buyer_count, "signed-in buyer", "signed-in buyers")}
          icon={Radar}
          label="Signed-in buyers active"
          tone={analytics.active_buyer_count > 0 ? "green" : "purple"}
          value={plural(analytics.active_buyer_count, "buyer")}
        />
        <AnalyticsStat
          description="Unread buyer groups for you"
          icon={Eye}
          label="New listing activity"
          tone={analytics.unread_viewer_count > 0 ? "red" : "purple"}
          value={`${analytics.unread_viewer_count} new`}
        />
        <AnalyticsStat
          description={trend.label}
          icon={TrendIcon}
          label="Listing views"
          tone={
            trend.direction === "down"
              ? "red"
              : trend.direction === "up"
                ? "green"
                : "purple"
          }
          value={plural(analytics.total_views_24h, "view")}
        />
      </section>

      <section className="mt-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Showing {firstRow}-{lastRow} of {totalRows} listings
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <form action={clearAgencyBuyerActivityAction}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={analytics.unread_viewer_count <= 0}
                className="h-8 rounded-full px-3 text-xs"
              >
                Clear all
              </Button>
            </form>
            <Button asChild variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs">
              <Link href={`${access.basePath}/listings`}>Manage listings</Link>
            </Button>
            <p className="text-xs font-normal text-muted-foreground">
              Page {safeCurrentPage} of {totalPages}
            </p>
          </div>
        </div>

        <CanonicalTable
          columns={columns}
          emptyState="No published agency listings have recorded buyer activity yet."
          getRowHref={(row) => `/listings/${row.id}/activity?from=controlroom`}
          getRowKey={(row) => row.id}
          minWidth="0"
          pagination={{
            currentPage: safeCurrentPage,
            hrefForPage: (page) =>
              page > 1
                ? `${access.basePath}/buyer-activity?page=${page}`
                : `${access.basePath}/buyer-activity`,
            manual: true,
            pageSize,
            totalItems: totalRows,
          }}
          rows={listingRows}
          tableClassName="table-fixed text-xs md:text-sm"
        />
      </section>
    </main>
  );
}
