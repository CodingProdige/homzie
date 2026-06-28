import "server-only";

import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/db";
import { adCampaigns, propertyListings } from "@/db/schema";
import { buildListingPath } from "@/modules/listings/seo";
import { absoluteUrl } from "@/modules/site/url";

type ListingFeedSourceRow = {
  details: unknown;
  id: string;
  listingType: string;
  location: string | null;
  propertyType: string;
  title: string | null;
};

type PageFeedRow = {
  label: string;
  pageUrl: string;
};

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function detailsObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function detailText(details: Record<string, unknown>, key: string) {
  const value = details[key];

  return typeof value === "string" ? value : "";
}

function detailNumber(details: Record<string, unknown>, key: string) {
  const value = details[key];

  if (typeof value === "number") return value;
  if (typeof value === "string") return value;

  return null;
}

function listingFeedUrl(row: ListingFeedSourceRow) {
  const details = detailsObject(row.details);

  return absoluteUrl(
    buildListingPath({
      bathrooms: detailNumber(details, "bathrooms"),
      bedrooms: detailNumber(details, "bedrooms"),
      city: detailText(details, "city"),
      country: detailText(details, "country"),
      id: row.id,
      listingType: row.listingType,
      location: row.location,
      propertyType: row.propertyType,
      province: detailText(details, "province") || detailText(details, "state"),
      suburb: detailText(details, "suburb"),
      title: row.title,
    }),
  );
}

export function buildGoogleAdsPageFeedCsv(rows: PageFeedRow[]) {
  return [
    "Page URL,Custom label",
    ...rows.map((row) => `${csvEscape(row.pageUrl)},${csvEscape(row.label)}`),
  ].join("\n");
}

export async function getUserPaidGoogleListingPageFeedRows(label: string) {
  const rows = await db
    .select({
      promotedUrl: adCampaigns.promotedUrl,
    })
    .from(adCampaigns)
    .innerJoin(propertyListings, eq(propertyListings.id, adCampaigns.listingId))
    .where(
      and(
        eq(adCampaigns.channel, "google"),
        eq(adCampaigns.promotedType, "listing"),
        eq(propertyListings.status, "published"),
        inArray(adCampaigns.status, ["ready", "live"]),
      ),
    )
    .orderBy(desc(adCampaigns.updatedAt));

  const uniqueUrls = Array.from(
    new Set(rows.map((row) => row.promotedUrl).filter((value): value is string => Boolean(value))),
  );

  return uniqueUrls.map((pageUrl) => ({
    label,
    pageUrl,
  }));
}

export async function getHomzieFundedListingPageFeedRows(label: string) {
  const rows = await db
    .select({
      details: propertyListings.details,
      id: propertyListings.id,
      listingType: propertyListings.listingType,
      location: propertyListings.location,
      propertyType: propertyListings.propertyType,
      title: propertyListings.title,
    })
    .from(propertyListings)
    .where(
      and(
        eq(propertyListings.status, "published"),
        eq(propertyListings.isDemoContent, false),
        isNull(propertyListings.activeReservationId),
        isNull(propertyListings.archivedAt),
        isNull(propertyListings.outcomeAt),
        isNull(propertyListings.soldAt),
        isNotNull(propertyListings.askingPriceCents),
        isNotNull(propertyListings.coverImageUrl),
        isNotNull(propertyListings.location),
      ),
    )
    .orderBy(desc(propertyListings.listedAt), desc(propertyListings.updatedAt));

  const uniqueUrls = Array.from(new Set(rows.map(listingFeedUrl)));

  return uniqueUrls.map((pageUrl) => ({
    label,
    pageUrl,
  }));
}
