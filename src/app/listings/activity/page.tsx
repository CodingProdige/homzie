import { createHash } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowRight, Eye, Lock, Radar, TrendingDown, TrendingUp, UsersRound } from "lucide-react";

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
import { ActivityRealtimeRefresh } from "@/modules/listings/components/activity-realtime-refresh";
import { clearAllListingBuyerActivityAction } from "@/modules/listings/activity-count-actions";
import { AiInsightRefreshButton } from "@/modules/listings/components/ai-insight-refresh-button";
import {
  activityBadge,
  activityLabel,
  formatDateTime,
  TruncatedText,
} from "@/modules/listings/components/listing-activity-ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Listing Buyer Activity | Homzie",
  description:
    "Monitor realtime buyer activity across your own Homzie listings.",
};

type ListingActivityOverviewPageProps = {
  searchParams?: Promise<{ page?: string; refreshInsight?: string }>;
};

type ListingActivityOverviewRow = {
  action_count: number;
  active_buyer_count: number;
  active_viewer_count: number;
  activity_count: number;
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

type ListingActivityAnalyticsRow = {
  active_buyer_count: number;
  active_viewer_count: number;
  previous_views_24h: number;
  total_views_24h: number;
  unread_viewer_count: number;
};

type ListingPortfolioInsightRow = {
  active_now: number;
  action_events_7d: number;
  calculator_events_7d: number;
  high_intent_events_7d: number;
  listing_count: number;
  offer_events_7d: number;
  photo_events_7d: number;
  previous_views_24h: number;
  returning_viewers_7d: number;
  top_listing_actions_7d: number | null;
  top_listing_title: string | null;
  top_listing_views_7d: number | null;
  total_events_7d: number;
  unique_buyers_7d: number;
  views_24h: number;
  views_7d: number;
  weakest_listing_actions_7d: number | null;
  weakest_listing_title: string | null;
  weakest_listing_views_7d: number | null;
  zero_activity_listings_7d: number;
};

type ListingPortfolioNarrative = {
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

function plural(value: number, singular: string, pluralLabel = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralLabel}`;
}

function formatCompact(value: number | null | undefined) {
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(value || 0);
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

function cleanAiInsight(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim()
    .slice(0, 850);
}

function directAgentInsight(value: string) {
  return cleanAiInsight(value)
    .replace(/\bThe agent's\b/g, "Your")
    .replace(/\bthe agent's\b/g, "your")
    .replace(/\bThe agent is\b/g, "You are")
    .replace(/\bthe agent is\b/g, "you are")
    .replace(/\bThe agent has\b/g, "You have")
    .replace(/\bthe agent has\b/g, "you have")
    .replace(/\bThe agent should\b/g, "You should")
    .replace(/\bthe agent should\b/g, "you should")
    .replace(/\bThe agent can\b/g, "You can")
    .replace(/\bthe agent can\b/g, "you can")
    .replace(/\bThe agent\b/g, "You")
    .replace(/\bthe agent\b/g, "you")
    .replace(/\bTheir listings\b/g, "Your listings")
    .replace(/\btheir listings\b/g, "your listings")
    .replace(/\bTheir listing\b/g, "Your listing")
    .replace(/\btheir listing\b/g, "your listing")
    .replace(/\bTheir portfolio\b/g, "Your portfolio")
    .replace(/\btheir portfolio\b/g, "your portfolio")
    .replace(/\bThe portfolio\b/g, "Your portfolio")
    .replace(/\bthe portfolio\b/g, "your portfolio")
    .replace(/\bThe listings\b/g, "Your listings")
    .replace(/\bthe listings\b/g, "your listings");
}

function portfolioInsightFacts(insight: ListingPortfolioInsightRow) {
  const trend = formatTrend(insight.views_24h, insight.previous_views_24h);
  const conversionRate = insight.views_7d
    ? Math.round((insight.high_intent_events_7d / insight.views_7d) * 100)
    : 0;
  const topListing = insight.top_listing_title
    ? `${insight.top_listing_title} (${formatCompact(insight.top_listing_views_7d)} views, ${formatCompact(insight.top_listing_actions_7d)} actions in 7 days)`
    : "No standout listing yet";
  const weakestListing = insight.weakest_listing_title
    ? `${insight.weakest_listing_title} (${formatCompact(insight.weakest_listing_views_7d)} views, ${formatCompact(insight.weakest_listing_actions_7d)} actions in 7 days)`
    : "No weak listing pattern yet";

  return {
    actionLine: `${formatCompact(insight.action_events_7d)} actions, including ${formatCompact(insight.high_intent_events_7d)} high-intent actions in the last 7 days`,
    activityLine: `${formatCompact(insight.active_now)} active viewers now, ${formatCompact(insight.unique_buyers_7d)} unique buyer groups in the last 7 days`,
    conversionLine: `${conversionRate}% high-intent action rate from listing views`,
    lowActivityLine: `${formatCompact(insight.zero_activity_listings_7d)} published listings had no buyer activity in the last 7 days`,
    mediaLine: `${formatCompact(insight.photo_events_7d)} photo browsing events and ${formatCompact(insight.calculator_events_7d)} bond calculator opens in the last 7 days`,
    offerLine: `${formatCompact(insight.offer_events_7d)} offer-start events in the last 7 days`,
    topListing,
    trendLine: trend.label,
    viewsLine: `${formatCompact(insight.views_24h)} views in the last 24 hours, ${formatCompact(insight.views_7d)} views in the last 7 days`,
    weakestListing,
  };
}

function listingPortfolioFingerprint({
  insight,
  totalRows,
  userId,
}: {
  insight: ListingPortfolioInsightRow;
  totalRows: number;
  userId: string;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        facts: portfolioInsightFacts(insight),
        totalRows,
        userId,
      }),
    )
    .digest("hex");
}

function deterministicPortfolioInsight(insight: ListingPortfolioInsightRow) {
  const facts = portfolioInsightFacts(insight);
  const suggestions: string[] = [];

  if (insight.views_7d === 0) {
    return "Your published listings have not recorded enough buyer activity yet to diagnose performance. Start by improving the first photo, title clarity, and share distribution so your listings can collect meaningful signals.";
  }

  if (insight.high_intent_events_7d === 0) {
    suggestions.push("buyers are browsing but not producing strong intent signals, so lead with sharper cover images, clearer pricing, and stronger description hooks");
  }

  if (insight.photo_events_7d > 0 && insight.calculator_events_7d === 0) {
    suggestions.push("photo interest is present, but calculator usage is absent, so pricing confidence or affordability cues may need work");
  }

  if (insight.zero_activity_listings_7d > 0) {
    suggestions.push(`${facts.lowActivityLine.toLowerCase()}, so those listings should be refreshed or promoted first`);
  }

  if (!suggestions.length) {
    suggestions.push("buyer intent is present, so focus on faster follow-up and nudging active viewers into chat");
  }

  return `Your listing activity shows ${facts.viewsLine.toLowerCase()} with ${facts.actionLine.toLowerCase()}. Based on the current signals, ${suggestions.join("; ")}.`;
}

async function generateListingPortfolioNarrative({
  activityFingerprint,
  allowRefresh,
  insight,
  ownerUserId,
  totalRows,
}: {
  activityFingerprint: string;
  allowRefresh: boolean;
  insight: ListingPortfolioInsightRow;
  ownerUserId: string;
  totalRows: number;
}): Promise<ListingPortfolioNarrative> {
  const fallback = deterministicPortfolioInsight(insight);
  const apiKey = process.env.OPENAI_API_KEY;
  const facts = portfolioInsightFacts(insight);
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
      FROM listing_portfolio_insight_cache
      WHERE owner_user_id = ${ownerUserId}
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
        text: directAgentInsight(cached.narrative),
      };
    }

    if (latestCached?.narrative && !allowRefresh) {
      return {
        canRefresh: true,
        cooldownRemainingSeconds: 0,
        generatedByAi: true,
        rateLimited: false,
        text: directAgentInsight(latestCached.narrative),
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
          text: directAgentInsight(latestCached.narrative),
        };
      }
    }
  } catch (error) {
    cacheReadFailed = true;
    console.warn("[listing-activity] portfolio insight cache read skipped", error);
  }

  if (cacheReadFailed || !apiKey || (latestCached?.narrative && !allowRefresh)) {
    return {
      canRefresh: Boolean(latestCached?.narrative),
      cooldownRemainingSeconds: 0,
      generatedByAi: Boolean(latestCached?.narrative),
      rateLimited: false,
      text: latestCached?.narrative
        ? directAgentInsight(latestCached.narrative)
        : fallback,
    };
  }

  if (totalRows === 0) {
    return {
      canRefresh: false,
      cooldownRemainingSeconds: 0,
      generatedByAi: false,
      rateLimited: false,
      text: fallback,
    };
  }

  const model =
    process.env.OPENAI_LISTING_INSIGHT_MODEL ||
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
                  "Write a concise portfolio-level listing performance insight for a real estate agent.",
                  "Use only the provided facts. Do not invent market conditions, buyer motivations, finances, or certainty.",
                  "Speak directly to the agent using you, your, and yours.",
                  "Never write the agent, the agent's, they, their, or them when referring to the recipient.",
                  "Explain what you should improve and why your listings may not be getting high-intent activity.",
                  "Keep it to 3 short sentences. Plain text only. No markdown.",
                  "",
                  `Published listings: ${totalRows}`,
                  `Activity: ${facts.activityLine}`,
                  `Views: ${facts.viewsLine}`,
                  `Trend: ${facts.trendLine}`,
                  `Actions: ${facts.actionLine}`,
                  `Intent conversion: ${facts.conversionLine}`,
                  `Media/calculator signals: ${facts.mediaLine}`,
                  `Offer signals: ${facts.offerLine}`,
                  `Top performer: ${facts.topListing}`,
                  `Needs attention: ${facts.weakestListing}`,
                  `Low activity: ${facts.lowActivityLine}`,
                ].join("\n"),
                type: "input_text",
              },
            ],
            role: "user",
          },
        ],
        max_output_tokens: 220,
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
      console.error("[listing-activity] portfolio insight generation failed", {
        error: errorText.slice(0, 500),
        status: response.status,
      });

      return {
        canRefresh: Boolean(latestCached?.narrative),
        cooldownRemainingSeconds: 0,
        generatedByAi: Boolean(latestCached?.narrative),
        rateLimited: false,
        text: latestCached?.narrative
          ? directAgentInsight(latestCached.narrative)
          : fallback,
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
    const text = directAgentInsight(rawText || "");

    if (!text) {
      return {
        canRefresh: Boolean(latestCached?.narrative),
        cooldownRemainingSeconds: 0,
        generatedByAi: Boolean(latestCached?.narrative),
        rateLimited: false,
        text: latestCached?.narrative
          ? directAgentInsight(latestCached.narrative)
          : fallback,
      };
    }

    try {
      await sql`
        INSERT INTO listing_portfolio_insight_cache (
          owner_user_id,
          activity_fingerprint,
          model,
          narrative,
          facts,
          updated_at
        )
        VALUES (
          ${ownerUserId},
          ${activityFingerprint},
          ${model},
          ${text},
          ${JSON.stringify(facts)}::jsonb,
          now()
        )
        ON CONFLICT (owner_user_id, activity_fingerprint)
        DO UPDATE SET
          model = EXCLUDED.model,
          narrative = EXCLUDED.narrative,
          facts = EXCLUDED.facts,
          updated_at = now()
      `;
    } catch (error) {
      console.warn("[listing-activity] portfolio insight cache write skipped", error);
    }

    return {
      canRefresh: false,
      cooldownRemainingSeconds: 30,
      generatedByAi: true,
      rateLimited: false,
      text,
    };
  } catch (error) {
    console.error("[listing-activity] portfolio insight generation error", error);

    return {
      canRefresh: Boolean(latestCached?.narrative),
      cooldownRemainingSeconds: 0,
      generatedByAi: Boolean(latestCached?.narrative),
      rateLimited: false,
      text: latestCached?.narrative
        ? directAgentInsight(latestCached.narrative)
        : fallback,
    };
  }
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
            ? "bg-emerald-100 text-emerald-700"
            : tone === "red"
              ? "bg-red-100 text-red-600"
              : "bg-primary/10 text-primary"
        }`}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-foreground">
          {value}
        </span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-[11px] font-semibold text-muted-foreground/80">
          {description}
        </span>
      </span>
    </div>
  );
}

