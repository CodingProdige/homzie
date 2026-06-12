import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  listingLikes,
  listingSaves,
  propertyListings,
} from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import type { ListingCardData } from "@/modules/listings/components/listing-card";
import {
  featureOptions,
  listingTypeOptions,
  propertyTypeOptions,
} from "@/modules/listings/options";
import { buildListingPath } from "@/modules/listings/seo";

export type DiscoverListingFilters = {
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
};

export type ListingFilterOptions = {
  areas: string[];
  bathrooms: string[];
  bedrooms: string[];
  buyerIncentives: string[];
  erfSizes: string[];
  floorSizes: string[];
  garages: string[];
  parking: string[];
  prices: string[];
};

type DiscoverListingOptions = {
  filters?: DiscoverListingFilters;
  limit?: number;
  offset?: number;
  viewerUserId?: string | null;
};

function cleanParam(value?: string) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function cleanStringList(value?: string[] | string) {
  return (Array.isArray(value) ? value : value ? [value] : [])
    .map(cleanParam)
    .filter(Boolean)
    .slice(0, 8);
}

function cleanOptionList<T extends { value: string }>(
  options: readonly T[],
  value?: string[] | string,
) {
  const allowedValues = new Set(options.map((option) => option.value));

  return cleanStringList(value).filter((item) => allowedValues.has(item));
}

function cleanNumberParam(value?: string) {
  const cleanValue = cleanParam(value);
  const parsed = Number(cleanValue);

  return cleanValue && Number.isFinite(parsed) && parsed >= 0 ? cleanValue : "";
}

function cleanBooleanChoice(value?: string) {
  const cleanValue = cleanParam(value);

  return ["yes", "no"].includes(cleanValue) ? cleanValue : "";
}

function metadataObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function isVideoMediaType(value: unknown) {
  return typeof value === "string" && value.startsWith("video/");
}

function optionLabel<T extends { label: string; value: string }>(
  options: readonly T[],
  value: string,
  fallback: string,
) {
  return options.find((option) => option.value === value)?.label || fallback;
}

function formatCompactCount(value: number) {
  if (value < 1000) return String(value);

  const compactValue = value / 1000;

  return `${Number.isInteger(compactValue) ? compactValue.toFixed(0) : compactValue.toFixed(1)}K`;
}

export function normalizeDiscoverListingFilters(
  filters: DiscoverListingFilters = {},
) {
  const areas = cleanStringList(filters.area);
  const area = areas[0] || "";
  const bathrooms = cleanNumberParam(filters.bathrooms);
  const bedrooms = cleanNumberParam(filters.bedrooms);
  const buyerIncentive = cleanParam(filters.buyerIncentive);
  const countryName = cleanParam(filters.countryName);
  const furnishedStatus = ["yes", "no", "partial"].includes(
    cleanParam(filters.furnishedStatus),
  )
    ? cleanParam(filters.furnishedStatus)
    : "";
  const garages = cleanNumberParam(filters.garages);
  const listingTypes = cleanOptionList(listingTypeOptions, filters.listingType);
  const listingType = listingTypes[0] || "";
  const maxErfSize = cleanNumberParam(filters.maxErfSize);
  const maxFloorSize = cleanNumberParam(filters.maxFloorSize);
  const maxPrice = cleanNumberParam(filters.maxPrice);
  const minErfSize = cleanNumberParam(filters.minErfSize);
  const minFloorSize = cleanNumberParam(filters.minFloorSize);
  const minPrice = cleanNumberParam(filters.minPrice);
  const parking = cleanNumberParam(filters.parking);
  const petsAllowed = cleanBooleanChoice(filters.petsAllowed);
  const propertyTypes = cleanOptionList(propertyTypeOptions, filters.propertyType);
  const propertyType = propertyTypes[0] || "";
  const shortLetAllowed = cleanBooleanChoice(filters.shortLetAllowed);
  const features = (Array.isArray(filters.features)
    ? filters.features
    : filters.features
      ? [filters.features]
      : []
  )
    .map(cleanParam)
    .filter((feature) =>
      (featureOptions as readonly string[]).some(
        (option) => option.toLowerCase() === feature.toLowerCase(),
      ),
    )
    .slice(0, 10);

  return {
    area,
    areas,
    bathrooms,
    bedrooms,
    buyerIncentive,
    countryName,
    features,
    furnishedStatus,
    garages,
    listingType,
    listingTypes,
    maxErfSize,
    maxFloorSize,
    maxPrice,
    minErfSize,
    minFloorSize,
    minPrice,
    parking,
    petsAllowed,
    propertyType,
    propertyTypes,
    shortLetAllowed,
  };
}

