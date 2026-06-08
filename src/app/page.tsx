import Link from "next/link";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import {
  and,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import {
  ChevronRight,
  LocateFixed,
  Search,
  SlidersHorizontal,
  Tag,
  type LucideIcon,
} from "lucide-react";

import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { HorizontalScrollRail } from "@/components/horizontal-scroll-rail";
import { RotatingHeroCopy } from "@/components/rotating-hero-copy";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import {
  agentProfiles,
  propertyListings,
  subscriptions,
  users,
} from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import { authOptions } from "@/modules/auth/config";
import { getViewerChrome } from "@/modules/auth/viewer";
import {
  appendCountryPreference,
  countryPreferenceCookie,
  parseCountryPreference,
  type CountryPreference,
} from "@/modules/location/country-preference";
import {
  ListingCard,
  type ListingCardData,
} from "@/modules/listings/components/listing-card";
import { ListingsInfiniteGrid } from "@/modules/listings/components/listings-infinite-grid";
import { PropertySearchBar } from "@/modules/listings/components/property-search-bar";
import {
  listingTypeOptions,
  propertyTypeOptions,
} from "@/modules/listings/options";
import {
  getDiscoverListings,
  getDiscoverListingFilterOptions,
  normalizeDiscoverListingFilters,
} from "@/modules/listings/server/discover-listings";
import { getPlatformStats } from "@/modules/platform-stats/actions";
import { LivePlatformStats } from "@/modules/platform-stats/components/live-platform-stats";
import { ReelPreviewCard } from "@/modules/reels/components/reel-preview-card";
import { getRecommendedReelPreviews } from "@/modules/reels/server/recommendations";

type HomePageProps = {
  searchParams?: Promise<{
    area?: string[] | string;
    bathrooms?: string;
    bedrooms?: string;
    buyerIncentive?: string;
    countryName?: string;
    features?: string[] | string;
    furnishedStatus?: string;
    garages?: string;
    listingType?: string[] | string;
    maxErfSize?: string;
    maxFloorSize?: string;
    maxPrice?: string;
    minErfSize?: string;
    minFloorSize?: string;
    minPrice?: string;
    parking?: string;
    petsAllowed?: string;
    propertyType?: string[] | string;
    shortLetAllowed?: string;
  }>;
};

type HomeMediaCard = {
  href: string;
  imageUrl: string;
  meta?: string;
  showBadge?: boolean;
  title: string;
};

type HomeListingSummary = {
  coverImageUrl: string | null;
  details: unknown;
  id: string;
  listingType: string;
  location: string | null;
  media: unknown;
  propertyType: string;
};

type TopAgent = {
  avatarUrl: string | null;
  location: string;
  name: string;
  soldCount: number;
  totalSoldValueCents: number;
  totalSoldValueLabel: string;
  username: string;
};

const heroImage =
  "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1600&q=85";
const homeDiscoverListingsPageSize = 24;

function metadataObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function listingImageUrl(listing: HomeListingSummary) {
  const coverImageUrl = toPublicMediaUrl(listing.coverImageUrl);

  if (coverImageUrl) return coverImageUrl;

  const media = Array.isArray(listing.media) ? listing.media : [];

  for (const item of media) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;

    const mediaUrl = toPublicMediaUrl((item as Record<string, unknown>).path as string);

    if (mediaUrl) return mediaUrl;
  }

  return heroImage;
}

