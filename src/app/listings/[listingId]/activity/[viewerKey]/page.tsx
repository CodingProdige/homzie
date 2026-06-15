import { createHash } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, UserRound } from "lucide-react";

import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { Button } from "@/components/ui/button";
import {
  CanonicalTable,
  type CanonicalTableColumn,
} from "@/components/ui/canonical-table";
import { sql } from "@/db";
import { toPublicMediaUrl } from "@/media/paths";
import { authOptions } from "@/modules/auth/config";
import { getViewerChrome } from "@/modules/auth/viewer";
import {
  activityBadge,
  activityLabel,
  formatDateTime,
  PublicBuyerAvatar,
  TruncatedText,
} from "@/modules/listings/components/listing-activity-ui";
import { ActivityRealtimeRefresh } from "@/modules/listings/components/activity-realtime-refresh";
import { AiInsightRefreshButton } from "@/modules/listings/components/ai-insight-refresh-button";
import { ListingPreviewCard } from "@/modules/listings/components/listing-preview-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Viewer Activity | Homzie",
  description: "Review a buyer or session activity timeline for your Homzie listing.",
};

type ListingViewerActivityPageProps = {
  params: Promise<{ listingId: string; viewerKey: string }>;
  searchParams?: Promise<{ from?: string; page?: string; refreshInsight?: string }>;
};

type ListingActivityRow = {
  action_type: string | null;
  actor_name: string | null;
  activity_type: "action" | "view";
  avatar_url: string | null;
  buyer_id: string | null;
  created_at: Date | string | null;
  event_id: string;
  is_active: boolean;
  source: string | null;
  username: string | null;
  view_count: number;
  view_instance_id: string | null;
  viewer_session_id: string | null;
};

type BuyerInsightRow = {
  action_count_30d: number;
  active_days_30d: number;
  avg_bathrooms: number | null;
  avg_bedrooms: number | null;
  avg_price_cents: number | null;
  current_listing_actions: number;
  current_listing_events: number;
  current_listing_views: number;
  high_intent_actions_30d: number;
  last_seen_at: Date | string | null;
  max_price_cents: number | null;
  min_price_cents: number | null;
  offer_count_30d: number;
  saved_or_liked_count_30d: number;
  top_areas: string[] | null;
  viewed_listings_30d: number;
  view_count_30d: number;
};

type BuyerInsightNarrative = {
  canRefresh: boolean;
  cooldownRemainingSeconds: number;
  generatedByAi: boolean;
  rateLimited: boolean;
  text: string;
};

function parsePage(value: string | undefined) {
  const page = Number(value || "1");

  if (!Number.isFinite(page) || page < 1) return 1;

  return Math.floor(page);
}

function formatNumber(value: number | null | undefined, fallback = "Not enough data") {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;

  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 1 }).format(value);
}

function formatCompactCount(value: number | null | undefined) {
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(value || 0);
}

function formatZar(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "Not enough data";
  }

  return new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value / 100);
}

function formatPriceBracket(insight: BuyerInsightRow) {
  if (!insight.min_price_cents || !insight.max_price_cents) return "Not enough data";

  if (insight.min_price_cents === insight.max_price_cents) {
    return formatZar(insight.min_price_cents);
  }

  return `${formatZar(insight.min_price_cents)} - ${formatZar(insight.max_price_cents)}`;
}

const STREET_ADDRESS_PATTERN =
  /(^\d+\b|\b(street|st|road|rd|avenue|ave|drive|dr|close|crescent|cres|lane|ln|way|boulevard|blvd|place|court|ct|terrace|circle|square|unit|apartment|flat|erf)\b)/i;

const NON_AREA_PATTERN = /^(south africa|za)$/i;

function cleanAreaName(value: string) {
  return value.replace(/\s+/g, " ").replace(/[.,]+$/g, "").trim();
}

