import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Bookmark,
  Eye,
  Heart,
  MousePointerClick,
  Send,
  Share2,
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
  type ListingAnalyticsDetail,
  formatAnalyticsDate,
  getListingAnalyticsDetail,
  getOwnerAnalyticsProfile,
  parseAnalyticsRange,
} from "@/modules/users/analytics/content-analytics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Listing Analytics | Homzie",
  description: "Review listing analytics on Homzie.",
};

type ListingAnalyticsDetailPageProps = {
  params: Promise<{ listingId: string; username: string }>;
  searchParams?: Promise<{ range?: string }>;
};

function ListingSummary({ listing }: { listing: ListingAnalyticsDetail }) {
  const rows = [
    ["Status", listing.status],
    ["Price", listing.priceLabel],
    ["Location", listing.location || "Location not set"],
    ["Created", formatAnalyticsDate(listing.createdAt)],
    ["Updated", formatAnalyticsDate(listing.updatedAt)],
    ["Last activity", formatAnalyticsDate(listing.lastActivityAt)],
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
        Listing
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight">{listing.title}</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-muted/35 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-sm font-black">{value}</p>
          </div>
        ))}
      </div>
      <Button asChild variant="outline" className="mt-5">
        <Link href={listing.href}>Open listing</Link>
      </Button>
    </div>
  );
}

export default async function ListingAnalyticsDetailPage({
  params,
  searchParams,
}: ListingAnalyticsDetailPageProps) {
  const { listingId, username } = await params;
  const query = searchParams ? await searchParams : {};
  const range = parseAnalyticsRange(query.range);
  const profile = await getOwnerAnalyticsProfile(username);
  const [viewer, listing] = await Promise.all([
    getViewerChrome(profile.id),
    getListingAnalyticsDetail(profile.id, listingId, range),
  ]);

  if (!listing) {
    return (
      <>
        <GlobalHeader viewerHasAgencyWorkspace={viewer.hasAgencyWorkspace} viewerRole={viewer.role} viewerUsername={viewer.username} />
        <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-24 lg:pt-28">
          <Button asChild variant="ghost" className="mb-6 px-0">
            <Link href={`/users/${profile.username}/analytics`}>
              <ArrowLeft className="size-4" />
              Analytics
            </Link>
          </Button>
          <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
            <h1 className="text-2xl font-black">Listing analytics not found</h1>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              This listing does not belong to your profile or no longer exists.
            </p>
          </div>
        </main>
        <GlobalFooter viewerRole={viewer.role} viewerUsername={viewer.username} />
      </>
    );
  }

  return (
    <>
      <GlobalHeader viewerHasAgencyWorkspace={viewer.hasAgencyWorkspace} viewerRole={viewer.role} viewerUsername={viewer.username} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-14 pt-24 sm:px-6 lg:px-8 lg:pb-10 lg:pt-28">
        <section>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Link
                  href={`/users/${profile.username}/analytics?type=listings&range=${range.key}`}
                  className="mb-4 inline-flex items-center gap-2 text-sm font-black text-muted-foreground transition-colors hover:text-primary"
                >
                  <ArrowLeft className="size-4" />
                  Back to analytics
                </Link>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
                  Listing
                </p>
                <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
                  Analytics
                </h1>
                <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
                  A focused view of this listing&apos;s discovery, saves, shares,
                  contact, and reservation intent.
                </p>
              </div>
              <AnalyticsRangeDropdown
                activeRangeKey={range.key}
                baseHref={`/users/${profile.username}/analytics/listings/${listing.id}`}
              />
            </div>
          </div>
        </section>

        <AnalyticsMetricTable
          metrics={[
            { icon: Eye, label: "Impressions", value: listing.impressionCount },
            { icon: BarChart3, label: "Hovers", value: listing.hoverCount },
            { icon: MousePointerClick, label: "Clicks", value: listing.clickCount },
            { icon: Bookmark, label: "Saves", value: listing.saveCount },
            { icon: UserPlus, label: "Follows", value: listing.followCount },
            { icon: Share2, label: "Shares", value: listing.shareCount },
            { icon: Heart, label: "Likes", value: listing.likeCount },
            { icon: Send, label: "Contacts", value: listing.contactCount },
          ]}
        />

        <section className="mt-6">
          <AnalyticsTrendChart
            points={listing.trend}
            title={`Activity over ${range.label.toLowerCase()}`}
          />
        </section>

        <section className="mt-6">
          <ListingSummary listing={listing} />
        </section>

        <section className="mt-6">
          <AnalyticsBreakdownBars
            emptyLabel="No listing actions recorded in this time period."
            rows={listing.actionBreakdown}
            title="Action breakdown"
          />
        </section>
      </main>
      <GlobalFooter viewerRole={viewer.role} viewerUsername={viewer.username} />
    </>
  );
}
