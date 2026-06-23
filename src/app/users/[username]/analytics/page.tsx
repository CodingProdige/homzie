import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Bookmark,
  Clapperboard,
  Eye,
  Home,
  MousePointerClick,
  Send,
  Share2,
  TrendingUp,
} from "lucide-react";

import { CanonicalTable, type CanonicalTableColumn } from "@/components/ui/canonical-table";
import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { getViewerChrome } from "@/modules/auth/viewer";
import { AnalyticsRangeDropdown } from "@/modules/users/analytics/analytics-range-dropdown";
import {
  type ContentAnalyticsTab,
  type ListingAnalyticsRow,
  type ReelAnalyticsRow,
  formatAnalyticsDate,
  formatMetric,
  getListingAnalyticsRows,
  getOwnerAnalyticsProfile,
  getReelAnalyticsRows,
  parseAnalyticsRange,
  parseAnalyticsTab,
} from "@/modules/users/analytics/content-analytics";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Content Analytics | Homzie",
  description: "Review profile listing and reel analytics on Homzie.",
};

type ProfileAnalyticsPageProps = {
  params: Promise<{ username: string }>;
  searchParams?: Promise<{ page?: string; range?: string; type?: string }>;
};

const analyticsTablePageSize = 10;

function positivePage(value: unknown) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function totalBy<T>(rows: T[], getValue: (row: T) => number) {
  return rows.reduce((total, row) => total + getValue(row), 0);
}

function AnalyticsCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BarChart3;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-primary">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function AnalyticsTabs({
  activeTab,
  rangeKey,
  username,
}: {
  activeTab: ContentAnalyticsTab;
  rangeKey: string;
  username: string;
}) {
  const tabs: Array<{ href: string; label: string; value: ContentAnalyticsTab }> = [
    {
      href: `/users/${username}/analytics?type=listings&range=${rangeKey}`,
      label: "Listings",
      value: "listings",
    },
    {
      href: `/users/${username}/analytics?type=reels&range=${rangeKey}`,
      label: "Reels",
      value: "reels",
    },
  ];

  return (
    <div className="inline-flex max-w-full rounded-lg border border-border bg-muted/40 p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={tab.href}
          className={cn(
            "rounded-md border border-transparent px-4 py-2 text-sm font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
            activeTab === tab.value
              ? "border-primary/25 bg-primary/15 text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

const listingColumns: Array<CanonicalTableColumn<ListingAnalyticsRow>> = [
  {
    header: "Listing",
    key: "listing",
    render: (row) => (
      <div>
        <p className="line-clamp-1 font-black">{row.title}</p>
        <p className="mt-1 text-xs font-bold text-muted-foreground">
          {row.location || "Location not set"} - {row.status}
        </p>
      </div>
    ),
  },
  {
    className: "text-right",
    header: "Impressions",
    key: "impressions",
    render: (row) => formatMetric(row.impressionCount),
  },
  {
    className: "text-right",
    header: "Hovers",
    key: "hovers",
    render: (row) => formatMetric(row.hoverCount),
  },
  {
    className: "text-right",
    header: "Clicks",
    key: "clicks",
    render: (row) => formatMetric(row.clickCount),
  },
  {
    className: "text-right",
    header: "Saves",
    key: "saves",
    render: (row) => formatMetric(row.saveCount),
  },
  {
    className: "text-right",
    header: "Follows",
    key: "follows",
    render: (row) => formatMetric(row.followCount),
  },
  {
    className: "text-right",
    header: "Shares",
    key: "shares",
    render: (row) => formatMetric(row.shareCount),
  },
  {
    className: "text-right",
    header: "Last activity",
    key: "lastActivity",
    render: (row) => formatAnalyticsDate(row.lastActivityAt),
  },
];

const reelColumns: Array<CanonicalTableColumn<ReelAnalyticsRow>> = [
  {
    header: "Reel",
    key: "reel",
    render: (row) => (
      <div>
        <p className="line-clamp-1 font-black">{row.caption}</p>
        <p className="mt-1 text-xs font-bold text-muted-foreground">
          {row.status} - {formatMetric(row.watchSessions)} watch sessions
        </p>
      </div>
    ),
  },
  {
    className: "text-right",
    header: "Impressions",
    key: "impressions",
    render: (row) => formatMetric(row.impressionCount),
  },
  {
    className: "text-right",
    header: "Hovers",
    key: "hovers",
    render: (row) => formatMetric(row.hoverCount),
  },
  {
    className: "text-right",
    header: "Clicks",
    key: "clicks",
    render: (row) => formatMetric(row.clickCount),
  },
  {
    className: "text-right",
    header: "Saves",
    key: "saves",
    render: (row) => formatMetric(row.saveCount),
  },
  {
    className: "text-right",
    header: "Follows",
    key: "follows",
    render: (row) => formatMetric(row.followCount),
  },
  {
    className: "text-right",
    header: "Shares",
    key: "shares",
    render: (row) => formatMetric(row.shareCount),
  },
  {
    className: "text-right",
    header: "Completion",
    key: "completion",
    render: (row) => `${row.completionRate}%`,
  },
];

export default async function ProfileAnalyticsPage({
  params,
  searchParams,
}: ProfileAnalyticsPageProps) {
  const { username } = await params;
  const query = searchParams ? await searchParams : {};
  const activeTab = parseAnalyticsTab(query.type);
  const currentPage = positivePage(query.page);
  const range = parseAnalyticsRange(query.range);
  const profile = await getOwnerAnalyticsProfile(username);
  const [viewer, listings, reels] = await Promise.all([
    getViewerChrome(profile.id),
    getListingAnalyticsRows(profile.id, range),
    getReelAnalyticsRows(profile.id, range),
  ]);
  const totals = {
    clicks:
      totalBy(listings, (row) => row.clickCount) +
      totalBy(reels, (row) => row.clickCount),
    content: listings.length + reels.length,
    saves:
      totalBy(listings, (row) => row.saveCount) +
      totalBy(reels, (row) => row.saveCount),
    shares:
      totalBy(listings, (row) => row.shareCount) +
      totalBy(reels, (row) => row.shareCount),
    views:
      totalBy(listings, (row) => row.impressionCount) +
      totalBy(reels, (row) => row.impressionCount),
  };

  return (
    <>
      <GlobalHeader viewerHasAgencyWorkspace={viewer.hasAgencyWorkspace} viewerRole={viewer.role} viewerUsername={viewer.username} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-14 pt-24 sm:px-6 lg:px-8 lg:pb-10 lg:pt-28">
        <section>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Link
                  href={`/users/${profile.username}`}
                  className="mb-4 inline-flex items-center gap-2 text-sm font-black text-muted-foreground transition-colors hover:text-primary"
                >
                  <ArrowLeft className="size-4" />
                  Back to profile
                </Link>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
                  Profile
                </p>
                <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
                  Content Analytics
                </h1>
                <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
                  Track how your listings and reels are performing across discovery,
                  saves, shares, clicks, and deeper engagement.
                </p>
              </div>
              <AnalyticsRangeDropdown
                activeRangeKey={range.key}
                baseHref={`/users/${profile.username}/analytics?type=${activeTab}`}
              />
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <AnalyticsCard icon={Home} label="Content" value={totals.content} />
          <AnalyticsCard
            icon={Eye}
            label="Impressions"
            value={formatMetric(totals.views)}
          />
          <AnalyticsCard
            icon={MousePointerClick}
            label="Clicks"
            value={formatMetric(totals.clicks)}
          />
          <AnalyticsCard
            icon={Bookmark}
            label="Saves"
            value={formatMetric(totals.saves)}
          />
          <AnalyticsCard
            icon={Share2}
            label="Shares"
            value={formatMetric(totals.shares)}
          />
        </section>

        <section className="mt-8 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
                Breakdown
              </p>
              <h2 className="mt-1 text-xl font-black">Content performance</h2>
            </div>
            <AnalyticsTabs
              activeTab={activeTab}
              rangeKey={range.key}
              username={profile.username}
            />
          </div>

          <div className="mt-5">
            {activeTab === "listings" ? (
              <CanonicalTable
                columns={listingColumns}
                emptyState="No listings yet. Published and draft listing analytics will appear here."
                getRowHref={(row) =>
                  `/users/${profile.username}/analytics/listings/${row.id}?range=${range.key}`
                }
                getRowKey={(row) => row.id}
                pagination={{
                  currentPage,
                  hrefForPage: (page) =>
                    `/users/${profile.username}/analytics?type=listings&range=${range.key}&page=${page}`,
                  pageSize: analyticsTablePageSize,
                }}
                rows={listings}
              />
            ) : (
              <CanonicalTable
                columns={reelColumns}
                emptyState="No reels yet. Reel analytics will appear here once you post."
                getRowHref={(row) =>
                  `/users/${profile.username}/analytics/reels/${row.id}?range=${range.key}`
                }
                getRowKey={(row) => row.id}
                pagination={{
                  currentPage,
                  hrefForPage: (page) =>
                    `/users/${profile.username}/analytics?type=reels&range=${range.key}&page=${page}`,
                  pageSize: analyticsTablePageSize,
                }}
                rows={reels}
              />
            )}
          </div>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/35 p-4">
            <TrendingUp className="size-5 text-primary" />
            <h3 className="mt-3 font-black">Impressions and hovers</h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
              Detail pages are tracked today. Feed-level hover and impression
              capture can now plug into these columns.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/35 p-4">
            <Send className="size-5 text-primary" />
            <h3 className="mt-3 font-black">Click intent</h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
              Listing contact, offer, reserve, calculator, and reel listing-card
              taps are counted as clicks.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/35 p-4">
            <Clapperboard className="size-5 text-primary" />
            <h3 className="mt-3 font-black">Reel depth</h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
              Watch sessions, completion rate, saves, comments, and reshares show
              whether a reel is holding attention.
            </p>
          </div>
        </section>
      </main>
      <GlobalFooter viewerRole={viewer.role} viewerUsername={viewer.username} />
    </>
  );
}