function areaNamesOnly(values: string[] | null | undefined) {
  const seen = new Set<string>();
  const areas: string[] = [];

  for (const value of values || []) {
    for (const part of value.split(",")) {
      const area = cleanAreaName(part);
      const key = area.toLowerCase();

      if (!area || seen.has(key) || STREET_ADDRESS_PATTERN.test(area) || NON_AREA_PATTERN.test(area)) {
        continue;
      }

      seen.add(key);
      areas.push(area);
    }
  }

  return areas.slice(0, 3);
}

function buyerInsightFacts(insight: BuyerInsightRow) {
  const topAreas = areaNamesOnly(insight.top_areas);

  return {
    activityLine: `${formatCompactCount(insight.viewed_listings_30d)} listings viewed, ${formatCompactCount(insight.view_count_30d)} views, ${formatCompactCount(insight.active_days_30d)} active days in the last 30 days`,
    areaLine: topAreas.length ? topAreas.join(", ") : "Not enough area data yet",
    offerLine:
      insight.offer_count_30d > 0
        ? `${formatCompactCount(insight.offer_count_30d)} recent ${insight.offer_count_30d === 1 ? "offer" : "offers"}`
        : "No recent offers captured",
    priceLine: `${formatPriceBracket(insight)}; average viewed price ${formatZar(insight.avg_price_cents)}`,
    propertyLine: `${formatNumber(insight.avg_bedrooms)} average beds and ${formatNumber(insight.avg_bathrooms)} average baths across viewed listings`,
    savedLine:
      insight.saved_or_liked_count_30d > 0
        ? `${formatCompactCount(insight.saved_or_liked_count_30d)} saved or liked listings`
        : "No saved or liked listings captured recently",
    thisListingLine: `${formatCompactCount(insight.current_listing_events)} events on this listing, including ${formatCompactCount(insight.current_listing_views)} views and ${formatCompactCount(insight.current_listing_actions)} actions`,
  };
}

function deterministicBuyerInsightSummary(insight: BuyerInsightRow) {
  const signals: string[] = [];

  if (insight.current_listing_views >= 3) {
    signals.push("repeatedly returned to this listing");
  } else if (insight.current_listing_views > 0) {
    signals.push("viewed this listing");
  }

  if (insight.current_listing_actions > 0) {
    signals.push("interacted beyond a basic view");
  }

  if (insight.high_intent_actions_30d > 0) {
    signals.push("used high-intent actions recently");
  }

  if (insight.offer_count_30d > 0) {
    signals.push(`made ${insight.offer_count_30d} recent ${insight.offer_count_30d === 1 ? "offer" : "offers"}`);
  }

  if (!signals.length) {
    return "There is not enough behavioural depth yet to infer strong intent. Treat this as early-stage browsing.";
  }

  const activityLevel =
    insight.active_days_30d >= 5
      ? "highly active"
      : insight.active_days_30d >= 2
        ? "active"
        : "recently active";

  return `This buyer looks ${activityLevel}: they ${signals.join(", ")}. Use the price and preference profile below as directional context, not a guarantee of budget.`;
}

function cleanAiInsight(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim()
    .slice(0, 700);
}

function buyerInsightFingerprint({
  insight,
  listingId,
  totalRows,
  viewerKey,
}: {
  insight: BuyerInsightRow;
  listingId: string;
  totalRows: number;
  viewerKey: string;
}) {
  const facts = buyerInsightFacts(insight);

  return createHash("sha256")
    .update(
      JSON.stringify({
        facts,
        highIntentActions30d: insight.high_intent_actions_30d,
        lastSeenAt: insight.last_seen_at
          ? new Date(insight.last_seen_at).toISOString()
          : null,
        listingId,
        totalRows,
        viewerKey,
      }),
    )
    .digest("hex");
}