function ListingPortfolioInsightPanel({
  insight,
  narrative,
  refreshHref,
  refreshRequested,
}: {
  insight: ListingPortfolioInsightRow;
  narrative: ListingPortfolioNarrative;
  refreshHref: string;
  refreshRequested: boolean;
}) {
  const facts = portfolioInsightFacts(insight);

  return (
    <section className="mt-5 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Listing insight
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
      <p className="mt-3 max-w-5xl text-sm leading-6 text-foreground">
        {narrative.text}
      </p>
      {narrative.canRefresh ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {narrative.rateLimited
            ? "Insight refresh is limited to once every 30 seconds."
            : "New listing activity was captured. Refresh the insight when you want the AI summary updated."}
        </p>
      ) : null}
      <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
        <li>
          <span className="font-semibold text-foreground">Demand signal:</span>{" "}
          {facts.activityLine}; {facts.viewsLine}; {facts.trendLine}.
        </li>
        <li>
          <span className="font-semibold text-foreground">Intent signal:</span>{" "}
          {facts.actionLine}; {facts.conversionLine}.
        </li>
        <li>
          <span className="font-semibold text-foreground">Engagement clues:</span>{" "}
          {facts.mediaLine}; {facts.offerLine}.
        </li>
        <li>
          <span className="font-semibold text-foreground">Best performer:</span>{" "}
          {facts.topListing}.
        </li>
        <li>
          <span className="font-semibold text-foreground">Needs attention:</span>{" "}
          {facts.weakestListing}; {facts.lowActivityLine}.
        </li>
      </ul>
    </section>
  );
}