function listingAreaName(listing: HomeListingSummary) {
  const details = metadataObject(listing.details);
  const explicitArea =
    stringValue(details.suburb) || stringValue(details.city) || stringValue(details.area);

  if (explicitArea) return explicitArea;

  const locationParts = (listing.location || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (locationParts.length >= 4) return locationParts[1];
  if (locationParts.length >= 2) return locationParts[0];

  return listing.location || "";
}

function listingCountLabel(count: number) {
  return `${count} ${count === 1 ? "listing" : "listings"}`;
}

function formatCurrencyCompact(cents: number) {
  if (!cents) return "No recorded sales";

  const amount = cents / 100;

  return new Intl.NumberFormat("en", {
    compactDisplay: "short",
    currency: "ZAR",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
  }).format(amount);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

async function getHomeListings(countryName?: string) {
  const filters = [
    eq(propertyListings.status, "published"),
    countryName
      ? or(
          ilike(propertyListings.location, `%${countryName}%`),
          sql`${propertyListings.details}->>'country' ilike ${`%${countryName}%`}`,
        )
      : undefined,
  ].filter(Boolean);

  return db
    .select({
      coverImageUrl: propertyListings.coverImageUrl,
      details: propertyListings.details,
      id: propertyListings.id,
      listingType: propertyListings.listingType,
      location: propertyListings.location,
      media: propertyListings.media,
      propertyType: propertyListings.propertyType,
    })
    .from(propertyListings)
    .where(and(...filters))
    .orderBy(desc(propertyListings.listedAt))
    .limit(200);
}

async function getHomeReels({
  areas,
  countryPreference,
  viewerUserId,
}: {
  areas: string[];
  countryPreference?: CountryPreference | null;
  viewerUserId?: string | null;
}) {
  return getRecommendedReelPreviews({
    areas,
    countryPreference,
    limit: 12,
    viewerUserId,
  });
}

async function getTopSubscribedAgents(countryName?: string): Promise<TopAgent[]> {
  const now = new Date();
  const oneYearAgo = new Date(now);

  oneYearAgo.setFullYear(now.getFullYear() - 1);

  const agentRows = await db
    .select({
      avatarUrl: users.avatarUrl,
      id: users.id,
      location: agentProfiles.location,
      name: users.name,
      username: users.username,
    })
    .from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.userId))
    .innerJoin(agentProfiles, eq(agentProfiles.id, subscriptions.agentProfileId))
    .where(
      and(
        eq(subscriptions.status, "active"),
        gt(subscriptions.currentPeriodEnd, now),
        eq(agentProfiles.status, "active"),
        eq(users.status, "active"),
      ),
    )
    .orderBy(desc(subscriptions.currentPeriodEnd))
    .limit(24);
  const uniqueAgents = Array.from(
    new Map(
      agentRows
        .filter((agent) => agent.username)
        .map((agent) => [agent.id, agent]),
    ).values(),
  );

  if (!uniqueAgents.length) return [];

  const soldRows = await db
    .select({
      soldPriceCents: propertyListings.soldPriceCents,
      userId: propertyListings.userId,
    })
    .from(propertyListings)
    .where(
      and(
        inArray(
          propertyListings.userId,
          uniqueAgents.map((agent) => agent.id),
        ),
        eq(propertyListings.status, "sold"),
        or(
          gte(propertyListings.soldAt, oneYearAgo),
          and(
            isNull(propertyListings.soldAt),
            gte(propertyListings.outcomeAt, oneYearAgo),
          ),
          and(
            isNull(propertyListings.soldAt),
            isNull(propertyListings.outcomeAt),
            gte(propertyListings.listedAt, oneYearAgo),
          ),
        ),
      ),
    );
  const totalsByUserId = new Map<
    string,
    { soldCount: number; totalSoldValueCents: number }
  >();

  soldRows.forEach((listing) => {
    const current = totalsByUserId.get(listing.userId) || {
      soldCount: 0,
      totalSoldValueCents: 0,
    };

    totalsByUserId.set(listing.userId, {
      soldCount: current.soldCount + 1,
      totalSoldValueCents:
        current.totalSoldValueCents + (listing.soldPriceCents || 0),
    });
  });

  return uniqueAgents
    .map((agent) => {
      const totals = totalsByUserId.get(agent.id) || {
        soldCount: 0,
        totalSoldValueCents: 0,
      };

      return {
        avatarUrl: toPublicMediaUrl(agent.avatarUrl),
        location: agent.location || countryName || "Homzie agent",
        name: agent.name,
        soldCount: totals.soldCount,
        totalSoldValueCents: totals.totalSoldValueCents,
        totalSoldValueLabel: formatCurrencyCompact(totals.totalSoldValueCents),
        username: agent.username || "",
      };
    })
    .filter((agent) => agent.username)
    .sort((first, second) => {
      const firstLocationMatches =
        countryName && first.location.toLowerCase().includes(countryName.toLowerCase());
      const secondLocationMatches =
        countryName && second.location.toLowerCase().includes(countryName.toLowerCase());

      if (firstLocationMatches !== secondLocationMatches) {
        return firstLocationMatches ? -1 : 1;
      }

      if (second.totalSoldValueCents !== first.totalSoldValueCents) {
        return second.totalSoldValueCents - first.totalSoldValueCents;
      }

      return second.soldCount - first.soldCount;
    })
    .slice(0, 10);
}