export function discoverListingHeading(filters: DiscoverListingFilters = {}) {
  const normalized = normalizeDiscoverListingFilters(filters);
  const activeListingTypeLabel = normalized.listingTypes.length
    ? normalized.listingTypes
        .map((value) => optionLabel(listingTypeOptions, value, value))
        .join(", ")
    : "";
  const activePropertyTypeLabel = normalized.propertyTypes.length
    ? normalized.propertyTypes
        .map((value) => optionLabel(propertyTypeOptions, value, value))
        .join(", ")
    : "";

  return (
    [
      activeListingTypeLabel,
      activePropertyTypeLabel,
      normalized.areas.length ? normalized.areas.join(", ") : normalized.countryName,
    ]
      .filter(Boolean)
      .join(" in ") || "All published listings"
  );
}

function discoverWhere(filters: ReturnType<typeof normalizeDiscoverListingFilters>) {
  const areaFilters = filters.areas.flatMap((area) => [
    ilike(propertyListings.location, `%${area}%`),
    sql`${propertyListings.details}->>'suburb' ilike ${`%${area}%`}`,
    sql`${propertyListings.details}->>'city' ilike ${`%${area}%`}`,
  ]);

  return [
    eq(propertyListings.status, "published"),
    filters.listingTypes.length
      ? inArray(propertyListings.listingType, filters.listingTypes)
      : undefined,
    filters.propertyTypes.length
      ? inArray(propertyListings.propertyType, filters.propertyTypes)
      : undefined,
    areaFilters.length ? or(...areaFilters) : undefined,
    !filters.areas.length && filters.countryName
      ? or(
          ilike(propertyListings.location, `%${filters.countryName}%`),
          sql`${propertyListings.details}->>'country' ilike ${`%${filters.countryName}%`}`,
        )
      : undefined,
    filters.minPrice
      ? sql`${propertyListings.askingPriceCents} >= ${Number(filters.minPrice) * 100}`
      : undefined,
    filters.maxPrice
      ? sql`${propertyListings.askingPriceCents} <= ${Number(filters.maxPrice) * 100}`
      : undefined,
    filters.bedrooms
      ? sql`nullif(${propertyListings.details}->>'bedrooms', '')::numeric >= ${Number(filters.bedrooms)}`
      : undefined,
    filters.bathrooms
      ? sql`nullif(${propertyListings.details}->>'bathrooms', '')::numeric >= ${Number(filters.bathrooms)}`
      : undefined,
    filters.garages
      ? sql`nullif(${propertyListings.details}->>'garages', '')::numeric >= ${Number(filters.garages)}`
      : undefined,
    filters.parking
      ? sql`nullif(${propertyListings.details}->>'parking', '')::numeric >= ${Number(filters.parking)}`
      : undefined,
    filters.minFloorSize
      ? sql`nullif(${propertyListings.details}->>'floorSize', '')::numeric >= ${Number(filters.minFloorSize)}`
      : undefined,
    filters.maxFloorSize
      ? sql`nullif(${propertyListings.details}->>'floorSize', '')::numeric <= ${Number(filters.maxFloorSize)}`
      : undefined,
    filters.minErfSize
      ? sql`nullif(${propertyListings.details}->>'erfSize', '')::numeric >= ${Number(filters.minErfSize)}`
      : undefined,
    filters.maxErfSize
      ? sql`nullif(${propertyListings.details}->>'erfSize', '')::numeric <= ${Number(filters.maxErfSize)}`
      : undefined,
    filters.buyerIncentive
      ? sql`${propertyListings.details}->>'buyerIncentive' ilike ${`%${filters.buyerIncentive}%`}`
      : undefined,
    filters.furnishedStatus
      ? sql`${propertyListings.details}->>'furnishedStatus' = ${filters.furnishedStatus}`
      : undefined,
    filters.petsAllowed
      ? sql`${propertyListings.details}->>'petsAllowed' = ${filters.petsAllowed}`
      : undefined,
    filters.shortLetAllowed
      ? sql`${propertyListings.details}->>'shortLetAllowed' = ${filters.shortLetAllowed}`
      : undefined,
    ...filters.features.map(
      (feature) => sql`${propertyListings.features} @> ${JSON.stringify([feature])}::jsonb`,
    ),
  ].filter((filter): filter is SQL => Boolean(filter));
}