function latestEventLabel(row: ListingActivityOverviewRow) {
  if (!row.latest_activity_type) return "No buyer activity yet";

  const label = activityLabel({
    action_type: row.latest_action_type,
    activity_type: row.latest_activity_type,
  }).toLowerCase();

  return row.latest_actor_name
    ? `${row.latest_actor_name} ${label}`
    : label[0]?.toUpperCase() + label.slice(1);
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
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
        tone === "red"
          ? "bg-red-50 text-red-600"
          : tone === "green"
            ? "bg-emerald-50 text-emerald-700"
            : "bg-muted text-muted-foreground"
      }`}
    >
      <span>{value}</span>
      <span>{label}</span>
    </span>
  );
}

function ListingActivityCell({ row }: { row: ListingActivityOverviewRow }) {
  const coverImageUrl = toPublicMediaUrl(row.cover_image_url);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="size-14 shrink-0 overflow-hidden rounded-md bg-muted/70">
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Local listing preview image.
          <img
            src={coverImageUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center bg-primary/10 text-primary">
            <Radar className="size-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-foreground">{row.title}</p>
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
            <span className="truncate text-[11px] font-black text-muted-foreground">
              {row.price_label}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LockedListingActivityState({
  viewerHasAgencyWorkspace,
  viewerRole,
  viewerUsername,
}: {
  viewerHasAgencyWorkspace?: boolean;
  viewerRole?: "user" | "admin";
  viewerUsername?: string;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader
        viewerHasAgencyWorkspace={viewerHasAgencyWorkspace}
        viewerRole={viewerRole}
        viewerUsername={viewerUsername}
      />
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pt-28">
        <Link
          href="/listings"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowRight className="size-4 rotate-180" />
          Back to listings
        </Link>

        <section className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Lock className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Listing buyer activity
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">
                Unlock realtime activity across your listings
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                This page is for buyer activity on listings you own. It is separate
                from the future global active buyers and active sellers discovery
                tools.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/settings/billing">Open billing</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/become-agent">View agent plans</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <GlobalFooter viewerRole={viewerRole} viewerUsername={viewerUsername} />
    </div>
  );
}

export default async function ListingActivityOverviewPage({
  searchParams,
}: ListingActivityOverviewPageProps) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/sign-in?callbackUrl=/listings/activity");
  }

  const query = searchParams ? await searchParams : {};
  const currentPage = parsePage(query.page);
  const shouldRefreshInsight = Boolean(query.refreshInsight);
  const pageSize = 25;
  const offset = (currentPage - 1) * pageSize;

  const [viewer, subscriptionRows] = await Promise.all([
    getViewerChrome(userId),
    sql<{ has_access: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM subscriptions
        WHERE user_id = ${userId}
          AND status = 'active'
          AND (current_period_end IS NULL OR current_period_end > now())
      ) AS has_access
    `,
  ]);
  const hasAccess = Boolean(subscriptionRows[0]?.has_access);

  if (!hasAccess) {
    return (
      <LockedListingActivityState
        viewerHasAgencyWorkspace={viewer.hasAgencyWorkspace}
        viewerRole={viewer.role}
        viewerUsername={viewer.username}
      />
    );
  }

  const [countRows, listingRows, analyticsRows, insightRows] = await Promise.all([
    sql<{ total_rows: number }[]>`
      SELECT count(*)::int AS total_rows
      FROM property_listings
      WHERE user_id = ${userId}
        AND status = 'published'
        AND archived_at IS NULL
    `,
    sql<ListingActivityOverviewRow[]>`
      WITH listing_page AS (
        SELECT
          id,
          title,
          location,
          cover_image_url,
          price_label,
          status,
          listed_at
        FROM property_listings
        WHERE user_id = ${userId}
          AND status = 'published'
          AND archived_at IS NULL
        ORDER BY listed_at DESC, created_at DESC
        LIMIT ${pageSize}
        OFFSET ${offset}
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
        WHERE lve.viewer_user_id IS NULL OR lve.viewer_user_id <> ${userId}
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
        WHERE lae.viewer_user_id IS NULL OR lae.viewer_user_id <> ${userId}
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
          AND (lps.viewer_user_id IS NULL OR lps.viewer_user_id <> ${userId})
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
      LEFT JOIN activity_stats ast ON ast.listing_id = lp.id
      LEFT JOIN latest_event le ON le.listing_id = lp.id
      LEFT JOIN unread_stats us ON us.listing_id = lp.id
      LEFT JOIN presence_stats ps ON ps.listing_id = lp.id
      ORDER BY
        coalesce(us.unread_viewer_count, 0) DESC,
        coalesce(ps.active_viewer_count, 0) DESC,
        ast.latest_seen_at DESC NULLS LAST,
        lp.listed_at DESC
    `,
    sql<ListingActivityAnalyticsRow[]>`
      WITH owned_listings AS (
        SELECT id
        FROM property_listings
        WHERE user_id = ${userId}
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
        JOIN owned_listings ol ON ol.id = lve.listing_id
        WHERE lve.viewer_user_id IS NULL OR lve.viewer_user_id <> ${userId}
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
        JOIN owned_listings ol ON ol.id = lae.listing_id
        WHERE lae.viewer_user_id IS NULL OR lae.viewer_user_id <> ${userId}
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
        JOIN owned_listings ol ON ol.id = lps.listing_id
        WHERE lps.expires_at > now()
          AND (lps.viewer_user_id IS NULL OR lps.viewer_user_id <> ${userId})
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
        JOIN owned_listings ol ON ol.id = lve.listing_id
        WHERE lve.viewer_user_id IS NULL OR lve.viewer_user_id <> ${userId}
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
    sql<ListingPortfolioInsightRow[]>`
      WITH owned_listings AS (
        SELECT id, title
        FROM property_listings
        WHERE user_id = ${userId}
          AND status = 'published'
          AND archived_at IS NULL
      ),
      views AS (
        SELECT
          lve.listing_id,
          lve.viewer_user_id,
          lve.viewer_session_id,
          coalesce(lve.view_instance_id, lve.viewer_session_id) AS view_key,
          coalesce(lve.viewer_user_id::text, lve.viewer_session_id) AS viewer_key,
          lve.created_at
        FROM listing_view_events lve
        JOIN owned_listings ol ON ol.id = lve.listing_id
        WHERE lve.viewer_user_id IS NULL OR lve.viewer_user_id <> ${userId}
      ),
      actions AS (
        SELECT
          lae.listing_id,
          lae.viewer_user_id,
          lae.viewer_session_id,
          coalesce(lae.viewer_user_id::text, lae.viewer_session_id) AS viewer_key,
          lae.action_type,
          lae.created_at
        FROM listing_action_events lae
        JOIN owned_listings ol ON ol.id = lae.listing_id
        WHERE lae.viewer_user_id IS NULL OR lae.viewer_user_id <> ${userId}
      ),
      listing_view_stats AS (
        SELECT
          listing_id,
          count(DISTINCT v.view_key) FILTER (
            WHERE v.created_at >= now() - interval '7 days'
          )::int AS views_7d,
          count(DISTINCT v.viewer_key) FILTER (
            WHERE v.created_at >= now() - interval '7 days'
          )::int AS unique_viewers_7d
        FROM views v
        GROUP BY listing_id
      ),
      listing_action_stats AS (
        SELECT
          listing_id,
          count(*) FILTER (
            WHERE a.created_at >= now() - interval '7 days'
          )::int AS actions_7d,
          count(*) FILTER (
            WHERE a.created_at >= now() - interval '7 days'
              AND a.action_type IN ('bond_calculator', 'contact_agent', 'email_agent', 'call_agent', 'whatsapp_agent', 'place_offer', 'reserve_now')
          )::int AS high_intent_7d
        FROM actions a
        GROUP BY listing_id
      ),
      listing_stats AS (
        SELECT
          ol.id,
          ol.title,
          coalesce(lvs.views_7d, 0)::int AS views_7d,
          coalesce(las.actions_7d, 0)::int AS actions_7d,
          coalesce(las.high_intent_7d, 0)::int AS high_intent_7d
        FROM owned_listings ol
        LEFT JOIN listing_view_stats lvs ON lvs.listing_id = ol.id
        LEFT JOIN listing_action_stats las ON las.listing_id = ol.id
      ),
      top_listing AS (
        SELECT title, views_7d, actions_7d
        FROM listing_stats
        ORDER BY high_intent_7d DESC, actions_7d DESC, views_7d DESC, title ASC
        LIMIT 1
      ),
      weakest_listing AS (
        SELECT title, views_7d, actions_7d
        FROM listing_stats
        ORDER BY high_intent_7d ASC, actions_7d ASC, views_7d ASC, title ASC
        LIMIT 1
      ),
      presence_stats AS (
        SELECT count(DISTINCT lps.viewer_session_id)::int AS active_now
        FROM listing_presence_sessions lps
        JOIN owned_listings ol ON ol.id = lps.listing_id
        WHERE lps.expires_at > now()
          AND (lps.viewer_user_id IS NULL OR lps.viewer_user_id <> ${userId})
      ),
      viewer_counts AS (
        SELECT
          count(DISTINCT viewer_key) FILTER (
            WHERE created_at >= now() - interval '7 days'
          )::int AS unique_buyers_7d,
          count(DISTINCT viewer_key) FILTER (
            WHERE created_at >= now() - interval '7 days'
              AND viewer_key IN (
                SELECT viewer_key
                FROM views
                WHERE created_at >= now() - interval '7 days'
                GROUP BY viewer_key
                HAVING count(DISTINCT listing_id) > 1 OR count(DISTINCT view_key) > 1
              )
          )::int AS returning_viewers_7d
        FROM views
      ),
      view_totals AS (
        SELECT
          count(DISTINCT view_key) FILTER (
            WHERE created_at >= now() - interval '24 hours'
          )::int AS views_24h,
          count(DISTINCT view_key) FILTER (
            WHERE created_at >= now() - interval '48 hours'
              AND created_at < now() - interval '24 hours'
          )::int AS previous_views_24h,
          count(DISTINCT view_key) FILTER (
            WHERE created_at >= now() - interval '7 days'
          )::int AS views_7d
        FROM views
      ),
      action_totals AS (
        SELECT
          count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS action_events_7d,
          count(*) FILTER (
            WHERE created_at >= now() - interval '7 days'
              AND action_type IN ('bond_calculator', 'contact_agent', 'email_agent', 'call_agent', 'whatsapp_agent', 'place_offer', 'reserve_now')
          )::int AS high_intent_events_7d,
          count(*) FILTER (
            WHERE created_at >= now() - interval '7 days'
              AND action_type IN ('browse_photos', 'photo_browse', 'photos_browsed')
          )::int AS photo_events_7d,
          count(*) FILTER (
            WHERE created_at >= now() - interval '7 days'
              AND action_type = 'bond_calculator'
          )::int AS calculator_events_7d,
          count(*) FILTER (
            WHERE created_at >= now() - interval '7 days'
              AND action_type IN ('place_offer', 'offer_started', 'start_offer')
          )::int AS offer_events_7d
        FROM actions
      )
      SELECT
        (SELECT count(*)::int FROM owned_listings) AS listing_count,
        coalesce(ps.active_now, 0)::int AS active_now,
        coalesce(vc.unique_buyers_7d, 0)::int AS unique_buyers_7d,
        coalesce(vc.returning_viewers_7d, 0)::int AS returning_viewers_7d,
        coalesce(vt.views_24h, 0)::int AS views_24h,
        coalesce(vt.previous_views_24h, 0)::int AS previous_views_24h,
        coalesce(vt.views_7d, 0)::int AS views_7d,
        coalesce(at.action_events_7d, 0)::int AS action_events_7d,
        coalesce(at.high_intent_events_7d, 0)::int AS high_intent_events_7d,
        coalesce(at.photo_events_7d, 0)::int AS photo_events_7d,
        coalesce(at.calculator_events_7d, 0)::int AS calculator_events_7d,
        coalesce(at.offer_events_7d, 0)::int AS offer_events_7d,
        (
          SELECT count(*)::int
          FROM listing_stats
          WHERE views_7d = 0 AND actions_7d = 0
        ) AS zero_activity_listings_7d,
        (
          coalesce(vt.views_7d, 0) + coalesce(at.action_events_7d, 0)
        )::int AS total_events_7d,
        tl.title AS top_listing_title,
        tl.views_7d AS top_listing_views_7d,
        tl.actions_7d AS top_listing_actions_7d,
        wl.title AS weakest_listing_title,
        wl.views_7d AS weakest_listing_views_7d,
        wl.actions_7d AS weakest_listing_actions_7d
      FROM presence_stats ps
      CROSS JOIN viewer_counts vc
      CROSS JOIN view_totals vt
      CROSS JOIN action_totals at
      LEFT JOIN top_listing tl ON true
      LEFT JOIN weakest_listing wl ON true
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
  const portfolioInsight = insightRows[0] || {
    active_now: 0,
    action_events_7d: 0,
    calculator_events_7d: 0,
    high_intent_events_7d: 0,
    listing_count: totalRows,
    offer_events_7d: 0,
    photo_events_7d: 0,
    previous_views_24h: 0,
    returning_viewers_7d: 0,
    top_listing_actions_7d: null,
    top_listing_title: null,
    top_listing_views_7d: null,
    total_events_7d: 0,
    unique_buyers_7d: 0,
    views_24h: 0,
    views_7d: 0,
    weakest_listing_actions_7d: null,
    weakest_listing_title: null,
    weakest_listing_views_7d: null,
    zero_activity_listings_7d: 0,
  };
  const portfolioFingerprint = listingPortfolioFingerprint({
    insight: portfolioInsight,
    totalRows,
    userId,
  });
  const portfolioNarrative = await generateListingPortfolioNarrative({
    activityFingerprint: portfolioFingerprint,
    allowRefresh: shouldRefreshInsight,
    insight: portfolioInsight,
    ownerUserId: userId,
    totalRows,
  });
  const insightRefreshParams = new URLSearchParams();

  if (safeCurrentPage > 1) insightRefreshParams.set("page", String(safeCurrentPage));
  insightRefreshParams.set("refreshInsight", "1");

  const insightRefreshHref = `/listings/activity?${insightRefreshParams.toString()}`;
  const trend = formatTrend(analytics.total_views_24h, analytics.previous_views_24h);
  const TrendIcon = trend.direction === "down" ? TrendingDown : TrendingUp;
  const firstRow = totalRows ? offset + 1 : 0;
  const lastRow = Math.min(offset + listingRows.length, totalRows);
  const columns: Array<CanonicalTableColumn<ListingActivityOverviewRow>> = [
    {
      className: "w-full md:w-[40%]",
      header: "Listing",
      key: "listing",
      render: (row) => <ListingActivityCell row={row} />,
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
          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-red-500 px-2 py-1 text-[10px] font-black text-white">
            {row.unread_viewer_count}
          </span>
        ) : (
          <span className="text-xs font-semibold text-muted-foreground">-</span>
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
        const label = row.active_viewer_count > 0
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
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader viewerHasAgencyWorkspace={viewer.hasAgencyWorkspace} viewerRole={viewer.role} viewerUsername={viewer.username} />
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pt-28">
        <section className="border-b border-border pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                <Radar className="size-4" />
                Listing buyer activity
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">
                Realtime buyers on your listings
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Monitor buyer activity across listings you own. This is not the
                future global active buyers discovery page.
              </p>
            </div>
            <ActivityRealtimeRefresh clearSearchParams={["refreshInsight"]} />
          </div>
        </section>

        <section className="mt-5 grid overflow-hidden rounded-lg border border-border bg-card shadow-sm md:grid-cols-4">
          <AnalyticsStat
            description="Across listings you own"
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
            description="Unread buyer groups"
            icon={Eye}
            label="New listing activity"
            tone={analytics.unread_viewer_count > 0 ? "red" : "purple"}
            value={`${analytics.unread_viewer_count} new`}
          />
          <AnalyticsStat
            description={trend.label}
            icon={TrendIcon}
            label="Listing views"
            tone={trend.direction === "down" ? "red" : trend.direction === "up" ? "green" : "purple"}
            value={plural(analytics.total_views_24h, "view")}
          />
        </section>

        <ListingPortfolioInsightPanel
          insight={portfolioInsight}
          narrative={portfolioNarrative}
          refreshHref={insightRefreshHref}
          refreshRequested={shouldRefreshInsight}
        />

        <section className="mt-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {firstRow}-{lastRow} of {totalRows} listings
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <form action={clearAllListingBuyerActivityAction}>
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
              <p className="text-xs font-semibold text-muted-foreground">
                Page {safeCurrentPage} of {totalPages}
              </p>
            </div>
          </div>

          <CanonicalTable
            columns={columns}
            emptyState="No listings found yet."
            getRowHref={(row) => `/listings/${row.id}/activity?from=overview`}
            getRowKey={(row) => row.id}
            minWidth="0"
            pagination={{
              currentPage: safeCurrentPage,
              hrefForPage: (page) =>
                page > 1 ? `/listings/activity?page=${page}` : "/listings/activity",
              manual: true,
              pageSize,
              totalItems: totalRows,
            }}
            rows={listingRows}
            tableClassName="table-fixed text-xs md:text-sm"
          />
        </section>
      </main>
      <GlobalFooter viewerRole={viewer.role} viewerUsername={viewer.username} />
    </div>
  );
}
