import Link from "next/link";
import { getServerSession } from "next-auth";
import { and, desc, eq, gt, gte, ilike, inArray, isNull, or } from "drizzle-orm";
import { Award, Building2, MapPin, Search, SlidersHorizontal } from "lucide-react";

import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { agentProfiles, propertyListings, subscriptions, users } from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import { authOptions } from "@/modules/auth/config";
import { getViewerChrome } from "@/modules/auth/viewer";

type AgentsPageProps = {
  searchParams?: Promise<{
    location?: string;
    page?: string;
    q?: string;
    sort?: string;
  }>;
};

type AgentDirectoryItem = {
  activeListingCount: number;
  avatarUrl: string | null;
  headline: string;
  id: string;
  location: string;
  locationCity: string | null;
  locationCountry: string | null;
  locationProvince: string | null;
  locationSuburb: string | null;
  name: string;
  soldCount: number;
  totalSoldValueCents: number;
  username: string;
};

function cleanParam(value?: string) {
  return typeof value === "string" ? value.trim() : "";
}

function pageNumber(value?: string) {
  const parsed = Number(value || "1");

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatCurrencyCompact(cents: number) {
  if (!cents) return "No recorded sales";

  return new Intl.NumberFormat("en", {
    compactDisplay: "short",
    currency: "ZAR",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
  }).format(cents / 100);
}

function agentLocationLabel(agent: {
  location: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  locationProvince: string | null;
  locationSuburb: string | null;
}) {
  return (
    [
      agent.locationSuburb,
      agent.locationCity,
      agent.locationProvince,
      agent.locationCountry,
    ]
      .filter(Boolean)
      .join(", ") ||
    agent.location ||
    ""
  );
}

async function getAgentDirectory({
  location,
  q,
  sort,
}: {
  location: string;
  q: string;
  sort: string;
}) {
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  const search = q ? `%${q}%` : "";
  const locationSearch = location ? `%${location}%` : "";

  const agentRows = await db
    .select({
      avatarUrl: users.avatarUrl,
      headline: agentProfiles.headline,
      id: users.id,
      location: agentProfiles.location,
      locationCity: agentProfiles.locationCity,
      locationCountry: agentProfiles.locationCountry,
      locationProvince: agentProfiles.locationProvince,
      locationSuburb: agentProfiles.locationSuburb,
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
        search
          ? or(
              ilike(users.name, search),
              ilike(users.username, search),
              ilike(agentProfiles.displayName, search),
              ilike(agentProfiles.headline, search),
              ilike(agentProfiles.location, search),
              ilike(agentProfiles.locationCity, search),
              ilike(agentProfiles.locationCountry, search),
              ilike(agentProfiles.locationProvince, search),
              ilike(agentProfiles.locationSuburb, search),
            )
          : undefined,
        locationSearch
          ? or(
              ilike(agentProfiles.location, locationSearch),
              ilike(agentProfiles.locationCity, locationSearch),
              ilike(agentProfiles.locationCountry, locationSearch),
              ilike(agentProfiles.locationProvince, locationSearch),
              ilike(agentProfiles.locationSuburb, locationSearch),
            )
          : undefined,
      ),
    )
    .orderBy(desc(subscriptions.currentPeriodEnd))
    .limit(200);

  const uniqueAgents = Array.from(
    new Map(
      agentRows
        .filter((agent) => agent.username)
        .map((agent) => [agent.id, agent]),
    ).values(),
  );
  const userIds = uniqueAgents.map((agent) => agent.id);
  const locations = Array.from(
    new Set(
      uniqueAgents
        .map(agentLocationLabel)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((first, second) => first.localeCompare(second));

  if (!userIds.length) {
    return { agents: [] as AgentDirectoryItem[], locations };
  }

  const listingRows = await db
    .select({
      soldPriceCents: propertyListings.soldPriceCents,
      status: propertyListings.status,
      userId: propertyListings.userId,
    })
    .from(propertyListings)
    .where(
      and(
        inArray(propertyListings.userId, userIds),
        or(
          eq(propertyListings.status, "published"),
          and(
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
        ),
      ),
    );
  const statsByUserId = new Map<
    string,
    { activeListingCount: number; soldCount: number; totalSoldValueCents: number }
  >();

  for (const listing of listingRows) {
    const current = statsByUserId.get(listing.userId) || {
      activeListingCount: 0,
      soldCount: 0,
      totalSoldValueCents: 0,
    };

    if (listing.status === "published") current.activeListingCount += 1;
    if (listing.status === "sold") {
      current.soldCount += 1;
      current.totalSoldValueCents += listing.soldPriceCents || 0;
    }

    statsByUserId.set(listing.userId, current);
  }

  const agents = uniqueAgents.map((agent) => {
    const stats = statsByUserId.get(agent.id) || {
      activeListingCount: 0,
      soldCount: 0,
      totalSoldValueCents: 0,
    };

    return {
      activeListingCount: stats.activeListingCount,
      avatarUrl: toPublicMediaUrl(agent.avatarUrl),
      headline: agent.headline || "Homzie agent",
      id: agent.id,
      location: agentLocationLabel(agent) || "Location available on profile",
      locationCity: agent.locationCity,
      locationCountry: agent.locationCountry,
      locationProvince: agent.locationProvince,
      locationSuburb: agent.locationSuburb,
      name: agent.name,
      soldCount: stats.soldCount,
      totalSoldValueCents: stats.totalSoldValueCents,
      username: agent.username || "",
    };
  });

  agents.sort((first, second) => {
    if (sort === "listings") {
      return second.activeListingCount - first.activeListingCount;
    }

    if (sort === "name") {
      return first.name.localeCompare(second.name);
    }

    if (second.totalSoldValueCents !== first.totalSoldValueCents) {
      return second.totalSoldValueCents - first.totalSoldValueCents;
    }

    return second.soldCount - first.soldCount;
  });

  return { agents, locations };
}

function hrefForPage({
  location,
  q,
  sort,
}: {
  location: string;
  q: string;
  sort: string;
}) {
  return (page: number) => {
    const params = new URLSearchParams();

    if (q) params.set("q", q);
    if (location) params.set("location", location);
    if (sort && sort !== "sales") params.set("sort", sort);
    if (page > 1) params.set("page", String(page));

    const query = params.toString();
    return query ? `/agents?${query}` : "/agents";
  };
}

export default async function AgentsPage({ searchParams }: AgentsPageProps) {
  const session = await getServerSession(authOptions);
  const viewer = await getViewerChrome(session?.user?.id);
  const viewerSignedIn = Boolean(session?.user?.id);
  const query = searchParams ? await searchParams : {};
  const q = cleanParam(query.q);
  const location = cleanParam(query.location);
  const sort = cleanParam(query.sort) || "sales";
  const currentPage = pageNumber(query.page);
  const pageSize = 12;
  const { agents, locations } = await getAgentDirectory({ location, q, sort });
  const totalPages = Math.max(Math.ceil(agents.length / pageSize), 1);
  const pageAgents = agents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader viewerRole={viewer.role} viewerUsername={viewer.username} />
      <main className="page-body pb-16 pt-28">
        <section className="mb-8 border-b border-border pb-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
            Agents
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">
            Find trusted Homzie agents
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
            Search active agent profiles by name or area, then compare their
            available listings and recorded sold value.
          </p>
        </section>

        <form
          action="/agents"
          className="mb-7 grid gap-3 border-b border-border pb-5 lg:grid-cols-[minmax(18rem,1fr)_15rem_13rem_auto]"
        >
          <label className="grid gap-1.5 text-xs font-black">
            <span>Search agents</span>
            <span className="flex h-12 items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-primary">
              <Search className="size-4 text-muted-foreground" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Name, username, headline"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
              />
            </span>
          </label>
          <label className="grid gap-1.5 text-xs font-black">
            <span>Location</span>
            <select
              name="location"
              defaultValue={location}
              className="h-12 rounded-md border border-input bg-background px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All locations</option>
              {locations.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-black">
            <span>Sort</span>
            <select
              name="sort"
              defaultValue={sort}
              className="h-12 rounded-md border border-input bg-background px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="sales">Sold value</option>
              <option value="listings">Active listings</option>
              <option value="name">Name</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" className="h-12">
              <SlidersHorizontal className="size-4" />
              Apply
            </Button>
            {(q || location || sort !== "sales") ? (
              <Button asChild type="button" variant="outline" className="h-12">
                <Link href="/agents">Reset</Link>
              </Button>
            ) : null}
          </div>
        </form>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm font-bold">
          <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
            {agents.length} {agents.length === 1 ? "agent" : "agents"}
          </span>
          {location ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-primary">
              <MapPin className="size-3.5" />
              {location}
            </span>
          ) : null}
        </div>

        {pageAgents.length ? (
          <div className="divide-y divide-border border-y border-border">
            {pageAgents.map((agent) => (
              <Link
                key={agent.id}
                href={
                  viewerSignedIn
                    ? `/users/${agent.username}`
                    : `/register?callbackUrl=${encodeURIComponent(`/users/${agent.username}`)}`
                }
                className="group relative block overflow-hidden py-5 transition hover:bg-muted/35"
              >
                <div
                  className={
                    viewerSignedIn
                      ? "grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      : "grid select-none gap-4 blur-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  }
                  aria-hidden={viewerSignedIn ? undefined : true}
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="rounded-full bg-[conic-gradient(from_150deg,#ff4db8,#7b5cff,#ff9f1c,#ff4db8)] p-0.5">
                      {agent.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={agent.avatarUrl}
                          alt={agent.name}
                          className="size-14 rounded-full border-2 border-background object-cover"
                        />
                      ) : (
                        <span className="grid size-14 place-items-center rounded-full border-2 border-background bg-brand-midnight text-sm font-black text-white">
                          {initials(agent.name)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-black group-hover:text-primary">
                        {agent.name}
                      </h2>
                      <p className="mt-1 truncate text-sm font-semibold text-muted-foreground">
                        {agent.headline}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
                        <MapPin className="size-3.5" />
                        {agent.location}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm font-black sm:w-72">
                    <span className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                      <Building2 className="size-4 text-primary" />
                      {agent.activeListingCount} active
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                      <Award className="size-4 text-primary" />
                      {agent.soldCount
                        ? formatCurrencyCompact(agent.totalSoldValueCents)
                        : "No sales"}
                    </span>
                  </div>
                </div>
                {!viewerSignedIn ? (
                  <span className="absolute inset-0 grid place-items-center bg-background/55 p-4 text-center backdrop-blur-[1px]">
                    <span className="rounded-full bg-primary px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-primary-foreground shadow-lg">
                      Create account to reveal
                    </span>
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid min-h-80 place-items-center border-y border-dashed border-border p-8 text-center">
            <div>
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Search className="size-5" />
              </span>
              <h2 className="mt-4 text-lg font-black">No agents found</h2>
              <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-muted-foreground">
                Try a broader name or location search.
              </p>
            </div>
          </div>
        )}

        <Pagination
          currentPage={Math.min(currentPage, totalPages)}
          hrefForPage={hrefForPage({ location, q, sort })}
          totalPages={totalPages}
        />
      </main>
      <GlobalFooter viewerRole={viewer.role} viewerUsername={viewer.username} />
    </div>
  );
}