export async function getDiscoverListingCount(
  filters: DiscoverListingFilters = {},
) {
  const normalizedFilters = normalizeDiscoverListingFilters(filters);
  const where = discoverWhere(normalizedFilters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(propertyListings)
    .where(and(...where));

  return count;
}

function listingAreaName(location: string | null, details: unknown) {
  const parsedDetails = metadataObject(details);
  const explicitArea =
    cleanParam(parsedDetails.suburb as string) ||
    cleanParam(parsedDetails.city as string) ||
    cleanParam(parsedDetails.area as string);

  if (explicitArea) return explicitArea;

  const locationParts = (location || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (locationParts.length >= 4) return locationParts[1];
  if (locationParts.length >= 2) return locationParts[0];

  return location || "";
}

function sortedNumberStrings(values: Array<number | null>) {
  return Array.from(
    new Set(
      values
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
        .map((value) => String(value)),
    ),
  ).sort((first, second) => Number(first) - Number(second));
}

export async function getDiscoverListingFilterOptions({
  countryName,
}: {
  countryName?: string;
} = {}): Promise<ListingFilterOptions> {
  const filters = [
    eq(propertyListings.status, "published"),
    countryName
      ? or(
          ilike(propertyListings.location, `%${countryName}%`),
          sql`${propertyListings.details}->>'country' ilike ${`%${countryName}%`}`,
        )
      : undefined,
  ].filter((filter): filter is SQL => Boolean(filter));
  const rows = await db
    .select({
      askingPriceCents: propertyListings.askingPriceCents,
      details: propertyListings.details,
      location: propertyListings.location,
    })
    .from(propertyListings)
    .where(and(...filters))
    .orderBy(desc(propertyListings.listedAt))
    .limit(500);
  const areaSet = new Set<string>();
  const buyerIncentiveSet = new Set<string>();
  const bedrooms: Array<number | null> = [];
  const bathrooms: Array<number | null> = [];
  const garages: Array<number | null> = [];
  const parking: Array<number | null> = [];
  const floorSizes: Array<number | null> = [];
  const erfSizes: Array<number | null> = [];
  const prices: Array<number | null> = [];

  rows.forEach((row) => {
    const details = metadataObject(row.details);
    const area = listingAreaName(row.location, row.details);
    const buyerIncentive = cleanParam(details.buyerIncentive as string);

    if (area) areaSet.add(area);
    if (buyerIncentive) buyerIncentiveSet.add(buyerIncentive);

    bedrooms.push(numberValue(details.bedrooms));
    bathrooms.push(numberValue(details.bathrooms));
    garages.push(numberValue(details.garages));
    parking.push(numberValue(details.parking));
    floorSizes.push(numberValue(details.floorSize));
    erfSizes.push(numberValue(details.erfSize));
    prices.push(
      typeof row.askingPriceCents === "number"
        ? Math.round(row.askingPriceCents / 100)
        : null,
    );
  });

  return {
    areas: Array.from(areaSet).sort((first, second) => first.localeCompare(second)),
    bathrooms: sortedNumberStrings(bathrooms),
    bedrooms: sortedNumberStrings(bedrooms),
    buyerIncentives: Array.from(buyerIncentiveSet).sort((first, second) =>
      first.localeCompare(second),
    ),
    erfSizes: sortedNumberStrings(erfSizes),
    floorSizes: sortedNumberStrings(floorSizes),
    garages: sortedNumberStrings(garages),
    parking: sortedNumberStrings(parking),
    prices: sortedNumberStrings(prices),
  };
}

export async function getDiscoverListings({
  filters,
  limit = 12,
  offset = 0,
  viewerUserId,
}: DiscoverListingOptions) {
  const normalizedFilters = normalizeDiscoverListingFilters(filters);
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 24);
  const safeOffset = Math.max(Math.floor(offset), 0);
  const where = discoverWhere(normalizedFilters);
  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(propertyListings)
    .where(and(...where));
  const rows = await db
    .select({
      askingPriceCents: propertyListings.askingPriceCents,
      coverImageUrl: propertyListings.coverImageUrl,
      details: propertyListings.details,
      features: propertyListings.features,
      id: propertyListings.id,
      listingType: propertyListings.listingType,
      location: propertyListings.location,
      mandateEndDate: propertyListings.mandateEndDate,
      mandateStartDate: propertyListings.mandateStartDate,
      mandateType: propertyListings.mandateType,
      media: propertyListings.media,
      priceLabel: propertyListings.priceLabel,
      propertyType: propertyListings.propertyType,
      title: propertyListings.title,
    })
    .from(propertyListings)
    .where(and(...where))
    .orderBy(desc(propertyListings.listedAt))
    .limit(safeLimit + 1)
    .offset(safeOffset);

  const visibleRows = rows.slice(0, safeLimit);
  const listings: ListingCardData[] = await Promise.all(
    visibleRows.map(async (listing) => {
      const details = metadataObject(listing.details);
      const media = Array.isArray(listing.media) ? listing.media : [];
      const coverMedia = media.find((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return false;

        const mediaItem = item as Record<string, unknown>;

        return (
          mediaItem.path === listing.coverImageUrl &&
          !isVideoMediaType(mediaItem.type)
        );
      });
      const imageUrls = media
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return "";
          }

          if (isVideoMediaType((item as Record<string, unknown>).type)) return "";

          return toPublicMediaUrl((item as Record<string, unknown>).path as string);
        })
        .filter(isNonEmptyString);
      const videoUrls = media
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return "";
          }

          if (!isVideoMediaType((item as Record<string, unknown>).type)) return "";

          return toPublicMediaUrl((item as Record<string, unknown>).path as string);
        })
        .filter(isNonEmptyString);
      const [{ count: likeCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(listingLikes)
        .where(eq(listingLikes.listingId, listing.id));
      const [{ count: saveCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(listingSaves)
        .where(eq(listingSaves.listingId, listing.id));
      const [viewerLike] = viewerUserId
        ? await db
            .select({ listingId: listingLikes.listingId })
            .from(listingLikes)
            .where(
              and(
                eq(listingLikes.listingId, listing.id),
                eq(listingLikes.userId, viewerUserId),
              ),
            )
            .limit(1)
        : [];
      const [viewerSave] = viewerUserId
        ? await db
            .select({ listingId: listingSaves.listingId })
            .from(listingSaves)
            .where(
              and(
                eq(listingSaves.listingId, listing.id),
                eq(listingSaves.userId, viewerUserId),
              ),
            )
            .limit(1)
        : [];

      return {
        bathrooms: numberValue(details.bathrooms),
        bedrooms: numberValue(details.bedrooms),
        buyerIncentive:
          typeof details.buyerIncentive === "string" ? details.buyerIncentive : null,
        coverImageUrl:
          toPublicMediaUrl(
            (coverMedia as Record<string, unknown> | undefined)?.path as
              | string
              | undefined,
          ) || imageUrls[0],
        erfSize: numberValue(details.erfSize),
        features: stringArray(listing.features).slice(0, 10),
        floorSize: numberValue(details.floorSize),
        garages: numberValue(details.garages),
        href: buildListingPath({
          bedrooms: numberValue(details.bedrooms),
          city: cleanParam(details.city as string),
          country: cleanParam(details.country as string),
          id: listing.id,
          listingType: listing.listingType,
          location: listing.location,
          propertyType: listing.propertyType,
          province:
            cleanParam(details.province as string) ||
            cleanParam(details.state as string) ||
            cleanParam(details.region as string),
          suburb: cleanParam(details.suburb as string),
          title: listing.title,
        }),
        id: listing.id,
        imageUrls,
        likedByViewer: Boolean(viewerLike),
        likeCount,
        likeCountLabel: formatCompactCount(likeCount),
        listingType: listing.listingType,
        listingTypeLabel: optionLabel(
          listingTypeOptions,
          listing.listingType,
          listing.listingType,
        ),
        location: listing.location,
        mandateEndDate: listing.mandateEndDate?.toISOString().slice(0, 10),
        mandateStartDate: listing.mandateStartDate?.toISOString().slice(0, 10),
        mandateType: listing.mandateType,
        parking: numberValue(details.parking),
        previousPriceCents: numberValue(details.previousAskingPriceCents),
        priceCents: listing.askingPriceCents,
        priceLabel: listing.priceLabel,
        propertyTypeLabel: optionLabel(
          propertyTypeOptions,
          listing.propertyType,
          listing.propertyType,
        ),
        savedByViewer: Boolean(viewerSave),
        saveCount,
        saveCountLabel: formatCompactCount(saveCount),
        title: listing.title,
        videoUrls,
      };
    }),
  );

  return {
    filters: normalizedFilters,
    hasMore: rows.length > safeLimit,
    listings,
    nextOffset: safeOffset + listings.length,
    totalCount,
  };
}
