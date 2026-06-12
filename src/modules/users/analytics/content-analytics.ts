import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { sql } from "@/db";
import { authOptions } from "@/modules/auth/config";
import { normalizeUsername } from "@/modules/auth/username";
import { buildListingPath } from "@/modules/listings/seo";
import { toPublicMediaUrl } from "@/media/paths";

export type ContentAnalyticsTab = "listings" | "reels";
export type AnalyticsRangeKey = "7d" | "30d" | "90d" | "12m" | "all";

export type AnalyticsRange = {
  key: AnalyticsRangeKey;
  label: string;
  shortLabel: string;
  startAt: Date | null;
};

export type AnalyticsTrendPoint = {
  clicks: number;
  date: string;
  hovers: number;
  impressions: number;
  label: string;
  saves: number;
  shares: number;
  total: number;
};

export type AnalyticsProfile = {
  avatarUrl: string | null;
  id: string;
  name: string;
  username: string;
};

export type AnalyticsBreakdownRow = {
  count: number;
  description: string;
  label: string;
};

export type ListingAnalyticsRow = {
  actionCount: number;
  clickCount: number;
  contactCount: number;
  followCount: number;
  hoverCount: number;
  href: string;
  id: string;
  impressionCount: number;
  lastActivityAt: string | null;
  likeCount: number;
  location: string | null;
  priceLabel: string;
  reserveCount: number;
  saveCount: number;
  shareCount: number;
  status: string;
  title: string;
  viewCount: number;
};

export type ReelAnalyticsRow = {
  averageProgressPercent: number;
  averageWatchSeconds: number;
  caption: string;
  clickCount: number;
  commentCount: number;
  completedSessions: number;
  completionRate: number;
  followCount: number;
  hoverCount: number;
  id: string;
  impressionCount: number;
  lastActivityAt: string | null;
  likeCount: number;
  saveCount: number;
  shareCount: number;
  status: string;
  thumbnailUrl: string | null;
  viewCount: number;
  watchSessions: number;
};

export type ListingAnalyticsDetail = ListingAnalyticsRow & {
  actionBreakdown: AnalyticsBreakdownRow[];
  createdAt: string | null;
  trend: AnalyticsTrendPoint[];
  updatedAt: string | null;
};

export type ReelAnalyticsDetail = ReelAnalyticsRow & {
  eventBreakdown: AnalyticsBreakdownRow[];
  createdAt: string | null;
  trend: AnalyticsTrendPoint[];
  updatedAt: string | null;
};

const analyticsRanges: Record<AnalyticsRangeKey, Omit<AnalyticsRange, "startAt"> & {
  days: number | null;
}> = {
  "7d": { days: 7, key: "7d", label: "Last 7 days", shortLabel: "7D" },
  "30d": { days: 30, key: "30d", label: "Last 30 days", shortLabel: "30D" },
  "90d": { days: 90, key: "90d", label: "Last 3 months", shortLabel: "3M" },
  "12m": { days: 365, key: "12m", label: "Last 12 months", shortLabel: "12M" },
  all: { days: null, key: "all", label: "All time", shortLabel: "All" },
};

export const analyticsRangeOptions = Object.values(analyticsRanges).map(
  (range) => ({
    key: range.key,
    label: range.label,
    shortLabel: range.shortLabel,
  }),
);

type ProfileRow = {
  avatar_url: string | null;
  id: string;
  name: string;
  username: string | null;
};

type ListingMetricsRow = {
  actions: number | string | null;
  asking_price_cents: number | null;
  clicks: number | string | null;
  contacts: number | string | null;
  details: unknown;
  hovers: number | string | null;
  id: string;
  last_activity_at: string | null;
  likes: number | string | null;
  listing_type: string;
  location: string | null;
  property_type: string;
  reserves: number | string | null;
  saves: number | string | null;
  shares: number | string | null;
  status: string;
  title: string;
  updated_at: string | null;
  views: number | string | null;
};

type ReelMetricsRow = {
  average_progress_percent: number | string | null;
  average_watch_seconds: number | string | null;
  caption: string | null;
  clicks: number | string | null;
  comments: number | string | null;
  completed_sessions: number | string | null;
  edit_metadata: unknown;
  event_count: number | string | null;
  follows: number | string | null;
  hovers: number | string | null;
  id: string;
  impressions: number | string | null;
  last_activity_at: string | null;
  likes: number | string | null;
  saves: number | string | null;
  shares: number | string | null;
  status: string;
  updated_at: string | null;
  view_count: number | null;
  watch_sessions: number | string | null;
};

