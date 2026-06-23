import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";

import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { ListingCard } from "@/modules/listings/components/listing-card";
import { authOptions } from "@/modules/auth/config";
import { getViewerChrome } from "@/modules/auth/viewer";
import {
  getDiscoverListings,
  type DiscoverListingFilters,
} from "@/modules/listings/server/discover-listings";
import { listingPathSegmentToType } from "@/modules/listings/seo";
import { formatSeoTitle, getStoredSeoSettings } from "@/modules/seo/settings";
import { absoluteUrl } from "@/modules/site/url";

type PropertyLandingInput = {
  category?: string;
  city?: string;
  listingType: string;
  province?: string;
};

function titleCase(value: string) {
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function pluralTypeLabel(value: string) {
  if (value === "rental") return "property to rent";
  if (value === "development") return "new developments";
  if (value === "commercial") return "commercial property";
  return "property for sale";
}

function displayTitle(value: string) {
  return titleCase(value)
    .replace(/\bFor\b/g, "for")
    .replace(/\bTo Rent\b/g, "to Rent")
    .replace(/\bIn\b/g, "in");
}

function categoryFilters(category?: string) {
  if (!category) return {};
  const bedroomMatch = category.match(/^(\d+)-bedroom/);
  const propertyType = category.includes("apartment")
    ? "apartment"
    : category.includes("townhouse")
      ? "townhouse"
      : category.includes("land")
        ? "vacant_land"
        : category.includes("house")
          ? "free_standing_house"
          : "";

  return {
    bedrooms: bedroomMatch?.[1] || undefined,
    propertyType: propertyType ? [propertyType] : undefined,
  } satisfies Partial<DiscoverListingFilters>;
}

export function propertyLandingPath(input: PropertyLandingInput) {
  return [
    "/property",
    input.listingType,
    input.province,
    input.city,
    input.category,
  ]
    .filter(Boolean)
    .join("/");
}

export function propertyLandingCopy(input: PropertyLandingInput) {
  const listingType = listingPathSegmentToType(input.listingType);
  const intent = displayTitle(pluralTypeLabel(listingType));
  const city = input.city ? titleCase(input.city) : "";
  const province = input.province ? titleCase(input.province) : "";
  const category = input.category ? displayTitle(input.category) : "";
  const place = city || province;
  const heading = [category || intent, place ? `in ${place}` : ""]
    .filter(Boolean)
    .join(" ");
  const title = heading || "Property on Homzie";

  return {
    description: `Browse ${title.toLowerCase()} on Homzie. Compare listings, photos, features, prices and agent details.`,
    heading: title,
    title,
  };
}

function filtersForLanding(input: PropertyLandingInput): DiscoverListingFilters {
  const listingType = listingPathSegmentToType(input.listingType);
  const city = input.city ? titleCase(input.city) : "";
  const province = input.province ? titleCase(input.province) : "";

  return {
    area: city || undefined,
    countryName: !city && province ? province : undefined,
    listingType: [listingType],
    ...categoryFilters(input.category),
  };
}

export async function generatePropertyLandingMetadata(
  input: PropertyLandingInput,
): Promise<Metadata> {
  const seo = await getStoredSeoSettings();
  const copy = propertyLandingCopy(input);
  const url = absoluteUrl(propertyLandingPath(input));
  const title = formatSeoTitle(copy.title, seo);

  return {
    alternates: {
      canonical: url,
    },
    description: copy.description,
    openGraph: {
      description: copy.description,
      images: [{ url: seo.defaultOgImageUrl || "/opengraph-image" }],
      siteName: seo.organizationName,
      title,
      type: "website",
      url,
    },
    robots: {
      follow: seo.allowIndexing,
      index: seo.allowIndexing,
    },
    title,
    twitter: {
      card: "summary_large_image",
      description: copy.description,
      images: [seo.defaultOgImageUrl || "/opengraph-image"],
      title,
    },
  };
}

export async function PropertyLandingPage(input: PropertyLandingInput) {
  const session = await getServerSession(authOptions);
  const viewer = await getViewerChrome(session?.user?.id || null);
  const filters = filtersForLanding(input);
  const feed = await getDiscoverListings({
    filters,
    limit: 24,
    viewerUserId: session?.user?.id || null,
  });
  const copy = propertyLandingCopy(input);
  const url = absoluteUrl(propertyLandingPath(input));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    description: copy.description,
    mainEntity: feed.listings.map((listing, index) => ({
      "@type": "ListItem",
      item: absoluteUrl(listing.href || ""),
      name: listing.title,
      position: index + 1,
    })),
    name: copy.heading,
    url,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <GlobalHeader viewerHasAgencyWorkspace={viewer.hasAgencyWorkspace} viewerRole={viewer.role} viewerUsername={viewer.username} />
      <main className="page-body pb-16 pt-28">
        <section className="border-b border-border pb-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
            Property
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
            {copy.heading}
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-muted-foreground">
            {copy.description}
          </p>
        </section>

        <section className="mt-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <p className="text-sm font-black text-muted-foreground">
              {feed.totalCount} {feed.totalCount === 1 ? "listing" : "listings"}
            </p>
            <Link href="/listings" className="text-sm font-black text-primary">
              Explore all listings
            </Link>
          </div>
          {feed.listings.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {feed.listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
              <h2 className="text-lg font-black">No listings found</h2>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                This landing page is ready to rank as soon as matching listings are live.
              </p>
            </div>
          )}
        </section>
      </main>
      <GlobalFooter viewerRole={viewer.role} viewerUsername={viewer.username} />
    </div>
  );
}
