import {
  listingTypeOptions,
  propertyTypeOptions,
  type ListingType,
  type PropertyType,
} from "@/modules/listings/options";

type ListingSeoInput = {
  bathrooms?: number | string | null;
  bedrooms?: number | string | null;
  city?: string | null;
  country?: string | null;
  description?: string | null;
  features?: string[] | null;
  floorSize?: number | string | null;
  id: string;
  listingType: ListingType | string;
  location?: string | null;
  priceLabel?: string | null;
  propertyType: PropertyType | string;
  province?: string | null;
  region?: string | null;
  state?: string | null;
  suburb?: string | null;
  title?: string | null;
};

const listingTypeSegments: Record<string, string> = {
  commercial: "commercial",
  development: "new-development",
  rental: "to-rent",
  sale: "for-sale",
};

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function slugifyListingPart(value: string | null | undefined) {
  return compactText(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function listingTypeToPathSegment(listingType: string) {
  return listingTypeSegments[listingType] || slugifyListingPart(listingType) || "property";
}

export function listingPathSegmentToType(segment: string) {
  const normalized = slugifyListingPart(segment);
  const match = Object.entries(listingTypeSegments).find(
    ([, pathSegment]) => pathSegment === normalized,
  );

  return match?.[0] || normalized;
}

export function shortListingId(id: string) {
  return id.replace(/-/g, "").slice(0, 8).toLowerCase();
}

export function extractShortListingIdFromSlug(slug: string) {
  return slugifyListingPart(slug).match(/([a-f0-9]{8})$/)?.[1] || "";
}

function optionLabel<T extends { label: string; value: string }>(
  options: readonly T[],
  value: string,
) {
  return options.find((option) => option.value === value)?.label || value;
}

function cleanPropertyTypeLabel(value: string) {
  return optionLabel(propertyTypeOptions, value)
    .replace(/\s*\/\s*/g, " ")
    .replace(/\bflat\b/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function locationParts(value: string | null | undefined) {
  return compactText(value || "")
    .split(",")
    .map((part) => compactText(part))
    .filter(Boolean);
}

function numberLabel(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value || 0);

  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : "";
}

function listingArea(listing: ListingSeoInput) {
  const parts = locationParts(listing.location);

  return compactText(listing.suburb || "") ||
    compactText(listing.city || "") ||
    (parts.length >= 4 ? parts[parts.length - 3] : parts[0]) ||
    "";
}

function listingProvince(listing: ListingSeoInput) {
  return (
    compactText(listing.province || "") ||
    compactText(listing.state || "") ||
    compactText(listing.region || "") ||
    compactText(listing.country || "") ||
    "South Africa"
  );
}

function listingCity(listing: ListingSeoInput) {
  const parts = locationParts(listing.location);

  return (
    compactText(listing.city || "") ||
    (parts.length >= 3 ? parts[parts.length - 2] : "") ||
    listingArea(listing) ||
    "property"
  );
}

export function buildListingSlug(listing: ListingSeoInput) {
  const bedrooms = numberLabel(listing.bedrooms);
  const propertyType = cleanPropertyTypeLabel(listing.propertyType);
  const area = listingArea(listing);
  const saleIntent = optionLabel(listingTypeOptions, listing.listingType)
    .replace(/^rental$/i, "to rent")
    .toLowerCase();
  const descriptiveParts = [
    bedrooms ? `${bedrooms} bedroom` : "",
    propertyType,
    area ? "in" : saleIntent,
    area,
  ].filter(Boolean);
  const readable = slugifyListingPart(descriptiveParts.join(" ")) || "property";

  return `${readable}-${shortListingId(listing.id)}`;
}

export function buildListingPath(listing: ListingSeoInput) {
  const typeSegment = listingTypeToPathSegment(listing.listingType);
  const provinceSegment = slugifyListingPart(listingProvince(listing));
  const citySegment = slugifyListingPart(listingCity(listing));

  return `/property/${typeSegment}/${provinceSegment}/${citySegment}/${buildListingSlug(listing)}`;
}

export function buildListingSeoTitle(listing: ListingSeoInput) {
  const bedrooms = numberLabel(listing.bedrooms);
  const propertyType = optionLabel(propertyTypeOptions, listing.propertyType);
  const listingType = optionLabel(listingTypeOptions, listing.listingType);
  const city = compactText(listing.city || "") || listingArea(listing);
  const title = [
    bedrooms ? `${bedrooms} Bedroom` : "",
    propertyType,
    listingType.toLowerCase(),
    city ? `in ${city}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return compactText(title || listing.title || "Property listing");
}

export function buildListingSeoDescription(listing: ListingSeoInput) {
  const bedrooms = numberLabel(listing.bedrooms);
  const bathrooms = numberLabel(listing.bathrooms);
  const propertyType = cleanPropertyTypeLabel(listing.propertyType);
  const listingType = optionLabel(listingTypeOptions, listing.listingType).toLowerCase();
  const city = compactText(listing.city || "") || listingArea(listing);
  const province = listingProvince(listing);
  const metrics = [
    bedrooms ? `${bedrooms} bedroom` : "",
    propertyType,
    listingType,
    city ? `in ${city}` : "",
    province && province !== city ? province : "",
  ].filter(Boolean);
  const detail = [
    bathrooms ? `${bathrooms} bathroom${bathrooms === "1" ? "" : "s"}` : "",
    listing.priceLabel,
    ...(listing.features || []).slice(0, 3),
  ].filter(Boolean);

  return compactText(
    `View this ${metrics.join(" ")} on Homzie. ${
      detail.length ? `See ${detail.join(", ")}, photos, agent details and property location.` : "See photos, features, agent details and property location."
    }`,
  ).slice(0, 170);
}

export function buildListingImageAlt(listing: ListingSeoInput) {
  return `${buildListingSeoTitle(listing)} exterior view`;
}