function numberFrom(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function dateString(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
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

function buildTrendPoints(
  rows: Array<{ bucket: string | null; metric: string | null; total: number | string | null }>,
  range: AnalyticsRange,
) {
  const today = new Date();
  const start =
    range.startAt ||
    (rows.length
      ? new Date(`${rows[0].bucket}T00:00:00.000Z`)
      : addDays(today, -29));
  const end = today;
  const dayCount = Math.max(
    1,
    Math.min(
      366,
      Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1,
    ),
  );
  const buckets = new Map<string, AnalyticsTrendPoint>();

  for (let index = 0; index < dayCount; index += 1) {
    const date = isoDate(addDays(start, index));
    buckets.set(date, {
      clicks: 0,
      date,
      hovers: 0,
      impressions: 0,
      label: shortDateLabel(date),
      saves: 0,
      shares: 0,
      total: 0,
    });
  }

  rows.forEach((row) => {
    if (!row.bucket) return;

    const point =
      buckets.get(row.bucket) ||
      ({
        clicks: 0,
        date: row.bucket,
        hovers: 0,
        impressions: 0,
        label: shortDateLabel(row.bucket),
        saves: 0,
        shares: 0,
        total: 0,
      } satisfies AnalyticsTrendPoint);
    const total = numberFrom(row.total);

    if (row.metric === "impressions") point.impressions += total;
    if (row.metric === "hovers") point.hovers += total;
    if (row.metric === "clicks") point.clicks += total;
    if (row.metric === "saves") point.saves += total;
    if (row.metric === "shares") point.shares += total;

    point.total =
      point.impressions + point.hovers + point.clicks + point.saves + point.shares;
    buckets.set(row.bucket, point);
  });

  const points = Array.from(buckets.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  if (points.length <= 32) return points;

  const step = Math.ceil(points.length / 32);
  const compacted: AnalyticsTrendPoint[] = [];

  for (let index = 0; index < points.length; index += step) {
    const slice = points.slice(index, index + step);
    const first = slice[0];

    compacted.push({
      clicks: slice.reduce((total, point) => total + point.clicks, 0),
      date: first.date,
      hovers: slice.reduce((total, point) => total + point.hovers, 0),
      impressions: slice.reduce((total, point) => total + point.impressions, 0),
      label: first.label,
      saves: slice.reduce((total, point) => total + point.saves, 0),
      shares: slice.reduce((total, point) => total + point.shares, 0),
      total: slice.reduce((total, point) => total + point.total, 0),
    });
  }

  return compacted;
}

function objectFrom(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function listingNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatZar(cents: number | null) {
  if (!cents) return "Price not set";

  return new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
}

function formatLabel(value: string) {
  if (value === "buy_now" || value === "reserve_now") return "Reserve Now";
  if (value === "view") return "Plays";
  if (value === "progress") return "Watch updates";
  if (value === "complete") return "Completed plays";

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function breakdownDescription(value: string) {
  const descriptions: Record<string, string> = {
    bond_calculator:
      "A visitor opened the bond calculator from this listing.",
    buy_now:
      "A legacy reserve-now click recorded before this action was renamed.",
    call_agent:
      "A visitor tapped the phone action to contact the agent.",
    card_click:
      "A visitor opened this listing from a card or preview surface.",
    click:
      "A visitor opened this reel from a preview card or linked surface.",
    complete:
      "A play session reached the end, or close enough to count as completed.",
    contact_agent:
      "A visitor started a contact flow from this listing.",
    email_agent:
      "A visitor tapped the email action to contact the agent.",
    follow:
      "A visitor followed the agent from this content.",
    hover:
      "A visitor paused over this content long enough to count as intent.",
    impression:
      "This content appeared on screen in a feed, card, or preview surface.",
    place_offer:
      "A visitor started the offer flow for this listing.",
    progress:
      "A playback heartbeat while someone is watching. This measures continued viewing, not separate plays.",
    reserve_now:
      "A visitor started the reserve-now flow for this listing.",
    save:
      "A visitor saved this content.",
    share:
      "A visitor used a share action for this content.",
    view:
      "A reel play recorded when the reel became visible and playback started.",
    whatsapp_agent:
      "A visitor tapped the WhatsApp action to contact the agent.",
  };

  return descriptions[value] || "An interaction recorded for this content.";
}

function mergeBreakdownRows(rows: AnalyticsBreakdownRow[]) {
  const merged = new Map<string, AnalyticsBreakdownRow>();

  rows.forEach((row) => {
    const current = merged.get(row.label);

    merged.set(row.label, {
      count: (current?.count || 0) + row.count,
      description: current?.description || row.description,
      label: row.label,
    });
  });

  return Array.from(merged.values()).sort((first, second) => {
    if (second.count !== first.count) return second.count - first.count;
    return first.label.localeCompare(second.label);
  });
}

function reelThumbnailUrl(editMetadata: unknown) {
  const metadata = objectFrom(editMetadata);
  const coverFrame = objectFrom(metadata.coverFrame);
  const render = objectFrom(metadata.render);

  if (typeof coverFrame.src === "string") return coverFrame.src;
  if (typeof render.mediaPath === "string") return toPublicMediaUrl(render.mediaPath);

  return null;
}

function listingHref(row: ListingMetricsRow) {
  const details = objectFrom(row.details);

  return buildListingPath({
    bedrooms: listingNumber(details.bedrooms),
    city: typeof details.city === "string" ? details.city : "",
    country: typeof details.country === "string" ? details.country : "",
    id: row.id,
    listingType: row.listing_type,
    location: row.location,
    propertyType: row.property_type,
    province:
      (typeof details.province === "string" ? details.province : "") ||
      (typeof details.state === "string" ? details.state : "") ||
      (typeof details.region === "string" ? details.region : ""),
    suburb: typeof details.suburb === "string" ? details.suburb : "",
    title: row.title,
  });
}

function mapListingRow(row: ListingMetricsRow): ListingAnalyticsRow {
  const saveCount = numberFrom(row.saves);
  const shareCount = numberFrom(row.shares);
  const contactCount = numberFrom(row.contacts);
  const reserveCount = numberFrom(row.reserves);
  const actionCount = numberFrom(row.actions);

  return {
    actionCount,
    clickCount:
      numberFrom(row.clicks) || contactCount + reserveCount + numberFrom(row.likes),
    contactCount,
    followCount: 0,
    hoverCount: numberFrom(row.hovers),
    href: listingHref(row),
    id: row.id,
    impressionCount: numberFrom(row.views),
    lastActivityAt: dateString(row.last_activity_at) || dateString(row.updated_at),
    likeCount: numberFrom(row.likes),
    location: row.location,
    priceLabel: formatZar(row.asking_price_cents),
    reserveCount,
    saveCount,
    shareCount,
    status: row.status,
    title: row.title,
    viewCount: numberFrom(row.views),
  };
}

function mapReelRow(row: ReelMetricsRow): ReelAnalyticsRow {
  const watchSessions = numberFrom(row.watch_sessions);
  const completedSessions = numberFrom(row.completed_sessions);

  return {
    averageProgressPercent: Math.round(numberFrom(row.average_progress_percent)),
    averageWatchSeconds: Math.round(numberFrom(row.average_watch_seconds)),
    caption: row.caption || "Untitled reel",
    clickCount: numberFrom(row.clicks),
    commentCount: numberFrom(row.comments),
    completedSessions,
    completionRate: watchSessions
      ? Math.round((completedSessions / watchSessions) * 100)
      : 0,
    followCount: numberFrom(row.follows),
    hoverCount: numberFrom(row.hovers),
    id: row.id,
    impressionCount:
      numberFrom(row.impressions) ||
      numberFrom(row.event_count) ||
      numberFrom(row.view_count),
    lastActivityAt: dateString(row.last_activity_at) || dateString(row.updated_at),
    likeCount: numberFrom(row.likes),
    saveCount: numberFrom(row.saves),
    shareCount: numberFrom(row.shares),
    status: row.status,
    thumbnailUrl: reelThumbnailUrl(row.edit_metadata),
    viewCount: numberFrom(row.view_count),
    watchSessions,
  };
}

export function formatMetric(value: number) {
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(value);
}

export function formatAnalyticsDate(value: string | null) {
  if (!value) return "Not yet";

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function parseAnalyticsTab(value: unknown): ContentAnalyticsTab {
  return value === "reels" ? "reels" : "listings";
}

export function parseAnalyticsRange(value: unknown): AnalyticsRange {
  const key =
    typeof value === "string" && value in analyticsRanges
      ? (value as AnalyticsRangeKey)
      : "30d";
  const range = analyticsRanges[key];
  const startAt = range.days
    ? new Date(Date.now() - (range.days - 1) * 86_400_000)
    : null;

  if (startAt) {
    startAt.setUTCHours(0, 0, 0, 0);
  }

  return {
    key: range.key,
    label: range.label,
    shortLabel: range.shortLabel,
    startAt,
  };
}

export async function getOwnerAnalyticsProfile(usernameParam: string) {
  const username = normalizeUsername(usernameParam);

  if (!username) notFound();

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=/users/${username}/analytics`);
  }

  const [profile] = await sql<ProfileRow[]>`
    SELECT id, name, username, avatar_url
    FROM users
    WHERE username = ${username}
      AND status = 'active'
      AND profile_visible = true
    LIMIT 1
  `;

  if (!profile?.username) notFound();
  if (profile.id !== session.user.id) redirect(`/users/${profile.username}`);

  return {
    avatarUrl: profile.avatar_url,
    id: profile.id,
    name: profile.name,
    username: profile.username,
  } satisfies AnalyticsProfile;
}

export async function getListingAnalyticsRows(
  userId: string,
  range: AnalyticsRange = parseAnalyticsRange("30d"),
) {
  const rangeStart = range.startAt?.toISOString() || null;
  const rows = await sql<ListingMetricsRow[]>`
    SELECT
      pl.id,
      pl.title,
      pl.location,
      pl.status,
      pl.asking_price_cents,
      pl.details,
      pl.listing_type,
      pl.property_type,
      pl.updated_at::text,
      COUNT(DISTINCT lve.id)::int AS views,
      COUNT(DISTINCT lae.id)::int AS actions,
      COUNT(DISTINCT CASE WHEN lae.action_type IN ('contact_agent', 'call_agent', 'email_agent', 'whatsapp_agent') THEN lae.id END)::int AS contacts,
      COUNT(DISTINCT CASE WHEN lae.action_type IN ('card_click', 'contact_agent', 'call_agent', 'email_agent', 'whatsapp_agent', 'place_offer', 'reserve_now', 'buy_now', 'bond_calculator') THEN lae.id END)::int AS clicks,
      COUNT(DISTINCT CASE WHEN lae.action_type = 'hover' THEN lae.id END)::int AS hovers,
      COUNT(DISTINCT CASE WHEN lae.action_type IN ('reserve_now', 'buy_now') THEN lae.id END)::int AS reserves,
      COUNT(DISTINCT CASE WHEN lae.action_type = 'share' THEN lae.id END)::int AS shares,
      COUNT(DISTINCT ll.user_id)::int AS likes,
      COUNT(DISTINCT ls.user_id)::int AS saves,
      GREATEST(MAX(lve.created_at), MAX(lae.created_at), pl.updated_at)::text AS last_activity_at
    FROM property_listings pl
    LEFT JOIN listing_view_events lve ON lve.listing_id = pl.id
      AND (${rangeStart}::timestamptz IS NULL OR lve.created_at >= ${rangeStart})
    LEFT JOIN listing_action_events lae ON lae.listing_id = pl.id
      AND (${rangeStart}::timestamptz IS NULL OR lae.created_at >= ${rangeStart})
    LEFT JOIN listing_likes ll ON ll.listing_id = pl.id
      AND (${rangeStart}::timestamptz IS NULL OR ll.created_at >= ${rangeStart})
    LEFT JOIN listing_saves ls ON ls.listing_id = pl.id
      AND (${rangeStart}::timestamptz IS NULL OR ls.created_at >= ${rangeStart})
    WHERE pl.user_id = ${userId}
    GROUP BY pl.id
    ORDER BY last_activity_at DESC NULLS LAST, pl.updated_at DESC
  `;

  return rows.map(mapListingRow);
}

export async function getReelAnalyticsRows(
  userId: string,
  range: AnalyticsRange = parseAnalyticsRange("30d"),
) {
  const rangeStart = range.startAt?.toISOString() || null;
  const rows = await sql<ReelMetricsRow[]>`
    SELECT
      r.id,
      r.caption,
      r.status,
      r.view_count,
      r.edit_metadata,
      r.updated_at::text,
      GREATEST(
        COUNT(DISTINCT rws.id)::int,
        COUNT(DISTINCT CASE WHEN rwe.event_type IN ('view', 'progress', 'complete') THEN rwe.viewer_session_id END)::int
      ) AS watch_sessions,
      GREATEST(
        COUNT(DISTINCT CASE WHEN rws.completed THEN rws.id END)::int,
        COUNT(DISTINCT CASE WHEN rwe.event_type = 'complete' THEN rwe.viewer_session_id END)::int
      ) AS completed_sessions,
      ROUND(GREATEST(
        COALESCE(AVG(rws.max_progress_percent), 0),
        COALESCE(AVG(CASE WHEN rwe.event_type IN ('view', 'progress', 'complete') THEN rwe.progress_percent END), 0)
      ))::int AS average_progress_percent,
      ROUND(
        CASE
          WHEN COUNT(DISTINCT rws.id) > 0 THEN COALESCE(AVG(
            CASE
              WHEN rws.duration_seconds > 0 THEN LEAST(rws.total_watch_seconds, rws.duration_seconds)
              ELSE rws.total_watch_seconds
            END
          ), 0)
          ELSE COALESCE(AVG(
            CASE
              WHEN rwe.event_type IN ('progress', 'complete') AND rwe.duration_seconds > 0 THEN LEAST(rwe.progress_seconds, rwe.duration_seconds)
              WHEN rwe.event_type IN ('progress', 'complete') THEN rwe.progress_seconds
              ELSE NULL
            END
          ), 0)
        END
      )::int AS average_watch_seconds,
      COUNT(DISTINCT rwe.id)::int AS event_count,
      COUNT(DISTINCT CASE WHEN rwe.event_type = 'impression' THEN rwe.id END)::int AS impressions,
      COUNT(DISTINCT CASE WHEN rwe.event_type = 'hover' THEN rwe.id END)::int AS hovers,
      COUNT(DISTINCT rlc.id)::int + COUNT(DISTINCT CASE WHEN rwe.event_type = 'click' THEN rwe.id END)::int AS clicks,
      COUNT(DISTINCT CASE WHEN rwe.event_type = 'follow' THEN rwe.id END)::int AS follows,
      COUNT(DISTINCT rl.user_id)::int AS likes,
      COUNT(DISTINCT rs.user_id)::int AS saves,
      COUNT(DISTINCT rr.user_id)::int + COUNT(DISTINCT CASE WHEN rwe.event_type = 'share' THEN rwe.id END)::int AS shares,
      COUNT(DISTINCT rc.id)::int AS comments,
      GREATEST(MAX(rws.last_watched_at), MAX(rwe.created_at), MAX(rlc.created_at), MAX(rr.created_at), MAX(rc.created_at), r.updated_at)::text AS last_activity_at
    FROM reels r
    LEFT JOIN reel_watch_sessions rws ON rws.reel_id = r.id
      AND (${rangeStart}::timestamptz IS NULL OR rws.created_at >= ${rangeStart})
    LEFT JOIN reel_watch_events rwe ON rwe.reel_id = r.id
      AND (${rangeStart}::timestamptz IS NULL OR rwe.created_at >= ${rangeStart})
    LEFT JOIN reel_listing_clicks rlc ON rlc.reel_id = r.id
      AND (${rangeStart}::timestamptz IS NULL OR rlc.created_at >= ${rangeStart})
    LEFT JOIN reel_likes rl ON rl.reel_id = r.id
      AND (${rangeStart}::timestamptz IS NULL OR rl.created_at >= ${rangeStart})
    LEFT JOIN reel_saves rs ON rs.reel_id = r.id
      AND (${rangeStart}::timestamptz IS NULL OR rs.created_at >= ${rangeStart})
    LEFT JOIN reel_reshares rr ON rr.reel_id = r.id
      AND (${rangeStart}::timestamptz IS NULL OR rr.created_at >= ${rangeStart})
    LEFT JOIN reel_comments rc ON rc.reel_id = r.id
      AND (${rangeStart}::timestamptz IS NULL OR rc.created_at >= ${rangeStart})
    WHERE r.user_id = ${userId}
    GROUP BY r.id
    ORDER BY last_activity_at DESC NULLS LAST, r.updated_at DESC
  `;

  return rows.map(mapReelRow);
}

export async function getListingAnalyticsDetail(
  userId: string,
  listingId: string,
  range: AnalyticsRange = parseAnalyticsRange("30d"),
) {
  const rangeStart = range.startAt?.toISOString() || null;
  const rows = await sql<(ListingMetricsRow & {
    created_at: string | null;
  })[]>`
    SELECT
      pl.id,
      pl.title,
      pl.location,
      pl.status,
      pl.asking_price_cents,
      pl.details,
      pl.listing_type,
      pl.property_type,
      pl.created_at::text,
      pl.updated_at::text,
      COUNT(DISTINCT lve.id)::int AS views,
      COUNT(DISTINCT lae.id)::int AS actions,
      COUNT(DISTINCT CASE WHEN lae.action_type IN ('contact_agent', 'call_agent', 'email_agent', 'whatsapp_agent') THEN lae.id END)::int AS contacts,
      COUNT(DISTINCT CASE WHEN lae.action_type IN ('card_click', 'contact_agent', 'call_agent', 'email_agent', 'whatsapp_agent', 'place_offer', 'reserve_now', 'buy_now', 'bond_calculator') THEN lae.id END)::int AS clicks,
      COUNT(DISTINCT CASE WHEN lae.action_type = 'hover' THEN lae.id END)::int AS hovers,
      COUNT(DISTINCT CASE WHEN lae.action_type IN ('reserve_now', 'buy_now') THEN lae.id END)::int AS reserves,
      COUNT(DISTINCT CASE WHEN lae.action_type = 'share' THEN lae.id END)::int AS shares,
      COUNT(DISTINCT ll.user_id)::int AS likes,
      COUNT(DISTINCT ls.user_id)::int AS saves,
      GREATEST(MAX(lve.created_at), MAX(lae.created_at), pl.updated_at)::text AS last_activity_at
    FROM property_listings pl
    LEFT JOIN listing_view_events lve ON lve.listing_id = pl.id
      AND (${rangeStart}::timestamptz IS NULL OR lve.created_at >= ${rangeStart})
    LEFT JOIN listing_action_events lae ON lae.listing_id = pl.id
      AND (${rangeStart}::timestamptz IS NULL OR lae.created_at >= ${rangeStart})
    LEFT JOIN listing_likes ll ON ll.listing_id = pl.id
      AND (${rangeStart}::timestamptz IS NULL OR ll.created_at >= ${rangeStart})
    LEFT JOIN listing_saves ls ON ls.listing_id = pl.id
      AND (${rangeStart}::timestamptz IS NULL OR ls.created_at >= ${rangeStart})
    WHERE pl.user_id = ${userId}
      AND pl.id = ${listingId}
    GROUP BY pl.id
    LIMIT 1
  `;
  const row = rows[0];

  if (!row) return null;

  const breakdownRows = await sql<Array<{ action_type: string; count: number | string }>>`
    SELECT action_type, COUNT(*)::int AS count
    FROM listing_action_events
    WHERE listing_id = ${listingId}
      AND (${rangeStart}::timestamptz IS NULL OR created_at >= ${rangeStart})
    GROUP BY action_type
    ORDER BY count DESC, action_type ASC
  `;
  const trendRows = await sql<
    Array<{ bucket: string | null; metric: string | null; total: number | string | null }>
  >`
    SELECT bucket, metric, COUNT(*)::int AS total
    FROM (
      SELECT date(created_at)::text AS bucket, 'impressions' AS metric
      FROM listing_view_events
      WHERE listing_id = ${listingId}
        AND (${rangeStart}::timestamptz IS NULL OR created_at >= ${rangeStart})
      UNION ALL
      SELECT date(created_at)::text AS bucket,
        CASE
          WHEN action_type = 'hover' THEN 'hovers'
          WHEN action_type = 'share' THEN 'shares'
          ELSE 'clicks'
        END AS metric
      FROM listing_action_events
      WHERE listing_id = ${listingId}
        AND action_type IN ('card_click', 'contact_agent', 'call_agent', 'email_agent', 'whatsapp_agent', 'place_offer', 'reserve_now', 'buy_now', 'bond_calculator', 'hover', 'share')
        AND (${rangeStart}::timestamptz IS NULL OR created_at >= ${rangeStart})
      UNION ALL
      SELECT date(created_at)::text AS bucket, 'saves' AS metric
      FROM listing_saves
      WHERE listing_id = ${listingId}
        AND (${rangeStart}::timestamptz IS NULL OR created_at >= ${rangeStart})
    ) events
    GROUP BY bucket, metric
    ORDER BY bucket ASC
  `;

  return {
    ...mapListingRow(row),
    actionBreakdown: mergeBreakdownRows(
      breakdownRows.map((item) => ({
        count: numberFrom(item.count),
        description: breakdownDescription(item.action_type),
        label: formatLabel(item.action_type),
      })),
    ),
    createdAt: dateString(row.created_at),
    trend: buildTrendPoints(trendRows, range),
    updatedAt: dateString(row.updated_at),
  } satisfies ListingAnalyticsDetail;
}

export async function getReelAnalyticsDetail(
  userId: string,
  reelId: string,
  range: AnalyticsRange = parseAnalyticsRange("30d"),
) {
  const rangeStart = range.startAt?.toISOString() || null;
  const rows = await sql<(ReelMetricsRow & {
    created_at: string | null;
  })[]>`
    SELECT
      r.id,
      r.caption,
      r.status,
      r.view_count,
      r.edit_metadata,
      r.created_at::text,
      r.updated_at::text,
      GREATEST(
        COUNT(DISTINCT rws.id)::int,
        COUNT(DISTINCT CASE WHEN rwe.event_type IN ('view', 'progress', 'complete') THEN rwe.viewer_session_id END)::int
      ) AS watch_sessions,
      GREATEST(
        COUNT(DISTINCT CASE WHEN rws.completed THEN rws.id END)::int,
        COUNT(DISTINCT CASE WHEN rwe.event_type = 'complete' THEN rwe.viewer_session_id END)::int
      ) AS completed_sessions,
      ROUND(GREATEST(
        COALESCE(AVG(rws.max_progress_percent), 0),
        COALESCE(AVG(CASE WHEN rwe.event_type IN ('view', 'progress', 'complete') THEN rwe.progress_percent END), 0)
      ))::int AS average_progress_percent,
      ROUND(
        CASE
          WHEN COUNT(DISTINCT rws.id) > 0 THEN COALESCE(AVG(
            CASE
              WHEN rws.duration_seconds > 0 THEN LEAST(rws.total_watch_seconds, rws.duration_seconds)
              ELSE rws.total_watch_seconds
            END
          ), 0)
          ELSE COALESCE(AVG(
            CASE
              WHEN rwe.event_type IN ('progress', 'complete') AND rwe.duration_seconds > 0 THEN LEAST(rwe.progress_seconds, rwe.duration_seconds)
              WHEN rwe.event_type IN ('progress', 'complete') THEN rwe.progress_seconds
              ELSE NULL
            END
          ), 0)
        END
      )::int AS average_watch_seconds,
      COUNT(DISTINCT rwe.id)::int AS event_count,
      COUNT(DISTINCT CASE WHEN rwe.event_type = 'impression' THEN rwe.id END)::int AS impressions,
      COUNT(DISTINCT CASE WHEN rwe.event_type = 'hover' THEN rwe.id END)::int AS hovers,
      COUNT(DISTINCT rlc.id)::int + COUNT(DISTINCT CASE WHEN rwe.event_type = 'click' THEN rwe.id END)::int AS clicks,
      COUNT(DISTINCT CASE WHEN rwe.event_type = 'follow' THEN rwe.id END)::int AS follows,
      COUNT(DISTINCT rl.user_id)::int AS likes,
      COUNT(DISTINCT rs.user_id)::int AS saves,
      COUNT(DISTINCT rr.user_id)::int + COUNT(DISTINCT CASE WHEN rwe.event_type = 'share' THEN rwe.id END)::int AS shares,
      COUNT(DISTINCT rc.id)::int AS comments,
      GREATEST(MAX(rws.last_watched_at), MAX(rwe.created_at), MAX(rlc.created_at), MAX(rr.created_at), MAX(rc.created_at), r.updated_at)::text AS last_activity_at
    FROM reels r
    LEFT JOIN reel_watch_sessions rws ON rws.reel_id = r.id
      AND (${rangeStart}::timestamptz IS NULL OR rws.created_at >= ${rangeStart})
    LEFT JOIN reel_watch_events rwe ON rwe.reel_id = r.id
      AND (${rangeStart}::timestamptz IS NULL OR rwe.created_at >= ${rangeStart})
    LEFT JOIN reel_listing_clicks rlc ON rlc.reel_id = r.id
      AND (${rangeStart}::timestamptz IS NULL OR rlc.created_at >= ${rangeStart})
    LEFT JOIN reel_likes rl ON rl.reel_id = r.id
      AND (${rangeStart}::timestamptz IS NULL OR rl.created_at >= ${rangeStart})
    LEFT JOIN reel_saves rs ON rs.reel_id = r.id
      AND (${rangeStart}::timestamptz IS NULL OR rs.created_at >= ${rangeStart})
    LEFT JOIN reel_reshares rr ON rr.reel_id = r.id
      AND (${rangeStart}::timestamptz IS NULL OR rr.created_at >= ${rangeStart})
    LEFT JOIN reel_comments rc ON rc.reel_id = r.id
      AND (${rangeStart}::timestamptz IS NULL OR rc.created_at >= ${rangeStart})
    WHERE r.user_id = ${userId}
      AND r.id = ${reelId}
    GROUP BY r.id
    LIMIT 1
  `;
  const row = rows[0];

  if (!row) return null;

  const breakdownRows = await sql<Array<{ event_type: string; count: number | string }>>`
    SELECT event_type, COUNT(*)::int AS count
    FROM reel_watch_events
    WHERE reel_id = ${reelId}
      AND (${rangeStart}::timestamptz IS NULL OR created_at >= ${rangeStart})
    GROUP BY event_type
    ORDER BY count DESC, event_type ASC
  `;
  const trendRows = await sql<
    Array<{ bucket: string | null; metric: string | null; total: number | string | null }>
  >`
    SELECT bucket, metric, COUNT(*)::int AS total
    FROM (
      SELECT date(created_at)::text AS bucket,
        CASE
          WHEN event_type = 'impression' THEN 'impressions'
          WHEN event_type = 'hover' THEN 'hovers'
          WHEN event_type = 'share' THEN 'shares'
          WHEN event_type = 'click' THEN 'clicks'
          ELSE 'impressions'
        END AS metric
      FROM reel_watch_events
      WHERE reel_id = ${reelId}
        AND event_type IN ('view', 'impression', 'hover', 'click', 'share')
        AND (${rangeStart}::timestamptz IS NULL OR created_at >= ${rangeStart})
      UNION ALL
      SELECT date(created_at)::text AS bucket, 'clicks' AS metric
      FROM reel_listing_clicks
      WHERE reel_id = ${reelId}
        AND (${rangeStart}::timestamptz IS NULL OR created_at >= ${rangeStart})
      UNION ALL
      SELECT date(created_at)::text AS bucket, 'saves' AS metric
      FROM reel_saves
      WHERE reel_id = ${reelId}
        AND (${rangeStart}::timestamptz IS NULL OR created_at >= ${rangeStart})
      UNION ALL
      SELECT date(created_at)::text AS bucket, 'shares' AS metric
      FROM reel_reshares
      WHERE reel_id = ${reelId}
        AND (${rangeStart}::timestamptz IS NULL OR created_at >= ${rangeStart})
    ) events
    GROUP BY bucket, metric
    ORDER BY bucket ASC
  `;

  return {
    ...mapReelRow(row),
    createdAt: dateString(row.created_at),
    eventBreakdown: mergeBreakdownRows(
      breakdownRows.map((item) => ({
        count: numberFrom(item.count),
        description: breakdownDescription(item.event_type),
        label: formatLabel(item.event_type),
      })),
    ),
    trend: buildTrendPoints(trendRows, range),
    updatedAt: dateString(row.updated_at),
  } satisfies ReelAnalyticsDetail;
}
