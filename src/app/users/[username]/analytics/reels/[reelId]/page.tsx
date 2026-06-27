import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Bookmark,
  Clapperboard,
  Eye,
  Heart,
  MessageCircle,
  MousePointerClick,
  RotateCw,
  UserPlus,
} from "lucide-react";

import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { Button } from "@/components/ui/button";
import { getViewerChrome } from "@/modules/auth/viewer";
import {
  AnalyticsBreakdownBars,
  AnalyticsMetricTable,
  AnalyticsTrendChart,
} from "@/modules/users/analytics/analytics-visuals";
import { AnalyticsRangeDropdown } from "@/modules/users/analytics/analytics-range-dropdown";
import {
  type ReelAnalyticsDetail,
  formatAnalyticsDate,
  formatMetric,
  getOwnerAnalyticsProfile,
  getReelAnalyticsDetail,
  parseAnalyticsRange,
} from "@/modules/users/analytics/content-analytics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reel Analytics | Homzie",
  description: "Review reel analytics on Homzie.",
};

type ReelAnalyticsDetailPageProps = {
  params: Promise<{ reelId: string; username: string }>;
  searchParams?: Promise<{ range?: string }>;
};

function ReelSummary({ reel }: { reel: ReelAnalyticsDetail }) {
  const rows = [
    ["Status", reel.status],
    ["Watch sessions", formatMetric(reel.watchSessions)],
    ["Average progress", `${reel.averageProgressPercent}%`],
    ["Average watch", `${formatMetric(reel.averageWatchSeconds)}s`],
    ["Created", formatAnalyticsDate(reel.createdAt)],
    ["Last activity", formatAnalyticsDate(reel.lastActivityAt)],
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
        Reel
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="aspect-[9/16] overflow-hidden rounded-lg bg-brand-midnight">
          {reel.thumbnailUrl ? (
            <Image
              src={reel.thumbnailUrl}
              alt={reel.caption}
              width={360}
              height={640}
              className="size-full object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center text-white">
              <Clapperboard className="size-10" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight">{reel.caption}</h2>
          <Button asChild variant="outline" className="mt-5">
            <Link href={`/reels/${reel.id}`}>Open reel</Link>
          </Button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-muted/35 p-3">
            <p className="text-[11px] font-normal uppercase tracking-[0.12em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function ReelAnalyticsDetailPage({
  params,
  searchParams,
}: ReelAnalyticsDetailPageProps) {
  const { reelId, username } = await params;
  const query = searchParams ? await searchParams : {};
  const range = parseAnalyticsRange(query.range);
  const profile = await getOwnerAnalyticsProfile(username);
  const [viewer, reel] = await Promise.all([
    getViewerChrome(profile.id),
    getReelAnalyticsDetail(profile.id, reelId, range),
  ]);

  if (!reel) {
    return (
      <>
        <GlobalHeader
          viewerAvatarUrl={viewer.avatarUrl}
          viewerHasAgencyWorkspace={viewer.hasAgencyWorkspace}
          viewerName={viewer.name}
          viewerRole={viewer.role}
          viewerUsername={viewer.username}
        />
        <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-24 lg:pt-28">
          <Button asChild variant="ghost" className="mb-6 px-0">
            <Link href={`/users/${profile.username}/analytics?type=reels`}>
              <ArrowLeft className="size-4" />
              Analytics
            </Link>
          </Button>
          <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
            <h1 className="text-2xl font-semibold">Reel analytics not found</h1>
            <p className="mt-2 text-sm font-normal text-muted-foreground">
              This reel does not belong to your profile or no longer exists.
            </p>
          </div>
        </main>
        <GlobalFooter viewerRole={viewer.role} viewerUsername={viewer.username} />
      </>
    );
  }

  return (
    <>
      <GlobalHeader
        viewerAvatarUrl={viewer.avatarUrl}
        viewerHasAgencyWorkspace={viewer.hasAgencyWorkspace}
        viewerName={viewer.name}
        viewerRole={viewer.role}
        viewerUsername={viewer.username}
      />
      <main className="mx-auto w-full max-w-6xl px-4 pb-14 pt-24 sm:px-6 lg:px-8 lg:pb-10 lg:pt-28">
        <section>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Link
                  href={`/users/${profile.username}/analytics?type=reels&range=${range.key}`}
                  className="mb-4 inline-flex items-center gap-2 text-sm font-normal text-muted-foreground transition-colors hover:text-primary"
                >
                  <ArrowLeft className="size-4" />
                  Back to analytics
                </Link>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  Reel
                </p>
                <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
                  Analytics
                </h1>
                <p className="mt-4 max-w-2xl text-sm font-normal leading-7 text-muted-foreground">
                  A focused view of this reel&apos;s reach, watch depth, listing
                  clicks, saves, comments, and reshares.
                </p>
              </div>
              <AnalyticsRangeDropdown
                activeRangeKey={range.key}
                baseHref={`/users/${profile.username}/analytics/reels/${reel.id}`}
              />
            </div>
          </div>
        </section>

        <AnalyticsMetricTable
          metrics={[
            { icon: Eye, label: "Impressions", value: reel.impressionCount },
            { icon: BarChart3, label: "Hovers", value: reel.hoverCount },
            { icon: MousePointerClick, label: "Clicks", value: reel.clickCount },
            { icon: Bookmark, label: "Saves", value: reel.saveCount },
            { icon: UserPlus, label: "Follows", value: reel.followCount },
            { icon: RotateCw, label: "Reshares", value: reel.shareCount },
            { icon: Heart, label: "Likes", value: reel.likeCount },
            { icon: MessageCircle, label: "Comments", value: reel.commentCount },
          ]}
        />

        <section className="mt-6">
          <AnalyticsTrendChart
            points={reel.trend}
            title={`Activity over ${range.label.toLowerCase()}`}
          />
        </section>

        <section className="mt-6">
          <ReelSummary reel={reel} />
        </section>

        <section className="mt-6">
          <AnalyticsBreakdownBars
            emptyLabel="No reel events recorded in this time period."
            labelHeader="Event"
            rows={reel.eventBreakdown}
            title="Playback breakdown"
          />
        </section>
      </main>
      <GlobalFooter viewerRole={viewer.role} viewerUsername={viewer.username} />
    </>
  );
}