async function generateBuyerInsightNarrative({
  activityFingerprint,
  allowRefresh,
  buyerName,
  insight,
  listingId,
  listingTitle,
  viewerKey,
}: {
  activityFingerprint: string;
  allowRefresh: boolean;
  buyerName: string;
  insight: BuyerInsightRow;
  listingId: string;
  listingTitle: string;
  viewerKey: string;
}): Promise<BuyerInsightNarrative> {
  const fallback = deterministicBuyerInsightSummary(insight);
  const apiKey = process.env.OPENAI_API_KEY;
  const facts = buyerInsightFacts(insight);
  let latestCached:
    | {
        activity_fingerprint: string;
        narrative: string;
        updated_at: Date | string | null;
      }
    | undefined;
  let cacheReadFailed = false;

  try {
    const [cached, latest] = await sql<
      {
        activity_fingerprint: string;
        narrative: string;
        updated_at: Date | string | null;
      }[]
    >`
      SELECT activity_fingerprint, narrative, updated_at
      FROM buyer_intent_insight_cache
      WHERE listing_id = ${listingId}
        AND viewer_key = ${viewerKey}
      ORDER BY
        CASE WHEN activity_fingerprint = ${activityFingerprint} THEN 0 ELSE 1 END,
        updated_at DESC
      LIMIT 2
    `;

    latestCached = cached?.activity_fingerprint === activityFingerprint ? latest : cached;

    if (cached?.activity_fingerprint === activityFingerprint && cached.narrative) {
      return {
        canRefresh: false,
        cooldownRemainingSeconds: 0,
        generatedByAi: true,
        rateLimited: false,
        text: cached.narrative,
      };
    }

    if (latestCached?.narrative && !allowRefresh) {
      return {
        canRefresh: true,
        cooldownRemainingSeconds: 0,
        generatedByAi: true,
        rateLimited: false,
        text: latestCached.narrative,
      };
    }

    if (latestCached?.narrative && allowRefresh && latestCached.updated_at) {
      const updatedAt = new Date(latestCached.updated_at).getTime();
      const secondsSinceRefresh = Number.isFinite(updatedAt)
        ? (Date.now() - updatedAt) / 1000
        : 0;

      if (secondsSinceRefresh < 30) {
        return {
          canRefresh: true,
          cooldownRemainingSeconds: Math.ceil(30 - secondsSinceRefresh),
          generatedByAi: true,
          rateLimited: true,
          text: latestCached.narrative,
        };
      }
    }
  } catch (error) {
    cacheReadFailed = true;
    console.warn("[listing-activity] buyer insight cache read skipped", error);
  }

  if (cacheReadFailed || !allowRefresh || !apiKey) {
    return {
      canRefresh: false,
      cooldownRemainingSeconds: 0,
      generatedByAi: false,
      rateLimited: false,
      text: fallback,
    };
  }

  const model =
    process.env.OPENAI_BUYER_INTENT_MODEL ||
    process.env.OPENAI_DESCRIPTION_MODEL ||
    "gpt-4.1-mini";

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            content: [
              {
                text: [
                  "Write a concise buyer-intent insight for a real estate agent.",
                  "Use only the provided facts. Do not invent motivations, finances, urgency, family status, or certainty.",
                  "Keep it to 2 short sentences. Plain text only. No markdown.",
                  "",
                  `Buyer: ${buyerName}`,
                  `Listing: ${listingTitle}`,
                  `Activity: ${facts.activityLine}`,
                  `This listing: ${facts.thisListingLine}`,
                  `Shopping price: ${facts.priceLine}`,
                  `Property preference: ${facts.propertyLine}`,
                  `Area focus: ${facts.areaLine}`,
                  `Offers: ${facts.offerLine}`,
                  `Saved/liked: ${facts.savedLine}`,
                  `High-intent actions: ${formatCompactCount(insight.high_intent_actions_30d)}`,
                ].join("\n"),
                type: "input_text",
              },
            ],
            role: "user",
          },
        ],
        max_output_tokens: 160,
        model,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[listing-activity] buyer insight generation failed", {
        error: errorText.slice(0, 500),
        status: response.status,
      });

      return {
        canRefresh: Boolean(latestCached?.narrative),
        cooldownRemainingSeconds: 0,
        generatedByAi: Boolean(latestCached?.narrative),
        rateLimited: false,
        text: latestCached?.narrative || fallback,
      };
    }

    const result = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{ text?: string; type?: string }>;
      }>;
    };
    const rawText =
      result.output_text ||
      result.output
        ?.flatMap((item) => item.content || [])
        .map((content) => content.text || "")
        .join(" ");
    const text = cleanAiInsight(rawText || "");

    if (!text) {
      return {
        canRefresh: Boolean(latestCached?.narrative),
        cooldownRemainingSeconds: 0,
        generatedByAi: Boolean(latestCached?.narrative),
        rateLimited: false,
        text: latestCached?.narrative || fallback,
      };
    }

    try {
      await sql`
        INSERT INTO buyer_intent_insight_cache (
          listing_id,
          viewer_key,
          activity_fingerprint,
          model,
          narrative,
          facts,
          updated_at
        )
        VALUES (
          ${listingId},
          ${viewerKey},
          ${activityFingerprint},
          ${model},
          ${text},
          ${JSON.stringify(facts)}::jsonb,
          now()
        )
        ON CONFLICT (listing_id, viewer_key, activity_fingerprint)
        DO UPDATE SET
          model = EXCLUDED.model,
          narrative = EXCLUDED.narrative,
          facts = EXCLUDED.facts,
          updated_at = now()
      `;
    } catch (error) {
      console.warn("[listing-activity] buyer insight cache write skipped", error);
    }

    return {
      canRefresh: false,
      cooldownRemainingSeconds: 30,
      generatedByAi: true,
      rateLimited: false,
      text,
    };
  } catch (error) {
    console.error("[listing-activity] buyer insight generation error", error);

    return {
      canRefresh: Boolean(latestCached?.narrative),
      cooldownRemainingSeconds: 0,
      generatedByAi: Boolean(latestCached?.narrative),
      rateLimited: false,
      text: latestCached?.narrative || fallback,
    };
  }
}