function buildHomeListingStats(listings: HomeListingSummary[]) {
  const listingTypeCounts = new Map<string, number>();
  const propertyTypeCounts = new Map<string, number>();
  const areasByKey = new Map<
    string,
    { count: number; imageUrl: string; title: string }
  >();

  for (const listing of listings) {
    listingTypeCounts.set(
      listing.listingType,
      (listingTypeCounts.get(listing.listingType) || 0) + 1,
    );
    propertyTypeCounts.set(
      listing.propertyType,
      (propertyTypeCounts.get(listing.propertyType) || 0) + 1,
    );

    const area = listingAreaName(listing);

    if (!area) continue;

    const key = area.toLowerCase();
    const existing = areasByKey.get(key);

    areasByKey.set(key, {
      count: (existing?.count || 0) + 1,
      imageUrl: existing?.imageUrl || listingImageUrl(listing),
      title: existing?.title || area,
    });
  }

  return {
    areas: Array.from(areasByKey.values())
      .sort((first, second) => second.count - first.count)
      .slice(0, 16),
    listingTypeCounts,
    propertyTypeCounts,
  };
}

function SectionHeader({
  actionHref,
  actionLabel,
  eyebrow,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-base font-black tracking-tight">{title}</h2>
        {eyebrow ? (
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
      </div>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-primary"
        >
          {actionLabel}
          <ChevronRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

function SectionEmptyState({
  actionHref,
  actionLabel,
  description,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  description: string;
  title: string;
}) {
  return (
    <div className="grid min-h-44 place-items-center border-y border-dashed border-border py-8 text-center">
      <div>
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
          <Search className="size-5" />
        </span>
        <h3 className="mt-4 text-sm font-black text-foreground">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-muted-foreground">
          {description}
        </p>
        {actionHref && actionLabel ? (
          <Button asChild size="sm" className="mt-5">
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CategoryCard({
  count,
  href,
  icon: Icon,
  label,
  sublabel,
}: {
  count?: number;
  href: string;
  icon: LucideIcon;
  label: string;
  sublabel: string;
}) {
  return (
    <Link
      href={href}
      draggable={false}
      className="flex min-h-36 w-[16rem] shrink-0 flex-col justify-center rounded-lg border border-border bg-card p-4 text-center text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-[18rem]"
    >
      <span className="mx-auto grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <span className="mt-3 block text-sm font-black">{label}</span>
      {typeof count === "number" ? (
        <span className="mt-1 block text-xs font-black text-primary">
          {listingCountLabel(count)}
        </span>
      ) : null}
      <span className="mt-1 block text-[11px] font-semibold text-muted-foreground">
        {sublabel}
      </span>
    </Link>
  );
}

function categoryHref(
  params: Record<string, string>,
  countryPreference?: CountryPreference | null,
) {
  const query = new URLSearchParams(params).toString();

  return appendCountryPreference(`/listings?${query}`, countryPreference);
}

function areaHref(area: string, countryPreference?: CountryPreference | null) {
  return categoryHref({ area }, countryPreference);
}

function MediaCard({
  aspect = "aspect-[4/5]",
  compact = false,
  item,
}: {
  aspect?: string;
  compact?: boolean;
  item: HomeMediaCard;
}) {
  return (
    <Link
      href={item.href}
      className="group block min-w-0 overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        className={`relative ${aspect} bg-muted bg-cover bg-center`}
        style={{ backgroundImage: `url(${item.imageUrl})` }}
      >
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
        {item.showBadge === false ? null : (
          <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-background/90 text-primary">
            <Tag className="size-3.5" />
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <h3 className={compact ? "text-sm font-black" : "text-base font-black"}>
            {item.title}
          </h3>
          {item.meta ? (
            <p className="mt-1 truncate text-xs font-semibold text-white/80">
              {item.meta}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function TopAgentRail({ agents }: { agents: TopAgent[] }) {
  const shouldRotate = agents.length > 4;
  const railAgents = shouldRotate ? [...agents, ...agents] : agents;
  const agentRows = shouldRotate ? railAgents : agents;

  return (
    <div className="w-full overflow-hidden border-y border-border py-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-black tracking-tight text-foreground">
            Top agents near you
          </h2>
          <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
            Ranked by recorded sold value over the past year.
          </p>
        </div>
        <Link
          href="/agents"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-primary"
        >
          View all agents
          <ChevronRight className="size-3.5" />
        </Link>
      </div>

      {!agents.length ? (
        <SectionEmptyState
          actionHref="/agents"
          actionLabel="Browse agents"
          description="Agents will appear here once they have subscribed profiles or recorded sales activity."
          title="No top agents to rank yet"
        />
      ) : shouldRotate ? (
        <div className="[mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
          <div className="flex w-max gap-3 motion-safe:animate-[top-agent-marquee_32s_linear_infinite] hover:[animation-play-state:paused]">
            {agentRows.map((agent, index) => (
              <Link
                key={`${agent.username}-${index}`}
                href={`/users/${agent.username}`}
                className="group flex w-80 shrink-0 items-center gap-3 border-r border-border/70 pr-5 text-left text-foreground transition hover:text-primary"
              >
                <span className="w-6 text-sm font-black text-muted-foreground">
                  {String((index % agents.length) + 1).padStart(2, "0")}
                </span>
                <div className="rounded-full bg-[conic-gradient(from_150deg,#ff4db8,#7b5cff,#ff9f1c,#ff4db8)] p-0.5 transition group-hover:scale-105">
                  {agent.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={agent.avatarUrl}
                      alt={agent.name}
                      className="size-12 rounded-full border-2 border-background object-cover"
                    />
                  ) : (
                    <span className="grid size-12 place-items-center rounded-full border-2 border-background bg-brand-midnight text-sm font-black text-white">
                      {initials(agent.name)}
                    </span>
                  )}
                </div>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black">
                    {agent.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-semibold text-muted-foreground">
                    {agent.location}
                  </span>
                  <span className="mt-1 block text-xs font-black text-primary">
                    {agent.totalSoldValueCents > 0
                      ? `${agent.totalSoldValueLabel} sold past year`
                      : "Building sales record"}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border border-y border-border">
          {agentRows.map((agent, index) => (
            <Link
              key={agent.username}
              href={`/users/${agent.username}`}
              className="group grid gap-3 py-4 text-left text-foreground transition hover:bg-muted/35 hover:text-primary sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="w-6 text-sm font-black text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="rounded-full bg-[conic-gradient(from_150deg,#ff4db8,#7b5cff,#ff9f1c,#ff4db8)] p-0.5 transition group-hover:scale-105">
                  {agent.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={agent.avatarUrl}
                      alt={agent.name}
                      className="size-12 rounded-full border-2 border-background object-cover"
                    />
                  ) : (
                    <span className="grid size-12 place-items-center rounded-full border-2 border-background bg-brand-midnight text-sm font-black text-white">
                      {initials(agent.name)}
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black">
                    {agent.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-semibold text-muted-foreground">
                    {agent.location}
                  </span>
                </span>
              </span>
              <span className="grid gap-1 text-xs font-black text-primary sm:min-w-52 sm:text-right">
                <span>
                  {agent.totalSoldValueCents > 0
                    ? `${agent.totalSoldValueLabel} sold past year`
                    : "Building sales record"}
                </span>
                <span className="text-muted-foreground">
                  {agent.soldCount} {agent.soldCount === 1 ? "sale" : "sales"} recorded
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await getServerSession(authOptions);
  const viewer = await getViewerChrome(session?.user?.id);
  const query = searchParams ? await searchParams : {};
  const cookieStore = await cookies();
  const countryPreference = parseCountryPreference(
    cookieStore.get(countryPreferenceCookie)?.value,
  );
  const countryLabel = countryPreference?.label || countryPreference?.country;
  const discoverFilters = normalizeDiscoverListingFilters({
    ...query,
    countryName: query.countryName || countryLabel,
  });
  const [
    homeListings,
    filterOptions,
    homeReels,
    topAgents,
    platformStats,
    propertyFeed,
  ] = await Promise.all([
    getHomeListings(countryLabel),
    getDiscoverListingFilterOptions({
      countryName: discoverFilters.countryName,
    }),
    getHomeReels({
      areas: discoverFilters.areas,
      countryPreference,
      viewerUserId: session?.user?.id || null,
    }),
    getTopSubscribedAgents(countryLabel),
    getPlatformStats(),
    getDiscoverListings({
      filters: discoverFilters,
      limit: homeDiscoverListingsPageSize,
      viewerUserId: session?.user?.id || null,
    }),
  ]);
  const featuredListings: ListingCardData[] = [];
  const homeStats = buildHomeListingStats(homeListings);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader
        transparentUntilScroll
        viewerRole={viewer.role}
        viewerUsername={viewer.username}
      />
      <main className="pb-14">
        <section className="relative isolate min-h-[760px] overflow-hidden pt-16 sm:min-h-[820px] sm:pt-28">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImage})` }}
          />
          <div className="hero-theme-overlay absolute inset-0" />

          <div className="page-body relative z-10 flex min-h-[700px] flex-col items-center justify-center pb-8 pt-8 text-center sm:min-h-[740px]">
            <div className="max-w-5xl">
              <h1 className="text-balance text-4xl font-black leading-[0.95] tracking-tight text-brand-black dark:text-foreground sm:text-6xl lg:text-7xl">
                <span className="block sm:inline">Find it.</span>{" "}
                <span className="homzie-gradient-text block text-5xl sm:inline sm:text-6xl lg:text-7xl">
                  Love it.
                </span>{" "}
                <span className="block sm:inline">Live it.</span>
              </h1>
              <RotatingHeroCopy className="mx-auto mt-4 max-w-xs text-sm font-semibold leading-6 text-muted-foreground sm:mt-6 sm:max-w-2xl sm:text-balance sm:text-lg sm:leading-7" />
            </div>

            <PropertySearchBar
              action="/listings"
              className="mt-8 w-full max-w-5xl sm:mt-12"
              countryName={discoverFilters.countryName}
              filters={discoverFilters}
              options={filterOptions}
              resultCount={propertyFeed.totalCount}
              variant="hero"
            />

            <LivePlatformStats initialStats={platformStats} />
          </div>
        </section>

        <section className="page-body mt-10">
          <TopAgentRail agents={topAgents} />
        </section>

        <section className="page-body mt-10">
          <SectionHeader
            actionHref={appendCountryPreference("/listings", countryPreference)}
            actionLabel="View all"
            title="Browse by listing type"
          />
          <HorizontalScrollRail>
            {listingTypeOptions.map((option) => (
              <CategoryCard
                key={option.value}
                count={homeStats.listingTypeCounts.get(option.value) || 0}
                href={categoryHref(
                  { listingType: option.value },
                  countryPreference,
                )}
                icon={option.icon}
                label={option.label}
                sublabel={option.description}
              />
            ))}
          </HorizontalScrollRail>
        </section>

        <section className="page-body mt-10">
          <SectionHeader
            actionHref={appendCountryPreference("/listings", countryPreference)}
            actionLabel="View all"
            title="Browse by property type"
          />
          <HorizontalScrollRail>
            {propertyTypeOptions.map((option) => (
              <CategoryCard
                key={option.value}
                count={homeStats.propertyTypeCounts.get(option.value) || 0}
                href={categoryHref(
                  { propertyType: option.value },
                  countryPreference,
                )}
                icon={option.icon}
                label={option.label}
                sublabel={`${option.listingTypes.length} listing ${
                  option.listingTypes.length === 1 ? "type" : "types"
                }`}
              />
            ))}
          </HorizontalScrollRail>
        </section>

        <section className="page-body mt-10">
          <SectionHeader
            actionHref="/reels"
            actionLabel="View all reels"
            eyebrow="Get inspired by agents. Watch, connect and find your next home."
            title="Agent Reels"
          />
          {homeReels.length ? (
            <HorizontalScrollRail>
              {homeReels.map((reel) => (
                <div key={reel.id} className="w-44 shrink-0 sm:w-52">
                  <ReelPreviewCard reel={reel} />
                </div>
              ))}
            </HorizontalScrollRail>
          ) : (
            <SectionEmptyState
              actionHref="/reels"
              actionLabel="Open reels"
              description="Property reels will appear here once agents begin publishing video."
              title="No agent reels yet"
            />
          )}
        </section>

        <section className="page-body mt-10">
          <SectionHeader
            actionHref={appendCountryPreference("/listings", countryPreference)}
            actionLabel="View all areas"
            title="Explore by Area"
          />
          {homeStats.areas.length ? (
            <HorizontalScrollRail>
              {homeStats.areas.map((area) => (
                <div key={area.title} className="w-60 shrink-0 sm:w-72">
                  <MediaCard
                    aspect="aspect-[5/3]"
                    compact
                    item={{
                      imageUrl: area.imageUrl,
                      meta: listingCountLabel(area.count),
                      showBadge: false,
                      title: area.title,
                      href: areaHref(area.title, countryPreference),
                    }}
                  />
                </div>
              ))}
            </HorizontalScrollRail>
          ) : (
            <SectionEmptyState
              actionHref={appendCountryPreference("/listings", countryPreference)}
              actionLabel="Browse listings"
              description="Areas will appear here once listings include searchable location data."
              title="No areas to explore yet"
            />
          )}
        </section>

        {featuredListings.length ? (
          <section className="page-body mt-10">
            <SectionHeader
              actionHref={appendCountryPreference("/listings", countryPreference)}
              actionLabel="View featured"
              title="Featured Properties"
            />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {featuredListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="page-body mt-10">
          <SectionHeader
            eyebrow={
              countryLabel
                ? `Showing published listings in ${countryLabel}.`
                : "Showing recently published listings."
            }
            title="Discover Properties"
          />
          {propertyFeed.listings.length ? (
            <ListingsInfiniteGrid
              filters={discoverFilters}
              initialHasMore={propertyFeed.hasMore}
              initialListings={propertyFeed.listings}
              initialNextOffset={propertyFeed.nextOffset}
              loadMoreLimit={homeDiscoverListingsPageSize}
              totalCount={propertyFeed.totalCount}
            />
          ) : (
            <SectionEmptyState
              actionHref={appendCountryPreference("/listings", countryPreference)}
              actionLabel="View all listings"
              description="No published listings match the current home search filters."
              title="No listings found"
            />
          )}
        </section>

        <section className="page-body mt-10">
          <div className="grid gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <LocateFixed className="size-5" />
              </span>
              <div>
                <h2 className="text-base font-black">Ready to find your next place?</h2>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                  Search trusted agents, saved homes and reel-first listings in one place.
                </p>
              </div>
            </div>
            <Button asChild>
              <Link href="/listings">
                <SlidersHorizontal className="size-4" />
                Start exploring
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <GlobalFooter viewerRole={viewer.role} viewerUsername={viewer.username} />
    </div>
  );
}
