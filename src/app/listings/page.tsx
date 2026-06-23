import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { MapPin, Search } from "lucide-react";

import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { Pagination } from "@/components/pagination";
import { authOptions } from "@/modules/auth/config";
import { getViewerChrome } from "@/modules/auth/viewer";
import { ClearListingFiltersLink } from "@/modules/listings/components/clear-listing-filters-link";
import {
  appendCountryPreference,
  countryPreferenceCookie,
  parseCountryPreference,
} from "@/modules/location/country-preference";
import { ListingCard } from "@/modules/listings/components/listing-card";
import { PropertySearchBar } from "@/modules/listings/components/property-search-bar";
import {
  discoverListingHeading,
  getDiscoverListings,
  getDiscoverListingFilterOptions,
  normalizeDiscoverListingFilters,
} from "@/modules/listings/server/discover-listings";
import {
  listingTypeOptions,
  propertyTypeOptions,
} from "@/modules/listings/options";

type ListingsPageProps = {
  searchParams?: Promise<{
    area?: string[] | string;
    bathrooms?: string;
    bedrooms?: string;
    buyerIncentive?: string;
    country?: string;
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
    page?: string;
    petsAllowed?: string;
    propertyType?: string[] | string;
    shortLetAllowed?: string;
  }>;
};

function optionLabels<T extends { label: string; value: string }>(
  options: readonly T[],
  values: string[],
) {
  return values
    .map((value) => options.find((option) => option.value === value)?.label || "")
    .filter(Boolean)
    .join(", ");
}

function pageNumber(value?: string) {
  const parsed = Number(value || "1");

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function hrefForPage(query: NonNullable<Awaited<ListingsPageProps["searchParams"]>>) {
  return (page: number) => {
    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
      if (key === "page") return;
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item) params.append(key, item);
        });
        return;
      }
      if (value) params.set(key, value);
    });

    if (page > 1) {
      params.set("page", String(page));
    }

    const queryString = params.toString();

    return queryString ? `/listings?${queryString}` : "/listings";
  };
}

export default async function ListingsPage({ searchParams }: ListingsPageProps) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id || null;
  const viewer = await getViewerChrome(viewerId);
  const query = searchParams ? await searchParams : {};
  const cookieStore = await cookies();
  const countryPreference = parseCountryPreference(
    cookieStore.get(countryPreferenceCookie)?.value,
  );
  const resetListingsHref = appendCountryPreference("/listings", countryPreference);
  const currentPage = pageNumber(query.page);
  const pageSize = 12;
  const filters = normalizeDiscoverListingFilters(query);
  const activeListingTypeLabel = optionLabels(
    listingTypeOptions,
    filters.listingTypes,
  );
  const activePropertyTypeLabel = optionLabels(
    propertyTypeOptions,
    filters.propertyTypes,
  );
  const listingFeed = await getDiscoverListings({
    filters,
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
    viewerUserId: viewerId,
  });
  const totalPages = Math.max(Math.ceil(listingFeed.totalCount / pageSize), 1);
  const filterOptions = await getDiscoverListingFilterOptions({
    countryName: filters.countryName,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader viewerHasAgencyWorkspace={viewer.hasAgencyWorkspace} viewerRole={viewer.role} viewerUsername={viewer.username} />
      <main className="page-body pb-16 pt-28">
        <section className="mb-8 flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
              Listings
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">
              {discoverListingHeading(filters)}
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
              Browse live listings from agents. Area and category shortcuts from
              the home page land here.
            </p>
          </div>
        </section>

        <PropertySearchBar
          action="/listings"
          className="mb-6"
          countryName={filters.countryName}
          filters={filters}
          options={filterOptions}
          resultCount={listingFeed.totalCount}
          submitLabel="Update"
        />

        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold">
            <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
              {listingFeed.totalCount}{" "}
              {listingFeed.totalCount === 1 ? "result" : "results"}
            </span>
            {filters.area ||
            filters.countryName ||
            filters.listingTypes.length ||
            filters.propertyTypes.length ? (
              <>
                {filters.area ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-primary">
                    <MapPin className="size-3.5" />
                    {filters.area}
                  </span>
                ) : null}
                {!filters.area && filters.countryName ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-primary">
                    <MapPin className="size-3.5" />
                    {filters.countryName}
                  </span>
                ) : null}
                {activeListingTypeLabel ? (
                  <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                    {activeListingTypeLabel}
                  </span>
                ) : null}
                {activePropertyTypeLabel ? (
                  <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                    {activePropertyTypeLabel}
                  </span>
                ) : null}
              </>
            ) : null}
          </div>

          {listingFeed.listings.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {listingFeed.listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="grid min-h-80 place-items-center rounded-lg border border-dashed border-border bg-card p-8 text-center text-card-foreground">
              <div>
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                  <Search className="size-5" />
                </span>
                <h2 className="mt-4 text-lg font-black">No listings found</h2>
                <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-muted-foreground">
                  There are no published listings matching these filters yet.
                </p>
                <ClearListingFiltersLink href={resetListingsHref} />
              </div>
            </div>
          )}
          <Pagination
            alwaysShow
            currentPage={Math.min(currentPage, totalPages)}
            hrefForPage={hrefForPage(query)}
            totalPages={totalPages}
          />
        </div>
      </main>
      <GlobalFooter viewerRole={viewer.role} viewerUsername={viewer.username} />
    </div>
  );
}