function BuyerInsightPanel({
  insight,
  narrative,
  refreshHref,
  refreshRequested,
}: {
  insight: BuyerInsightRow;
  narrative: BuyerInsightNarrative;
  refreshHref: string;
  refreshRequested: boolean;
}) {
  const facts = buyerInsightFacts(insight);

  return (
    <section className="mt-5 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Buyer insight
          </p>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
            {narrative.generatedByAi ? "AI assisted" : "Data based"}
          </span>
        </div>
        <AiInsightRefreshButton
          cooldownSeconds={narrative.cooldownRemainingSeconds}
          refreshHref={refreshHref}
          refreshRequested={refreshRequested}
        />
      </div>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-foreground">
        {narrative.text}
      </p>
      {narrative.canRefresh ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {narrative.rateLimited
            ? "Insight refresh is limited to once every 30 seconds."
            : "New events were captured. Refresh the insight when you want the AI summary updated."}
        </p>
      ) : null}
      <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
        <li>
          <span className="font-semibold text-foreground">Shopping range:</span>{" "}
          {facts.priceLine}.
        </li>
        <li>
          <span className="font-semibold text-foreground">Property preference:</span>{" "}
          {facts.propertyLine}.
        </li>
        <li>
          <span className="font-semibold text-foreground">Area focus:</span>{" "}
          {facts.areaLine}.
        </li>
        <li>
          <span className="font-semibold text-foreground">Platform activity:</span>{" "}
          {facts.activityLine}.
        </li>
        <li>
          <span className="font-semibold text-foreground">Offer and save signals:</span>{" "}
          {facts.offerLine}; {facts.savedLine}.
        </li>
        <li>
          <span className="font-semibold text-foreground">This listing:</span>{" "}
          {facts.thisListingLine}.
        </li>
      </ul>
    </section>
  );
}

export default async function ListingViewerActivityPage({
  params,
  searchParams,
}: ListingViewerActivityPageProps) {
  const { listingId, viewerKey: rawViewerKey } = await params;
  const viewerKey = decodeURIComponent(rawViewerKey);
  const query = searchParams ? await searchParams : {};
  const currentPage = parsePage(query.page);
  const shouldRefreshInsight = Boolean(query.refreshInsight);
  const fromOverview = query.from === "overview";
  const pageSize = 25;
  const offset = (currentPage - 1) * pageSize;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect(
      `/sign-in?callbackUrl=/listings/${listingId}/activity/${encodeURIComponent(viewerKey)}`,
    );
  }

  const [viewer, listingRows] = await Promise.all([
    getViewerChrome(userId),
    sql<
      {
        cover_image_url: string | null;
        id: string;
        location: string | null;
        price_label: string | null;
        status: string | null;
        title: string;
        user_id: string;
      }[]
    >`
      SELECT id, user_id, title, location, cover_image_url, price_label, status
      FROM property_listings
      WHERE id = ${listingId}
      LIMIT 1
    `,
  ]);
  const listing = listingRows[0];

  if (!listing || listing.user_id !== userId) {
    notFound();
  }

  await sql`
    INSERT INTO listing_activity_reads (
      listing_id,
      owner_user_id,
      viewer_key,
      last_read_at,
      updated_at
    )
    VALUES (
      ${listingId},
      ${userId},
      ${viewerKey},
      now(),
      now()
    )
    ON CONFLICT (listing_id, owner_user_id, viewer_key)
    DO UPDATE SET
      last_read_at = now(),
      updated_at = now()
  `;

  const [countRows, activityRows, insightRows] = await Promise.all([
    sql<{ total_rows: number }[]>`
      WITH activity_rows AS (
        SELECT coalesce(viewer_user_id::text, viewer_session_id) AS viewer_key
        FROM listing_view_events
        WHERE listing_id = ${listingId}
          AND (viewer_user_id IS NULL OR viewer_user_id <> ${userId})
        UNION ALL
        SELECT coalesce(viewer_user_id::text, viewer_session_id) AS viewer_key
        FROM listing_action_events
        WHERE listing_id = ${listingId}
          AND (viewer_user_id IS NULL OR viewer_user_id <> ${userId})
      )
      SELECT count(*)::int AS total_rows
      FROM activity_rows
      WHERE viewer_key = ${viewerKey}
    `,
    sql<ListingActivityRow[]>`
      WITH group_counts AS (
        SELECT
          coalesce(viewer_user_id::text, viewer_session_id) AS viewer_key,
          count(DISTINCT coalesce(view_instance_id, viewer_session_id))::int AS view_count
        FROM listing_view_events
        WHERE listing_id = ${listingId}
          AND (viewer_user_id IS NULL OR viewer_user_id <> ${userId})
        GROUP BY coalesce(viewer_user_id::text, viewer_session_id)
      ),
      activity_rows AS (
        SELECT
          ('view:' || lve.id::text) AS event_id,
          'view'::text AS activity_type,
          NULL::text AS action_type,
          lve.created_at,
          lve.source,
          lve.viewer_session_id,
          lve.view_instance_id,
          lve.viewer_user_id,
          lve.listing_id,
          coalesce(lve.viewer_user_id::text, lve.viewer_session_id) AS viewer_key
        FROM listing_view_events lve
        WHERE lve.listing_id = ${listingId}
          AND (lve.viewer_user_id IS NULL OR lve.viewer_user_id <> ${userId})
        UNION ALL
        SELECT
          ('action:' || lae.id::text) AS event_id,
          'action'::text AS activity_type,
          lae.action_type,
          lae.created_at,
          lae.source,
          lae.viewer_session_id,
          NULL::text AS view_instance_id,
          lae.viewer_user_id,
          lae.listing_id,
          coalesce(lae.viewer_user_id::text, lae.viewer_session_id) AS viewer_key
        FROM listing_action_events lae
        WHERE lae.listing_id = ${listingId}
          AND (lae.viewer_user_id IS NULL OR lae.viewer_user_id <> ${userId})
      )
      SELECT
        ar.event_id,
        ar.activity_type,
        ar.action_type,
        ar.created_at,
        ar.source,
        ar.viewer_session_id,
        ar.view_instance_id,
        u.id AS buyer_id,
        u.name AS actor_name,
        u.username,
        u.avatar_url,
        coalesce(gc.view_count, 0)::int AS view_count,
        EXISTS (
          SELECT 1
          FROM listing_presence_sessions lps
          WHERE lps.listing_id = ar.listing_id
            AND (
              (ar.viewer_user_id IS NOT NULL AND lps.viewer_user_id = ar.viewer_user_id)
              OR lps.viewer_session_id = ar.viewer_session_id
            )
            AND lps.expires_at > now()
        ) AS is_active
      FROM activity_rows ar
      LEFT JOIN users u ON u.id = ar.viewer_user_id
      LEFT JOIN group_counts gc ON gc.viewer_key = ar.viewer_key
      WHERE ar.viewer_key = ${viewerKey}
      ORDER BY ar.created_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `,
    sql<BuyerInsightRow[]>`
      WITH viewer_identity AS (
        SELECT
          ${viewerKey}::text AS viewer_key,
          CASE
            WHEN ${viewerKey}::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN ${viewerKey}::uuid
            ELSE NULL::uuid
          END AS viewer_user_id,
          ${viewerKey}::text AS viewer_session_id
      ),
      scoped_views AS (
        SELECT
          lve.created_at,
          lve.listing_id,
          pl.asking_price_cents,
          pl.details,
          COALESCE(
            NULLIF(pl.details->>'suburb', ''),
            NULLIF(pl.details->>'area', ''),
            NULLIF(pl.details->>'city', '')
          ) AS area,
          CASE
            WHEN pl.details->>'bedrooms' ~ '^[0-9]+(\\.[0-9]+)?$'
              THEN (pl.details->>'bedrooms')::numeric
            ELSE NULL
          END AS bedrooms,
          CASE
            WHEN pl.details->>'bathrooms' ~ '^[0-9]+(\\.[0-9]+)?$'
              THEN (pl.details->>'bathrooms')::numeric
            ELSE NULL
          END AS bathrooms
        FROM listing_view_events lve
        JOIN viewer_identity vi ON (
          (vi.viewer_user_id IS NOT NULL AND lve.viewer_user_id = vi.viewer_user_id)
          OR (vi.viewer_user_id IS NULL AND lve.viewer_session_id = vi.viewer_session_id)
        )
        JOIN property_listings pl ON pl.id = lve.listing_id
        WHERE lve.created_at >= now() - interval '30 days'
      ),
      scoped_actions AS (
        SELECT lae.action_type, lae.created_at, lae.listing_id
        FROM listing_action_events lae
        JOIN viewer_identity vi ON (
          (vi.viewer_user_id IS NOT NULL AND lae.viewer_user_id = vi.viewer_user_id)
          OR (vi.viewer_user_id IS NULL AND lae.viewer_session_id = vi.viewer_session_id)
        )
        WHERE lae.created_at >= now() - interval '30 days'
      ),
      scoped_offers AS (
        SELECT po.id, po.created_at
        FROM property_offers po
        JOIN viewer_identity vi ON vi.viewer_user_id IS NOT NULL AND po.buyer_user_id = vi.viewer_user_id
        WHERE po.created_at >= now() - interval '30 days'
      ),
      area_counts AS (
        SELECT area, count(*) AS area_count
        FROM scoped_views
        WHERE area IS NOT NULL
        GROUP BY area
        ORDER BY area_count DESC, area ASC
        LIMIT 3
      )
      SELECT
        count(*)::int AS view_count_30d,
        count(DISTINCT sv.listing_id)::int AS viewed_listings_30d,
        count(DISTINCT sv.created_at::date)::int AS active_days_30d,
        max(sv.created_at) AS last_seen_at,
        min(sv.asking_price_cents)::int AS min_price_cents,
        max(sv.asking_price_cents)::int AS max_price_cents,
        avg(sv.asking_price_cents)::int AS avg_price_cents,
        avg(sv.bedrooms)::float AS avg_bedrooms,
        avg(sv.bathrooms)::float AS avg_bathrooms,
        coalesce((SELECT array_agg(area) FROM area_counts), ARRAY[]::text[]) AS top_areas,
        (SELECT count(*)::int FROM scoped_actions) AS action_count_30d,
        (
          SELECT count(*)::int
          FROM scoped_actions
          WHERE action_type IN ('bond_calculator', 'contact_agent', 'email_agent', 'call_agent', 'whatsapp_agent', 'place_offer', 'reserve_now')
        ) AS high_intent_actions_30d,
        (
          SELECT count(*)::int
          FROM scoped_actions
          WHERE action_type IN ('save', 'like')
        ) AS saved_or_liked_count_30d,
        (SELECT count(*)::int FROM scoped_offers) AS offer_count_30d,
        (
          SELECT count(*)::int
          FROM scoped_views
          WHERE listing_id = ${listingId}
        ) AS current_listing_views,
        (
          SELECT count(*)::int
          FROM scoped_actions
          WHERE listing_id = ${listingId}
        ) AS current_listing_actions,
        (
          (SELECT count(*)::int FROM scoped_views WHERE listing_id = ${listingId})
          + (SELECT count(*)::int FROM scoped_actions WHERE listing_id = ${listingId})
        ) AS current_listing_events
      FROM scoped_views sv
    `,
  ]);

  if (!activityRows.length && currentPage === 1) {
    notFound();
  }

  const totalRows = countRows[0]?.total_rows || 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const firstRow = totalRows ? offset + 1 : 0;
  const lastRow = Math.min(offset + activityRows.length, totalRows);
  const firstActivity = activityRows[0];
  const buyerInsight = insightRows[0] || {
    action_count_30d: 0,
    active_days_30d: 0,
    avg_bathrooms: null,
    avg_bedrooms: null,
    avg_price_cents: null,
    current_listing_actions: 0,
    current_listing_events: totalRows,
    current_listing_views: 0,
    high_intent_actions_30d: 0,
    last_seen_at: null,
    max_price_cents: null,
    min_price_cents: null,
    offer_count_30d: 0,
    saved_or_liked_count_30d: 0,
    top_areas: [],
    viewed_listings_30d: 0,
    view_count_30d: 0,
  };
  const buyerName = firstActivity?.actor_name || "Anonymous viewer";
  const activityFingerprint = buyerInsightFingerprint({
    insight: buyerInsight,
    listingId: listing.id,
    totalRows,
    viewerKey,
  });
  const buyerNarrative = await generateBuyerInsightNarrative({
    activityFingerprint,
    allowRefresh: shouldRefreshInsight,
    buyerName,
    insight: buyerInsight,
    listingId: listing.id,
    listingTitle: listing.title,
    viewerKey,
  });
  const listingPreview = {
    coverImageUrl: toPublicMediaUrl(listing.cover_image_url),
    id: listing.id,
    label: listing.title,
    location: listing.location,
    priceLabel: listing.price_label,
    status: listing.status,
    title: listing.title,
  };
  const insightRefreshParams = new URLSearchParams();

  if (fromOverview) insightRefreshParams.set("from", "overview");
  if (safeCurrentPage > 1) insightRefreshParams.set("page", String(safeCurrentPage));

  insightRefreshParams.set("refreshInsight", "1");

  const insightRefreshHref = `/listings/${listing.id}/activity/${encodeURIComponent(viewerKey)}?${insightRefreshParams.toString()}`;
  const listingActivityBackHref = fromOverview
    ? `/listings/${listing.id}/activity?from=overview`
    : `/listings/${listing.id}/activity`;
  const timelineHref = (page?: number) => {
    const params = new URLSearchParams();

    if (fromOverview) params.set("from", "overview");
    if (page && page > 1) params.set("page", String(page));

    const queryString = params.toString();

    return queryString
      ? `/listings/${listing.id}/activity/${encodeURIComponent(viewerKey)}?${queryString}`
      : `/listings/${listing.id}/activity/${encodeURIComponent(viewerKey)}`;
  };
  const activityColumns: Array<CanonicalTableColumn<ListingActivityRow>> = [
    {
      className: "w-[66%] md:w-[70%]",
      header: "Event",
      key: "event",
      render: (row) => {
        const label = activityLabel(row);
        const badge = activityBadge(row);

        return (
          <>
            <TruncatedText title={label} className="font-medium">
              {label}
            </TruncatedText>
            <TruncatedText title={badge} className="mt-0.5 text-[10px] text-muted-foreground md:text-xs">
              {badge}
            </TruncatedText>
          </>
        );
      },
    },
    {
      className: "w-[34%] px-2 md:w-[30%] md:px-4",
      header: "Time",
      key: "time",
      render: (row) => (
        <TruncatedText title={formatDateTime(row.created_at)}>
          {formatDateTime(row.created_at)}
        </TruncatedText>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader viewerRole={viewer.role} viewerUsername={viewer.username} />
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pt-28">
        <Link
          href={listingActivityBackHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          Back to activity
        </Link>

        <section className="mt-5 border-b border-border pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Viewer activity
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">
                Activity timeline
              </h1>
            </div>
            <ActivityRealtimeRefresh clearSearchParams={["refreshInsight"]} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
            <ListingPreviewCard listing={listingPreview} compact />
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
              <div className="flex min-w-0 items-center gap-3">
                <PublicBuyerAvatar
                  avatarPath={firstActivity?.avatar_url || null}
                  name={buyerName}
                />
                <div className="min-w-0">
                  <TruncatedText title={buyerName} className="font-semibold">
                    {buyerName}
                  </TruncatedText>
                  <TruncatedText
                    title={firstActivity?.username ? `@${firstActivity.username}` : "Guest session"}
                    className="mt-0.5 text-xs text-muted-foreground"
                  >
                    {firstActivity?.username ? `@${firstActivity.username}` : "Guest session"}
                  </TruncatedText>
                </div>
              </div>
              {firstActivity?.username ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs"
                >
                  <Link href={`/users/${firstActivity.username}`}>
                    <UserRound className="size-3.5" />
                    View profile
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <BuyerInsightPanel
          insight={buyerInsight}
          narrative={buyerNarrative}
          refreshHref={insightRefreshHref}
          refreshRequested={shouldRefreshInsight}
        />

        <section className="mt-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {firstRow}-{lastRow} of {totalRows} events
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              Page {safeCurrentPage} of {totalPages}
            </p>
          </div>

          <CanonicalTable
            columns={activityColumns}
            emptyState="No activity found for this viewer."
            getRowKey={(row) => row.event_id}
            minWidth="0"
            pagination={{
              currentPage: safeCurrentPage,
              hrefForPage: timelineHref,
              manual: true,
              pageSize,
              totalItems: totalRows,
            }}
            rows={activityRows}
            tableClassName="table-fixed text-xs md:text-sm"
          />
        </section>
      </main>
      <GlobalFooter viewerRole={viewer.role} viewerUsername={viewer.username} />
    </div>
  );
}
