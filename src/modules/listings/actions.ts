"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type RedisClientType } from "redis";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { db, sql as rawSql } from "@/db";
import {
  listingActionEvents,
  listingPresenceSessions,
  listingReservations,
  listingLikes,
  listingSaves,
  listingViewEvents,
  propertyIdentities,
  propertyListingStatusHistory,
  propertyListings,
  propertyOffers,
  users,
} from "@/db/schema";
import { isSafeMediaPath, toPublicMediaUrl } from "@/media/paths";
import { getMediaStorageRoot } from "@/media/storage";
import { getAgentProfileForUser } from "@/modules/agents/queries";
import { authOptions } from "@/modules/auth/config";
import {
  createUserEvent,
  createUserEventOnce,
} from "@/modules/events/server";
import {
  absoluteAppUrl,
  sendTemplatedEmailToUser,
} from "@/modules/email/server";
import { getStripe, getStripePublishableKey } from "@/modules/billing/stripe";
import {
  extractHashtags,
  recordHashtagUsage,
} from "@/modules/hashtags/server";
import {
  listingTypeOptions,
  mandateTypeOptions,
  propertyCategoryOptions,
  propertyTypeOptions,
  type PropertyType,
} from "@/modules/listings/options";
import { buildListingPath } from "@/modules/listings/seo";
import {
  calculateReservationFees,
  getStoredReservationSettings,
} from "@/modules/platform-settings/reservation-settings";
import {
  getDiscoverListingCount,
  getDiscoverListings,
  type DiscoverListingFilters,
} from "@/modules/listings/server/discover-listings";
import { completeListingReservationPayment } from "@/modules/listings/reservations";
import { and, eq, inArray, ne, sql } from "drizzle-orm";

const maxListingImageBytes = 15 * 1024 * 1024;
const maxListingVideoBytes = 80 * 1024 * 1024;
const maxListingMediaItems = 70;
const maxListingTitleLength = 120;
const maxListingDescriptionLength = 3000;
const maxListingFeatures = 10;
const maxListingFeatureLength = 24;
const defaultTitleImprovementModel = "gpt-4.1-mini";
const aiActionCooldownSeconds = 30;
const localAiCooldowns = new Map<string, number>();
let aiCooldownClientPromise: Promise<RedisClientType> | null = null;
const listingImageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const listingVideoTypes: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};
const residentialPropertyTypes = new Set<PropertyType | string>([
  "apartment",
  "cluster_home",
  "duet",
  "development_unit",
  "estate_home",
  "flatlet",
  "free_standing_house",
  "guest_house",
  "retirement_unit",
  "room",
  "student_accommodation",
  "townhouse",
]);
const landOnlyPropertyTypes = new Set<PropertyType | string>([
  "agricultural_land",
  "development_land",
  "development_project",
  "farm",
  "game_farm",
  "lifestyle_farm",
  "small_holding",
  "vacant_land",
  "wine_farm",
]);
const commercialPropertyTypes = new Set<PropertyType | string>([
  "business_premises",
  "commercial_development",
  "commercial_property",
  "factory",
  "guest_house",
  "hospitality",
  "industrial",
  "medical_suite",
  "mixed_use",
  "office",
  "restaurant",
  "retail",
  "showroom",
  "warehouse",
]);

const listingTypeValues = listingTypeOptions.map((option) => option.value) as [
  string,
  ...string[],
];
const propertyTypeValues = propertyTypeOptions.map((option) => option.value) as [
  string,
  ...string[],
];
const propertyCategoryValues = propertyCategoryOptions.map((option) => option.value) as [
  string,
  ...string[],
];
const mandateTypeValues = mandateTypeOptions.map((option) => option.value) as [
  string,
  ...string[],
];
const completedListingStatuses = new Set([
  "sold",
  "sold_externally",
  "withdrawn",
  "expired",
  "disputed",
  "archived",
]);

function areListingReservationsPaused() {
  return true;
}
const activeDuplicateListingStatuses = ["draft", "published", "reserved"];

type StoredListingMedia = {
  name: string;
  path: string;
  size: number;
  sourceUrl?: string;
  type: string;
};

function formatCompactCount(value: number) {
  if (value < 1000) {
    return String(value);
  }

  const compactValue = value / 1000;

  return `${Number.isInteger(compactValue) ? compactValue.toFixed(0) : compactValue.toFixed(1)}K`;
}

function viewMilestoneForCount(count: number) {
  if ([10, 25, 50, 100, 250, 500].includes(count)) return count;
  if (count >= 1000 && count % 1000 === 0) return count;

  return null;
}

const listingSchema = z.object({
  addressVisibility: z.enum(["area", "exact"]).optional(),
  askingPrice: z.coerce.number().finite().min(0).max(10_000_000_000).optional(),
  availableFrom: z.string().trim().max(32).optional(),
  bathrooms: z.coerce.number().min(0).max(99).optional(),
  bedrooms: z.coerce.number().int().min(0).max(99).optional(),
  buyerIncentive: z.string().trim().max(40).optional(),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  developerName: z.string().trim().max(120).optional(),
  description: z.string().trim().max(10_000).optional(),
  erfSize: z.coerce.number().min(0).max(10_000_000).optional(),
  estateName: z.string().trim().max(120).optional(),
  features: z.array(z.string()).optional(),
  floorSize: z.coerce.number().min(0).max(10_000_000).optional(),
  furnishedStatus: z.enum(["", "yes", "no"]).optional(),
  garages: z.coerce.number().int().min(0).max(99).optional(),
  grossLettableArea: z.coerce.number().min(0).max(10_000_000).optional(),
  googlePlaceId: z.string().trim().max(180).optional(),
  googlePlaceData: z.string().trim().max(10_000).optional(),
  insuranceEstimate: z.coerce.number().finite().min(0).max(10_000_000_000).optional(),
  landSizeHectares: z.coerce.number().min(0).max(10_000_000).optional(),
  leaseExpiryDate: z.string().trim().max(32).optional(),
  listingVisibility: z.enum(["public", "profile_private"]).optional(),
  listingType: z.enum(listingTypeValues),
  location: z.string().trim().min(2).max(240),
  localTaxes: z.coerce.number().finite().min(0).max(10_000_000_000).optional(),
  loadingBays: z.coerce.number().int().min(0).max(999).optional(),
  mandateEndDate: z.string().trim().max(32).optional(),
  mandateStartDate: z.string().trim().max(32).optional(),
  mandateType: z.enum(mandateTypeValues),
  communityFees: z.coerce.number().finite().min(0).max(10_000_000_000).optional(),
  occupancyStatus: z.string().trim().max(80).optional(),
  ownershipType: z.string().trim().max(80).optional(),
  outbuildings: z.string().trim().max(160).optional(),
  parking: z.coerce.number().int().min(0).max(99).optional(),
  petsAllowed: z.enum(["", "yes", "no"]).optional(),
  powerSupply: z.string().trim().max(80).optional(),
  previousAskingPrice: z.coerce
    .number()
    .finite()
    .min(0)
    .max(10_000_000_000)
    .optional(),
  priceQualifier: z.string().trim().max(40).optional(),
  propertyCategory: z.enum(propertyCategoryValues),
  propertyType: z.enum(propertyTypeValues),
  province: z.string().trim().max(120).optional(),
  ratesAndTaxes: z.coerce.number().finite().min(0).max(10_000_000_000).optional(),
  publishIntent: z.enum(["draft", "published"]),
  reservationAmount: z.coerce
    .number()
    .finite()
    .min(0)
    .max(10_000_000_000)
    .optional(),
  reservationEnabled: z.boolean().optional(),
  rentalYield: z.coerce.number().finite().min(0).max(100).optional(),
  servitudes: z.string().trim().max(180).optional(),
  shortLetAllowed: z.enum(["", "yes", "no"]).optional(),
  suburb: z.string().trim().max(120).optional(),
  titleDeedStatus: z.string().trim().max(80).optional(),
  title: z.string().trim().min(4).max(maxListingTitleLength),
  transferCostsEstimate: z.coerce
    .number()
    .finite()
    .min(0)
    .max(10_000_000_000)
    .optional(),
  unitCount: z.coerce.number().int().min(0).max(100_000).optional(),
  contactVisibility: z.enum(["show", "hide_details"]).optional(),
  utilitiesEstimate: z.coerce.number().finite().min(0).max(10_000_000_000).optional(),
  waterRights: z.string().trim().max(80).optional(),
  zoning: z.string().trim().max(80).optional(),
});
const listingIdSchema = z.uuid();
const listingAnalyticsSourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .optional();
const listingViewerSessionSchema = z.string().trim().min(4).max(160);
const listingActionTypeSchema = z.enum([
  "bond_calculator",
  "call_agent",
  "card_click",
  "contact_agent",
  "email_agent",
  "gallery_next",
  "gallery_previous",
  "hover",
  "media_thumbnail",
  "media_video_play",
  "like",
  "place_offer",
  "reserve_now",
  "save",
  "share",
  "whatsapp_agent",
]);
const listingViewEventSchema = z.object({
  listingId: listingIdSchema,
  source: listingAnalyticsSourceSchema,
  viewInstanceId: z.string().trim().min(4).max(160).optional(),
  viewerSessionId: listingViewerSessionSchema,
});
const listingActionEventSchema = listingViewEventSchema.extend({
  actionType: listingActionTypeSchema,
});
const listingLiveIntentSchema = z.object({
  listingId: listingIdSchema,
});
const listingPresenceWindowSeconds = 5 * 60;

const titleImprovementSchema = z.object({
  description: z.string().trim().max(10_000).optional(),
  listingType: z.enum(listingTypeValues),
  location: z.string().trim().max(240).optional(),
  propertyType: z.enum(propertyTypeValues),
  title: z.string().trim().min(4).max(maxListingTitleLength),
});

const descriptionImprovementSchema = z.object({
  bathrooms: z.string().trim().max(20).optional(),
  bedrooms: z.string().trim().max(20).optional(),
  description: z.string().trim().max(10_000).optional(),
  erfSize: z.string().trim().max(40).optional(),
  features: z.array(z.string()).optional(),
  floorSize: z.string().trim().max(40).optional(),
  listingType: z.enum(listingTypeValues),
  location: z.string().trim().max(240).optional(),
  propertyType: z.enum(propertyTypeValues),
  title: z.string().trim().min(4).max(maxListingTitleLength),
});
const listingImportAiSchema = z.object({
  askingPrice: z.coerce.number().finite().min(0).max(10_000_000_000).optional(),
  bathrooms: z.coerce.number().min(0).max(99).optional(),
  bedrooms: z.coerce.number().int().min(0).max(99).optional(),
  description: z.string().trim().max(10_000).optional(),
  erfSize: z.coerce.number().min(0).max(10_000_000).optional(),
  estateName: z.string().trim().max(120).optional(),
  features: z.array(z.string().trim().min(1).max(80)).max(maxListingFeatures).optional(),
  floorSize: z.coerce.number().min(0).max(10_000_000).optional(),
  garages: z.coerce.number().int().min(0).max(99).optional(),
  grossLettableArea: z.coerce.number().min(0).max(10_000_000).optional(),
  landSizeHectares: z.coerce.number().min(0).max(10_000_000).optional(),
  listingType: z.enum(listingTypeValues).optional(),
  parking: z.coerce.number().int().min(0).max(99).optional(),
  propertyType: z.enum(propertyTypeValues).optional(),
  servitudes: z.string().trim().max(180).optional(),
  title: z.string().trim().max(maxListingTitleLength).optional(),
  zoning: z.string().trim().max(80).optional(),
});

function parseListingFormData(formData: FormData) {
  const rawFeatures = formData
    .getAll("features")
    .map(String)
    .map(normalizeListingFeature)
    .filter(Boolean)
    .slice(0, maxListingFeatures);
  const publishIntent = String(formData.get("publishIntent") || "draft");
  const mandateType = String(formData.get("mandateType") || "");
  const parsed = listingSchema.safeParse({
    addressVisibility: formData.get("addressVisibility") || "area",
    askingPrice: numberOrUndefined(formData.get("askingPrice")),
    availableFrom: formData.get("availableFrom"),
    bathrooms: decimalOrUndefined(formData.get("bathrooms")),
    bedrooms: numberOrUndefined(formData.get("bedrooms")),
    buyerIncentive: formData.get("buyerIncentive"),
    city: formData.get("city"),
    country: formData.get("country"),
    developerName: formData.get("developerName"),
    description: formData.get("description"),
    erfSize: decimalOrUndefined(formData.get("erfSize")),
    estateName: formData.get("estateName"),
    features: Array.from(new Set(rawFeatures)),
    floorSize: decimalOrUndefined(formData.get("floorSize")),
    furnishedStatus: formData.get("furnishedStatus") || "",
    garages: numberOrUndefined(formData.get("garages")),
    grossLettableArea: decimalOrUndefined(formData.get("grossLettableArea")),
    googlePlaceId: formData.get("googlePlaceId"),
    googlePlaceData: formData.get("googlePlaceData"),
    insuranceEstimate: numberOrUndefined(formData.get("insuranceEstimate")),
    landSizeHectares: decimalOrUndefined(formData.get("landSizeHectares")),
    leaseExpiryDate: formData.get("leaseExpiryDate"),
    listingVisibility: formData.get("listingVisibility") || "public",
    listingType: formData.get("listingType"),
    location:
      String(formData.get("location") || "").trim() ||
      (publishIntent === "draft" ? "Location not set" : ""),
    localTaxes: numberOrUndefined(formData.get("localTaxes")),
    loadingBays: numberOrUndefined(formData.get("loadingBays")),
    mandateEndDate: formData.get("mandateEndDate"),
    mandateStartDate: formData.get("mandateStartDate"),
    mandateType: (mandateTypeValues as readonly string[]).includes(mandateType)
      ? mandateType
      : "open",
    communityFees: numberOrUndefined(formData.get("communityFees")),
    occupancyStatus: formData.get("occupancyStatus") || "",
    ownershipType: formData.get("ownershipType") || "",
    outbuildings: formData.get("outbuildings"),
    parking: numberOrUndefined(formData.get("parking")),
    petsAllowed: formData.get("petsAllowed") || "",
    powerSupply: formData.get("powerSupply") || "",
    previousAskingPrice: numberOrUndefined(formData.get("previousAskingPrice")),
    priceQualifier: formData.get("priceQualifier"),
    propertyCategory: formData.get("propertyCategory"),
    propertyType: formData.get("propertyType"),
    province: formData.get("province"),
    ratesAndTaxes: numberOrUndefined(formData.get("ratesAndTaxes")),
    publishIntent,
    reservationAmount: numberOrUndefined(formData.get("reservationAmount")),
    reservationEnabled: formData.get("reservationEnabled") === "on",
    rentalYield: decimalOrUndefined(formData.get("rentalYield")),
    servitudes: formData.get("servitudes"),
    shortLetAllowed: formData.get("shortLetAllowed") || "",
    suburb: formData.get("suburb"),
    title:
      String(formData.get("title") || "").trim() ||
      (publishIntent === "draft" ? "Untitled listing" : ""),
    titleDeedStatus: formData.get("titleDeedStatus") || "",
    transferCostsEstimate: numberOrUndefined(formData.get("transferCostsEstimate")),
    unitCount: numberOrUndefined(formData.get("unitCount")),
    contactVisibility: formData.get("contactVisibility") || "show",
    utilitiesEstimate: numberOrUndefined(formData.get("utilitiesEstimate")),
    waterRights: formData.get("waterRights") || "",
    zoning: formData.get("zoning") || "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Listing details are invalid.");
  }

  const description = sanitizeListingDescription(parsed.data.description || "");

  if (plainListingDescription(description).length > maxListingDescriptionLength) {
    throw new Error(
      `Description must be ${maxListingDescriptionLength} characters or fewer.`,
    );
  }

  return { data: parsed.data, description };
}

function parseGooglePlaceData(value: string | undefined) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function listingDetailsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function detailsString(
  details: Record<string, unknown>,
  key: string,
): string {
  const value = details[key];

  return typeof value === "string" ? value.trim() : "";
}

function hasCompleteLocationParts({
  city,
  country,
  location,
  province,
}: {
  city?: string | null;
  country?: string | null;
  location?: string | null;
  province?: string | null;
}) {
  return Boolean(
    location?.trim() &&
      location.trim() !== "Location not set" &&
      location.trim().length >= 2 &&
      city?.trim() &&
      province?.trim() &&
      country?.trim(),
  );
}

function listingCoverImagePath(
  media: StoredListingMedia[],
  preferredIndex: number,
) {
  const preferred = media[preferredIndex];

  if (preferred?.type.startsWith("image/")) {
    return preferred.path;
  }

  return media.find((item) => item.type.startsWith("image/"))?.path || null;
}

function assertListingCanPublish(
  data: z.infer<typeof listingSchema>,
  description: string,
  mediaCount: number,
) {
  if (data.publishIntent !== "published") return;

  const issues: string[] = [];
  const descriptionText = plainListingDescription(description);

  if (!data.listingType) {
    issues.push("Choose whether the listing is for sale or rent.");
  }

  if (!data.propertyType) {
    issues.push("Choose the property type.");
  }

  if (data.title === "Untitled listing" || data.title.trim().length < 4) {
    issues.push("Add a listing title.");
  }

  if (data.location === "Location not set" || data.location.trim().length < 2) {
    issues.push("Add the property location.");
  }

  if (!data.city || !data.province || !data.country) {
    issues.push("Add the city, province, and country.");
  }

  if (descriptionText.length < 40) {
    issues.push("Add a fuller property description.");
  }

  const hasBedroomCount =
    typeof data.bedrooms === "number" && Number.isFinite(data.bedrooms);
  const hasBathroomCount =
    typeof data.bathrooms === "number" && Number.isFinite(data.bathrooms);
  const hasFloorSize =
    typeof data.floorSize === "number" &&
    Number.isFinite(data.floorSize) &&
    data.floorSize > 0;
  const hasErfSize =
    typeof data.erfSize === "number" &&
    Number.isFinite(data.erfSize) &&
    data.erfSize > 0;

  if (
    residentialPropertyTypes.has(data.propertyType) &&
    (!hasBedroomCount || !hasBathroomCount || !hasFloorSize)
  ) {
    issues.push("Add bedrooms, bathrooms, and floor size.");
  }

  if (commercialPropertyTypes.has(data.propertyType) && !hasFloorSize) {
    issues.push("Add the floor size.");
  }

  if (landOnlyPropertyTypes.has(data.propertyType) && !hasErfSize) {
    issues.push("Add the erf size.");
  }

  if (
    typeof data.askingPrice !== "number" ||
    !Number.isFinite(data.askingPrice) ||
    data.askingPrice <= 0
  ) {
    issues.push("Set the asking price.");
  }

  if (mediaCount < 1) {
    issues.push("Upload at least one listing photo or video.");
  }

  if (issues.length) {
    throw new Error(`Listing incomplete: ${issues.join(" ")}`);
  }
}

async function getValidatedReservationFields(data: z.infer<typeof listingSchema>) {
  const settings = await getStoredReservationSettings();
  const amountCents =
    typeof data.reservationAmount === "number" && data.reservationAmount > 0
      ? Math.round(data.reservationAmount * 100)
      : null;
  const enabled = Boolean(data.reservationEnabled);

  if (!enabled) {
    return {
      reservationAmountCents: amountCents,
      reservationEnabled: false,
    };
  }

  if (!settings.enabled) {
    throw new Error("Reservations are currently disabled by the platform.");
  }

  if (data.listingType === "rental") {
    throw new Error("Reservations are only available for sale listings.");
  }

  if (!amountCents) {
    throw new Error("Set a reservation amount before enabling reservations.");
  }

  if (
    amountCents < settings.minReservationAmountCents ||
    amountCents > settings.maxReservationAmountCents
  ) {
    throw new Error(
      `Reservation amount must be between R${settings.minReservationAmountCents / 100} and R${settings.maxReservationAmountCents / 100}.`,
    );
  }

  return {
    reservationAmountCents: amountCents,
    reservationEnabled: true,
  };
}

function normalizeDuplicateLocation(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

async function findDuplicateActiveListing({
  data,
  userId,
}: {
  data: z.infer<typeof listingSchema>;
  userId: string;
}) {
  const normalizedLocation = normalizeDuplicateLocation(data.location);

  if (
    !normalizedLocation ||
    normalizedLocation === "location not set" ||
    normalizedLocation.length < 2
  ) {
    return null;
  }

  const [duplicate] = await db
    .select({
      id: propertyListings.id,
      title: propertyListings.title,
    })
    .from(propertyListings)
    .where(
      and(
        eq(propertyListings.userId, userId),
        inArray(propertyListings.status, activeDuplicateListingStatuses),
        sql`lower(regexp_replace(${propertyListings.location}, '\\s+', ' ', 'g')) = ${normalizedLocation}`,
      ),
    )
    .limit(1);

  return duplicate || null;
}

const importUrlSchema = z.string().trim().url().max(2_000);
const maxImportHtmlBytes = 2_500_000;
const maxImportedImages = maxListingMediaItems;
const importedImageFetchTimeoutMs = 8_000;
const importedHtmlFetchTimeoutMs = 12_000;

function isBlockedImportHostname(hostname: string) {
  const normalized = hostname.toLowerCase();

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "0.0.0.0" ||
    normalized === "::1"
  ) {
    return true;
  }

  if (/^127\./.test(normalized) || /^10\./.test(normalized) || /^192\.168\./.test(normalized)) {
    return true;
  }

  const private172 = normalized.match(/^172\.(\d{1,2})\./);

  return private172 ? Number(private172[1]) >= 16 && Number(private172[1]) <= 31 : false;
}

function safeImportUrl(value: string) {
  const parsed = importUrlSchema.safeParse(value);

  if (!parsed.success) {
    throw new Error("Paste a valid property listing URL.");
  }

  const url = new URL(parsed.data);

  if (!["http:", "https:"].includes(url.protocol) || isBlockedImportHostname(url.hostname)) {
    throw new Error("That URL cannot be imported.");
  }

  return url;
}

function decodeHtmlEntities(value: string) {
  const entities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, entity) => entities[String(entity).toLowerCase()] || match);
}

function stripHtml(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function htmlTextLines(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<\/?(?:article|aside|blockquote|br|div|dl|dt|dd|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|section|table|tbody|td|tfoot|th|thead|tr|ul)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line, index, lines) => lines.indexOf(line) === index);
}

function metaContent(html: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escapedKey}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${escapedKey}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escapedKey}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escapedKey}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) return decodeHtmlEntities(match[1]).trim();
  }

  return "";
}

function titleContent(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  return match?.[1] ? stripHtml(match[1]) : "";
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return "";
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap(flattenJsonLd);
  }

  if (typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const graph = flattenJsonLd(record["@graph"]);

  return [record, ...graph];
}

function jsonLdObjects(html: string) {
  const objects: Record<string, unknown>[] = [];

  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const rawJson = match[1] || "";

    try {
      objects.push(...flattenJsonLd(JSON.parse(rawJson)));
    } catch {
      try {
        objects.push(...flattenJsonLd(JSON.parse(decodeHtmlEntities(rawJson))));
      } catch {
        // Ignore malformed third-party JSON-LD.
      }
    }
  }

  return objects;
}

function nestedRecord(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return nestedRecord(value[0]);

  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function extractJsonLdAddress(objects: Record<string, unknown>[]) {
  for (const object of objects) {
    const address = nestedRecord(object.address);
    const street = firstString(address.streetAddress);
    const suburb = firstString(address.addressLocality, address.addressRegion);
    const city = firstString(address.addressLocality);
    const province = firstString(address.addressRegion);
    const countryRecord = nestedRecord(address.addressCountry);
    const country = firstString(address.addressCountry, countryRecord.name);
    const parts = [street, suburb, city, province, country]
      .filter(Boolean)
      .filter((part, index, list) => list.indexOf(part) === index);

    if (parts.length) {
      return {
        city,
        country,
        location: parts.join(", "),
        province,
        suburb: suburb !== city ? suburb : "",
      };
    }
  }

  return { city: "", country: "", location: "", province: "", suburb: "" };
}

function extractJsonLdImages(objects: Record<string, unknown>[]) {
  const images: string[] = [];

  for (const object of objects) {
    const image = object.image;

    if (typeof image === "string") {
      images.push(image);
    } else if (Array.isArray(image)) {
      for (const item of image) {
        if (typeof item === "string") images.push(item);
        else if (item && typeof item === "object") {
          const url = firstString((item as Record<string, unknown>).url);
          if (url) images.push(url);
        }
      }
    } else if (image && typeof image === "object") {
      const url = firstString((image as Record<string, unknown>).url);
      if (url) images.push(url);
    }
  }

  return images;
}

function normalizeMoney(value: string) {
  const numeric = value
    .replace(/[^\d,.]/g, "")
    .replace(/\s/g, "")
    .replace(/,(?=\d{3}\b)/g, "")
    .replace(/,/g, ".");

  const amount = Number(numeric);

  return Number.isFinite(amount) && amount > 0 ? String(Math.round(amount)) : "";
}

function firstTextNumber(text: string, pattern: RegExp) {
  const match = text.match(pattern);

  return match?.[1] ? match[1].replace(",", ".") : "";
}

function numberNearLabel(lines: string[], labels: string[]) {
  const labelPattern = new RegExp(`\\b(?:${labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] || "";
    if (!labelPattern.test(line)) continue;

    const combined = [line, lines[index + 1] || ""].join(" ");
    const afterLabel = combined.match(/:\s*(\d+(?:[,.]\d+)?)/);
    const beforeLabel = combined.match(/(\d+(?:[,.]\d+)?)\s*(?:bed|bedroom|bath|bathroom|garage|parking|parkings|parking bays?|m²|sqm|sq m|square metres?)?/i);
    const value = afterLabel?.[1] || beforeLabel?.[1] || "";

    if (value) return value.replace(",", ".");
  }

  return "";
}

function inferListingType(text: string) {
  const normalized = text.toLowerCase();

  const saleSignal = /\b(for sale|house for sale|home for sale|property for sale|buy|purchase|selling price|asking price|bond calculator)\b/.test(normalized);
  const rentalSignal =
    /\b(to rent|for rent|rental|monthly rental|rental amount|lease|tenant|per month)\b/.test(normalized) ||
    /(?:r|zar)\s?[\d\s,.]{3,}\s*(?:\/\s*(?:month|pm)|p\/m|per month)\b/i.test(text);

  if (rentalSignal && !saleSignal) {
    return "rental" as const;
  }

  if (saleSignal) return "sale" as const;

  if (/\b(development|new development|off plan|off-plan)\b/.test(normalized)) {
    return "development" as const;
  }

  if (/\b(commercial|office|retail|industrial|warehouse|factory|showroom|medical suite|restaurant|business premises)\b/.test(normalized)) {
    return "commercial" as const;
  }

  return "sale" as const;
}

function inferPropertyType(text: string) {
  const normalized = text.toLowerCase();

  if (/\b(small holding|smallholding)\b/.test(normalized)) return "small_holding" as const;
  if (/\b(wine farm|vineyard)\b/.test(normalized)) return "wine_farm" as const;
  if (/\b(game farm)\b/.test(normalized)) return "game_farm" as const;
  if (/\b(lifestyle farm)\b/.test(normalized)) return "lifestyle_farm" as const;
  if (/\bfarm\b/.test(normalized)) return "farm" as const;
  if (/\b(commercial development)\b/.test(normalized)) return "commercial_development" as const;
  if (/\b(business premises|business property)\b/.test(normalized)) return "business_premises" as const;
  if (/\b(hotel|lodge|guest lodge|hospitality)\b/.test(normalized)) return "hospitality" as const;
  if (/\bmixed[-\s]?use\b/.test(normalized)) return "mixed_use" as const;
  if (/\bmedical (suite|rooms|practice)|consulting rooms\b/.test(normalized)) return "medical_suite" as const;
  if (/\brestaurant|food premises|coffee shop|takeaway\b/.test(normalized)) return "restaurant" as const;
  if (/\bshowroom\b/.test(normalized)) return "showroom" as const;
  if (/\boffice\b/.test(normalized)) return "office" as const;
  if (/\bretail|shop\b/.test(normalized)) return "retail" as const;
  if (/\bfactory\b/.test(normalized)) return "factory" as const;
  if (/\bindustrial\b/.test(normalized)) return "industrial" as const;
  if (/\bwarehouse\b/.test(normalized)) return "warehouse" as const;
  if (/\bcommercial\b/.test(normalized)) return "commercial_property" as const;
  if (/\b(agricultural land)\b/.test(normalized)) return "agricultural_land" as const;
  if (/\b(development land)\b/.test(normalized)) return "development_land" as const;
  if (/\b(apartment|flat)\b/.test(normalized)) return "apartment" as const;
  if (/\b(flatlet|garden cottage)\b/.test(normalized)) return "flatlet" as const;
  if (/\b(student accommodation|student housing)\b/.test(normalized)) return "student_accommodation" as const;
  if (/\b(room to rent|room\b)\b/.test(normalized)) return "room" as const;
  if (/\b(townhouse|town house)\b/.test(normalized)) return "townhouse" as const;
  if (/\b(duet)\b/.test(normalized)) return "duet" as const;
  if (/\b(cluster)\b/.test(normalized)) return "cluster_home" as const;
  if (/\b(retirement)\b/.test(normalized)) return "retirement_unit" as const;
  if (/\b(guest house|guesthouse)\b/.test(normalized)) return "guest_house" as const;
  if (/\b(estate)\b/.test(normalized)) return "estate_home" as const;
  if (/\b(vacant land|plot|stand)\b/.test(normalized)) return "vacant_land" as const;
  if (/\b(development project)\b/.test(normalized)) return "development_project" as const;
  if (/\b(development unit)\b/.test(normalized)) return "development_unit" as const;

  return "free_standing_house" as const;
}

function extractDescriptionSection(lines: string[]) {
  const stopPattern = /^(features|amenities|property details|listing details|external features|interior features|contact|bond calculator|calculate bond|similar properties|share|location|map|documents)$/i;

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^description$/i.test(lines[index] || "")) continue;

    const parts: string[] = [];

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor] || "";

      if (stopPattern.test(line)) break;
      if (/^read full description/i.test(line)) continue;
      if (line.length < 3) continue;

      parts.push(line);

      if (parts.join(" ").length >= maxListingDescriptionLength) break;
    }

    const description = cleanListingDescription(parts.join("\n\n"));
    if (description.length >= 40) return description;
  }

  return "";
}

function extractFeaturesFromText(text: string) {
  const featureMap: Array<[RegExp, string]> = [
    [/\bstudy\b/i, "Study"],
    [/\bpet friendly\b|\bpets allowed\b/i, "Pet friendly"],
    [/\bpool\b|\bswimming pool\b/i, "Pool"],
    [/\bgarden\b/i, "Garden"],
    [/\bsolar panels?\b|\bsolar\b/i, "Solar"],
    [/\bbackup battery\b|\binverter\b|\bbackup power\b/i, "Backup power"],
    [/\bsecurity\b|\bsecure estate\b|\bgated\b/i, "Security"],
    [/\bfibre\b|\bfiber\b/i, "Fibre"],
    [/\bsea view\b|\bocean view\b/i, "Sea view"],
    [/\bmountain view\b/i, "Mountain view"],
    [/\bfurnished\b/i, "Furnished"],
    [/\bair conditioning\b|\baircon\b/i, "Air conditioning"],
    [/\bstaff quarters\b|\bdomestic quarters\b/i, "Staff quarters"],
  ];

  return featureMap
    .filter(([pattern]) => pattern.test(text))
    .map(([, label]) => label)
    .slice(0, maxListingFeatures);
}

function normalizeImportedFeature(value: string) {
  const normalized = value.toLowerCase();

  if (/\bbackup\b|\binverter\b|\bbattery\b/.test(normalized)) return "Backup power";
  if (/\bsolar\b/.test(normalized)) return "Solar";
  if (/\bpet\b/.test(normalized)) return "Pet friendly";
  if (/\bair\s?con\b|\bair conditioning\b/.test(normalized)) return "Air conditioning";
  if (/\bstaff\b|\bdomestic quarters\b/.test(normalized)) return "Staff quarters";

  return normalizeListingFeature(value);
}

function importedDescriptionHtml(value: string) {
  const cleaned = cleanListingDescription(stripHtml(value));

  if (!cleaned) return "";

  return cleaned
    .split(/\n{2,}|(?<=\.)\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((part) => `<p>${part.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("");
}

type ImportedDraft = {
  askingPrice: string;
  bathrooms: string;
  bedrooms: string;
  city: string;
  country: string;
  description: string;
  erfSize: string;
  estateName: string;
  features: string[];
  floorSize: string;
  garages: string;
  grossLettableArea: string;
  landSizeHectares: string;
  listingType: (typeof listingTypeOptions)[number]["value"];
  location: string;
  parking: string;
  propertyType: (typeof propertyTypeOptions)[number]["value"];
  province: string;
  servitudes: string;
  suburb: string;
  title: string;
  zoning: string;
};

function responseOutputText(result: {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
}) {
  return (
    result.output_text ||
    result.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text || "")
      .join(" ") ||
    ""
  );
}

function parseJsonObject(value: string) {
  const trimmed = value.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function mergeImportedDraft(
  base: ImportedDraft,
  aiDraft: z.infer<typeof listingImportAiSchema>,
): ImportedDraft {
  return {
    ...base,
    askingPrice: aiDraft.askingPrice ? String(Math.round(aiDraft.askingPrice)) : base.askingPrice,
    bathrooms: typeof aiDraft.bathrooms === "number" ? String(aiDraft.bathrooms) : base.bathrooms,
    bedrooms: typeof aiDraft.bedrooms === "number" ? String(Math.round(aiDraft.bedrooms)) : base.bedrooms,
    description: aiDraft.description ? importedDescriptionHtml(aiDraft.description) : base.description,
    erfSize: typeof aiDraft.erfSize === "number" && aiDraft.erfSize > 0 ? String(aiDraft.erfSize) : base.erfSize,
    estateName: aiDraft.estateName || base.estateName,
    features: aiDraft.features?.length
      ? aiDraft.features.map(normalizeImportedFeature).filter(Boolean).slice(0, maxListingFeatures)
      : base.features,
    floorSize:
      typeof aiDraft.floorSize === "number" && aiDraft.floorSize > 0
        ? String(aiDraft.floorSize)
        : base.floorSize,
    garages: typeof aiDraft.garages === "number" ? String(Math.round(aiDraft.garages)) : base.garages,
    grossLettableArea:
      typeof aiDraft.grossLettableArea === "number" && aiDraft.grossLettableArea > 0
        ? String(aiDraft.grossLettableArea)
        : base.grossLettableArea,
    landSizeHectares:
      typeof aiDraft.landSizeHectares === "number" && aiDraft.landSizeHectares > 0
        ? String(aiDraft.landSizeHectares)
        : base.landSizeHectares,
    listingType: (aiDraft.listingType || base.listingType) as ImportedDraft["listingType"],
    parking: typeof aiDraft.parking === "number" ? String(Math.round(aiDraft.parking)) : base.parking,
    propertyType: (aiDraft.propertyType || base.propertyType) as ImportedDraft["propertyType"],
    servitudes: aiDraft.servitudes || base.servitudes,
    title: aiDraft.title ? cleanListingTitle(aiDraft.title) : base.title,
    zoning: aiDraft.zoning || base.zoning,
  };
}

async function mapImportedListingWithAi(input: {
  baseDraft: ImportedDraft;
  jsonLd: Record<string, unknown>[];
  sourceUrl: string;
  textLines: string[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) return { draft: input.baseDraft, usedAi: false };

  const evidence = input.textLines
    .filter((line) => line.length <= 280)
    .slice(0, 220)
    .join("\n")
    .slice(0, 18_000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            content: [
              {
                text: [
                  "Extract structured data from this South African property listing page.",
                  "Use only facts explicitly present in the evidence. Do not invent.",
                  "Return strict JSON only, with these optional keys:",
                  "title, listingType, propertyType, askingPrice, bedrooms, bathrooms, garages, parking, floorSize, erfSize, grossLettableArea, landSizeHectares, estateName, zoning, servitudes, features, description.",
                  "",
                  "Rules:",
                  "- listingType must be sale, rental, development, or commercial.",
                  `- propertyType must be one of: ${propertyTypeValues.join(", ")}.`,
                  "- If the evidence says 'for sale' or has a bond calculator, prefer sale unless there is clear rental/monthly rent language.",
                  "- Only use rental when the page clearly says to rent, rental, lease, per month, /month, p/m, or monthly rental.",
                  "- askingPrice must be a number in ZAR, without cents or separators.",
                  "- bedrooms, bathrooms, garages, and parking must be numeric counts. Do not confuse garages with parking.",
                  "- floorSize and erfSize must be numeric square metre values. If only one size exists, map it only when the label makes the meaning clear.",
                  "- description must be the full marketing description section, not only the headline or mandate line.",
                  "- features must be short labels, max 24 characters each.",
                  "",
                  `Source URL: ${input.sourceUrl}`,
                  `Current deterministic draft: ${JSON.stringify(input.baseDraft)}`,
                  `JSON-LD evidence: ${JSON.stringify(input.jsonLd).slice(0, 6000)}`,
                  "",
                  "Visible page evidence:",
                  evidence,
                ].join("\n"),
                type: "input_text",
              },
            ],
            role: "user",
          },
        ],
        max_output_tokens: 900,
        model: process.env.OPENAI_IMPORT_MODEL || defaultTitleImprovementModel,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[listings] import AI mapping failed", {
        error: errorText.slice(0, 500),
        status: response.status,
      });

      return { draft: input.baseDraft, usedAi: false };
    }

    const result = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
    };
    const parsed = listingImportAiSchema.safeParse(parseJsonObject(responseOutputText(result)));

    if (!parsed.success) {
      console.error("[listings] import AI mapping returned invalid JSON", parsed.error.flatten());
      return { draft: input.baseDraft, usedAi: false };
    }

    return { draft: mergeImportedDraft(input.baseDraft, parsed.data), usedAi: true };
  } catch (error) {
    console.error("[listings] import AI mapping error", error);

    return { draft: input.baseDraft, usedAi: false };
  }
}

function absoluteImportUrl(value: string, sourceUrl: URL) {
  try {
    const url = new URL(decodeHtmlEntities(value), sourceUrl);

    if (!["http:", "https:"].includes(url.protocol)) return "";

    return url.toString();
  } catch {
    return "";
  }
}

function importImageSourceKey(value: string) {
  try {
    const url = new URL(value);

    url.hash = "";

    return url.toString();
  } catch {
    return value.trim();
  }
}

function extractImageUrls(html: string, sourceUrl: URL, objects: Record<string, unknown>[]) {
  const candidates = [
    metaContent(html, "og:image"),
    metaContent(html, "twitter:image"),
    ...extractJsonLdImages(objects),
  ];

  for (const match of html.matchAll(/<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*>/gi)) {
    if (match[1]) candidates.push(match[1]);
  }

  return Array.from(
    new Set(
      candidates
        .map((candidate) => absoluteImportUrl(candidate, sourceUrl))
        .filter(Boolean)
        .filter((url) => !url.startsWith("data:")),
    ),
  ).slice(0, maxImportedImages);
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent":
          "Mozilla/5.0 (compatible; HomzieListingImporter/1.0; +https://homzie.co.za)",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function importImageCandidates(urls: string[], knownSourceUrls: string[] = []) {
  const media: StoredListingMedia[] = [];
  const warnings: string[] = [];
  const knownSourceKeys = new Set(
    knownSourceUrls
      .map((url) => importImageSourceKey(String(url || "")))
      .filter(Boolean),
  );
  let skippedExistingCount = 0;

  for (const url of urls) {
    if (media.length >= maxImportedImages) break;

    const sourceKey = importImageSourceKey(url);

    if (knownSourceKeys.has(sourceKey)) {
      skippedExistingCount += 1;
      continue;
    }

    try {
      const response = await fetchWithTimeout(url, importedImageFetchTimeoutMs);
      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "";
      const contentLength = Number(response.headers.get("content-length") || 0);

      if (!response.ok || !listingImageTypes[contentType]) continue;
      if (contentLength > maxListingImageBytes) continue;

      const bytes = await response.arrayBuffer();

      if (bytes.byteLength > maxListingImageBytes) continue;

      const extension = listingImageTypes[contentType];
      const fileName = `imported-listing-${media.length + 1}.${extension}`;
      const file = new File([bytes], fileName, { type: contentType });
      const [storedFile] = await storeListingMedia([file]);

      if (storedFile) {
        media.push({
          ...storedFile,
          sourceUrl: url,
        });
        knownSourceKeys.add(sourceKey);
      }
    } catch {
      warnings.push("Some imported images could not be downloaded.");
    }
  }

  return {
    media,
    skippedExistingCount,
    warnings: Array.from(new Set(warnings)),
  };
}

export async function importListingDraftFromUrl(
  urlValue: string,
  existingImportedMediaSources: string[] = [],
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { error: "Sign in to import a listing." };
  }

  let sourceUrl: URL;

  try {
    sourceUrl = safeImportUrl(urlValue);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Paste a valid property listing URL.",
    };
  }

  try {
    const response = await fetchWithTimeout(sourceUrl.toString(), importedHtmlFetchTimeoutMs);
    const contentType = response.headers.get("content-type") || "";
    const contentLength = Number(response.headers.get("content-length") || 0);

    if (!response.ok) {
      return { error: "Homzie could not read that listing page." };
    }

    if (contentLength > maxImportHtmlBytes) {
      return { error: "That page is too large to import safely." };
    }

    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return { error: "That link does not look like a property listing page." };
    }

    const html = await response.text();

    if (html.length > maxImportHtmlBytes) {
      return { error: "That page is too large to import safely." };
    }

    const objects = jsonLdObjects(html);
    const visibleText = stripHtml(html);
    const textLines = htmlTextLines(html);
    const structuredText = textLines.join("\n");
    const jsonLdTitle = firstString(...objects.map((object) => firstString(object.name, object.headline)));
    const jsonLdDescription = firstString(...objects.map((object) => object.description));
    const jsonLdOffer =
      objects
        .map((object) => nestedRecord(object.offers))
        .find((offer) => Object.keys(offer).length) || {};
    const jsonLdAddress = extractJsonLdAddress(objects);
    const title = cleanListingTitle(
      firstString(metaContent(html, "og:title"), jsonLdTitle, titleContent(html)).replace(/\s+[|-]\s+.*$/, ""),
    );
    const sectionDescription = extractDescriptionSection(textLines);
    const descriptionSource = firstString(
      sectionDescription,
      metaContent(html, "og:description"),
      metaContent(html, "description"),
      jsonLdDescription,
      visibleText.slice(0, 1200),
    );
    const priceText = firstString(
      metaContent(html, "product:price:amount"),
      firstString(jsonLdOffer.price, nestedRecord(jsonLdOffer.priceSpecification).price),
      visibleText.match(/(?:R|ZAR)\s?[\d\s,.]{4,}/i)?.[0],
    );
    const listingType = inferListingType(`${title} ${visibleText}`);
    const propertyType = inferPropertyType(`${title} ${visibleText}`);
    const imageUrls = extractImageUrls(html, sourceUrl, objects);
    const importedImages = await importImageCandidates(
      imageUrls,
      existingImportedMediaSources.slice(0, maxListingMediaItems),
    );
    const bedrooms =
      numberNearLabel(textLines, ["Bedrooms", "Bedroom", "Beds", "Bed"]) ||
      firstTextNumber(visibleText, /(\d+(?:[,.]\d+)?)\s*(?:bed|bedroom|beds|bedrooms)\b/i);
    const bathrooms =
      numberNearLabel(textLines, ["Bathrooms", "Bathroom", "Baths", "Bath"]) ||
      firstTextNumber(visibleText, /(\d+(?:[,.]\d+)?)\s*(?:bath|bathroom|baths|bathrooms)\b/i);
    const garages =
      numberNearLabel(textLines, ["Garages", "Garage"]) ||
      firstTextNumber(visibleText, /(\d+)\s*(?:garage|garages)\b/i);
    const parking =
      numberNearLabel(textLines, ["Parking", "Parkings", "Parking bays"]) ||
      firstTextNumber(visibleText, /(\d+)\s*(?:parking|parkings|parking bays?)\b/i);
    const floorSize =
      firstTextNumber(structuredText, /(?:floor size|floor area|under roof|building size|house size|home size)\D{0,24}(\d+(?:[,.]\d+)?)\s*(?:m²|sqm|sq m|square metres?)/i) ||
      firstTextNumber(structuredText, /(\d+(?:[,.]\d+)?)\s*(?:m²|sqm|sq m|square metres?)\D{0,24}(?:floor|under roof|building)/i);
    const erfSize =
      firstTextNumber(structuredText, /(?:erf|land size|plot size|stand size)\D{0,24}(\d+(?:[,.]\d+)?)\s*(?:m²|sqm|sq m|square metres?)/i) ||
      firstTextNumber(structuredText, /(\d+(?:[,.]\d+)?)\s*(?:m²|sqm|sq m|square metres?)\D{0,24}(?:erf|plot|stand|land)/i);
    const grossLettableArea =
      firstTextNumber(structuredText, /(?:gla|gross lettable area)\D{0,24}(\d+(?:[,.]\d+)?)\s*(?:m²|sqm|sq m|square metres?)/i) ||
      "";
    const landSizeHectares =
      firstTextNumber(structuredText, /(?:land size|farm size|extent)\D{0,24}(\d+(?:[,.]\d+)?)\s*(?:ha|hectares?)/i) ||
      firstTextNumber(structuredText, /(\d+(?:[,.]\d+)?)\s*(?:ha|hectares?)\D{0,24}(?:farm|land|extent)/i);
    const zoning =
      firstString(
        structuredText.match(/\b(residential|commercial|industrial|agricultural|mixed use|development)\s+zoning\b/i)?.[1],
        structuredText.match(/\bzoned\s+(residential|commercial|industrial|agricultural|mixed use|development)\b/i)?.[1],
      )
        .toLowerCase()
        .replace(/\s+/g, "_");
    const servitudes =
      firstString(
        textLines.find((line) => /\b(servitude|restriction|water rights?|rights registered)\b/i.test(line)),
      ).slice(0, 180);
    const location =
      jsonLdAddress.location ||
      firstString(metaContent(html, "og:locality"), metaContent(html, "place:location:latitude")) ||
      "";
    const baseDraft: ImportedDraft = {
      askingPrice: normalizeMoney(priceText),
      bathrooms,
      bedrooms: bedrooms ? String(Math.round(Number(bedrooms))) : "",
      city: jsonLdAddress.city,
      country: jsonLdAddress.country,
      description: importedDescriptionHtml(descriptionSource),
      erfSize,
      estateName: "",
      features: extractFeaturesFromText(visibleText),
      floorSize,
      garages,
      grossLettableArea,
      landSizeHectares,
      listingType,
      location,
      parking,
      propertyType,
      province: jsonLdAddress.province,
      servitudes,
      suburb: jsonLdAddress.suburb,
      title,
      zoning,
    };
    const aiMapped = await mapImportedListingWithAi({
      baseDraft,
      jsonLd: objects,
      sourceUrl: sourceUrl.toString(),
      textLines,
    });
    const warnings = [
      ...importedImages.warnings,
      aiMapped.usedAi
        ? "AI reviewed the scraped listing details. Confirm the imported facts before publishing."
        : "Review every imported field before publishing.",
      importedImages.media.length
        ? "Imported images were saved to this draft. Confirm you have permission to use them."
        : "No usable listing images could be imported.",
      importedImages.skippedExistingCount
        ? `${importedImages.skippedExistingCount} previously imported image${
            importedImages.skippedExistingCount === 1 ? " was" : "s were"
          } already in this draft and skipped.`
        : "",
      !location ? "Location needs review." : "",
    ].filter(Boolean);

    return {
      draft: aiMapped.draft,
      foundImageCount: imageUrls.length,
      importedImageCount: importedImages.media.length,
      media: importedImages.media,
      skippedExistingImageCount: importedImages.skippedExistingCount,
      sourceUrl: sourceUrl.toString(),
      warnings,
    };
  } catch (error) {
    console.error("[listings] import listing from url failed", {
      error,
      sourceUrl: sourceUrl.toString(),
      userId: session.user.id,
    });

    return { error: "Homzie could not import that listing. Try another link or create it manually." };
  }
}

export async function createListing(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.username) {
    redirect("/onboarding/username");
  }

  const agentProfile = await getAgentProfileForUser(session.user.id);
  const { data, description } = parseListingFormData(formData);
  const duplicateListing = await findDuplicateActiveListing({
    data,
    userId: session.user.id,
  });

  if (duplicateListing) {
    redirect(`/listings/new?duplicateListing=${duplicateListing.id}`);
  }

  const mediaFiles = formData.getAll("mediaFiles");
  const mediaUploadCount = mediaFiles.filter(
    (value) => value instanceof File && value.size > 0,
  ).length;
  const mediaPayloadBytes = mediaFiles.reduce(
    (total, value) => total + (value instanceof File ? value.size : 0),
    0,
  );

  let media: Awaited<ReturnType<typeof storeListingMedia>>;

  try {
    media = [
      ...parseExistingListingMedia(formData.get("existingMedia")),
      ...(await storeListingMedia(mediaFiles)),
    ].slice(0, maxListingMediaItems);
  } catch (error) {
    console.error("[listings] createListing media upload failed", {
      error,
      mediaCount: mediaUploadCount,
      mediaPayloadBytes,
      storageRoot: getMediaStorageRoot(),
      userId: session.user.id,
    });
    redirect("/listings/new?listingError=media-upload");
  }
  try {
    assertListingCanPublish(data, description, media.length);
  } catch (error) {
    console.warn("[listings] createListing publish validation failed", {
      error,
      userId: session.user.id,
    });
    redirect("/listings/new?listingError=publish-validation");
  }
  let reservationFields: Awaited<ReturnType<typeof getValidatedReservationFields>>;

  try {
    reservationFields = await getValidatedReservationFields(data);
  } catch (error) {
    console.error("[listings] createListing reservation validation failed", {
      error,
      userId: session.user.id,
    });
    redirect("/listings/new?listingError=reservation-validation");
  }
  const coverIndex = Math.min(
    Math.max(Number(formData.get("coverIndex") || 0), 0),
    Math.max(media.length - 1, 0),
  );
  const coverImageUrl = listingCoverImagePath(media, coverIndex);
  const askingPriceCents =
    typeof data.askingPrice === "number"
      ? Math.round(data.askingPrice * 100)
      : null;
  const previousAskingPriceCents =
    typeof data.previousAskingPrice === "number" &&
    typeof data.askingPrice === "number" &&
    data.previousAskingPrice > data.askingPrice
      ? Math.round(data.previousAskingPrice * 100)
      : null;
  const localTaxesCents =
    typeof data.localTaxes === "number" ? Math.round(data.localTaxes * 100) : null;
  const communityFeesCents =
    typeof data.communityFees === "number"
      ? Math.round(data.communityFees * 100)
      : null;
  const ratesAndTaxesCents =
    typeof data.ratesAndTaxes === "number" ? Math.round(data.ratesAndTaxes * 100) : null;
  const utilitiesEstimateCents =
    typeof data.utilitiesEstimate === "number"
      ? Math.round(data.utilitiesEstimate * 100)
      : null;
  const insuranceEstimateCents =
    typeof data.insuranceEstimate === "number"
      ? Math.round(data.insuranceEstimate * 100)
      : null;
  const transferCostsEstimateCents =
    typeof data.transferCostsEstimate === "number"
      ? Math.round(data.transferCostsEstimate * 100)
      : null;
  const priceLabel = buildPriceLabel({
    amount: data.askingPrice,
    listingType: data.listingType,
    qualifier: data.priceQualifier,
  });
  const googlePlaceData = parseGooglePlaceData(data.googlePlaceData);
  const [identity] = await db
    .insert(propertyIdentities)
    .values({
      city: data.city || null,
      country: data.country || null,
      googlePlaceData,
      googlePlaceId: data.googlePlaceId || null,
      normalizedAddress: data.location.toLowerCase(),
      province: data.province || null,
      suburb: data.suburb || null,
      propertyType: data.propertyType,
    })
    .onConflictDoNothing()
    .returning({ id: propertyIdentities.id });

  const [listing] = await db
    .insert(propertyListings)
    .values({
      agentProfileId: agentProfile?.id || null,
      askingPriceCents,
      coverImageUrl,
      description: description || null,
      details: {
        addressVisibility: data.addressVisibility || "area",
        availableFrom: data.availableFrom || null,
        bathrooms: data.bathrooms ?? null,
        bedrooms: data.bedrooms ?? null,
        buyerIncentive: data.buyerIncentive || null,
        communityFeesCents,
        developerName: data.developerName || null,
        erfSize: data.erfSize ?? null,
        estateName: data.estateName || null,
        floorSize: data.floorSize ?? null,
        furnishedStatus: data.furnishedStatus || null,
        garages: data.garages ?? null,
        grossLettableArea: data.grossLettableArea ?? null,
        googlePlaceData,
        googlePlaceId: data.googlePlaceId || null,
        insuranceEstimateCents,
        landSizeHectares: data.landSizeHectares ?? null,
        leaseExpiryDate: data.leaseExpiryDate || null,
        listingVisibility: data.listingVisibility || "public",
        localTaxesCents,
        loadingBays: data.loadingBays ?? null,
        city: data.city || null,
        country: data.country || null,
        occupancyStatus: data.occupancyStatus || null,
        ownershipType: data.ownershipType || null,
        outbuildings: data.outbuildings || null,
        parking: data.parking ?? null,
        petsAllowed: data.petsAllowed || null,
        powerSupply: data.powerSupply || null,
        previousAskingPriceCents,
        priceQualifier: data.priceQualifier || null,
        propertyCategory: data.propertyCategory,
        province: data.province || null,
        ratesAndTaxesCents,
        rentalYield: data.rentalYield ?? null,
        servitudes: data.servitudes || null,
        shortLetAllowed: data.shortLetAllowed || null,
        suburb: data.suburb || null,
        titleDeedStatus: data.titleDeedStatus || null,
        transferCostsEstimateCents,
        unitCount: data.unitCount ?? null,
        contactVisibility: data.contactVisibility || "show",
        utilitiesEstimateCents,
        waterRights: data.waterRights || null,
        zoning: data.zoning || null,
      },
      features: data.features || [],
      listedAt: data.publishIntent === "published" ? new Date() : undefined,
      listingType: data.listingType,
      location: data.location,
      mandateEndDate: parseDate(data.mandateEndDate),
      mandateStartDate: parseDate(data.mandateStartDate),
      mandateType: data.mandateType,
      media,
      priceLabel,
      propertyIdentityId: identity?.id || null,
      propertyType: data.propertyType,
      ...reservationFields,
      status: data.publishIntent,
      title: data.title,
      userId: session.user.id,
    })
    .returning({ id: propertyListings.id });

  await db.insert(propertyListingStatusHistory).values({
    listingId: listing.id,
    reason:
      data.publishIntent === "published"
        ? "Listing created and published."
        : "Listing saved as draft.",
    toStatus: data.publishIntent,
    userId: session.user.id,
  });

  if (data.publishIntent === "published") {
    await recordHashtagUsage({
      sourceId: listing.id,
      sourceType: "listing",
      tags: extractHashtags(data.title, plainListingDescription(description)),
      userId: session.user.id,
    });
    void notifyFollowersAboutPublishedListing({
      listingId: listing.id,
      ownerUserId: session.user.id,
    }).catch((error) => {
      console.error("[email] listing follower notification failed", error);
    });
  }

  redirect(
    data.publishIntent === "published"
      ? `/listings/new?listingPublished=${listing.id}`
      : `/users/${user.username}?tab=listings`,
  );
}

export async function updateListing(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const listingId = z.string().uuid().safeParse(formData.get("listingId"));

  if (!listingId.success) {
    throw new Error("Listing ID is invalid.");
  }

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.username) {
    redirect("/onboarding/username");
  }

  const [existingListing] = await db
    .select({
      details: propertyListings.details,
      listedAt: propertyListings.listedAt,
      lockedAt: propertyListings.lockedAt,
      location: propertyListings.location,
      propertyIdentityId: propertyListings.propertyIdentityId,
      status: propertyListings.status,
    })
    .from(propertyListings)
    .where(
      and(
        eq(propertyListings.id, listingId.data),
        eq(propertyListings.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!existingListing) {
    throw new Error("Listing not found.");
  }

  if (
    existingListing.lockedAt ||
    completedListingStatuses.has(existingListing.status)
  ) {
    throw new Error("This listing is locked and can no longer be edited.");
  }

  const agentProfile = await getAgentProfileForUser(session.user.id);
  const { data, description } = parseListingFormData(formData);
  const mediaFiles = formData.getAll("mediaFiles");
  const mediaUploadCount = mediaFiles.filter(
    (value) => value instanceof File && value.size > 0,
  ).length;
  const mediaPayloadBytes = mediaFiles.reduce(
    (total, value) => total + (value instanceof File ? value.size : 0),
    0,
  );

  let uploadedMedia: Awaited<ReturnType<typeof storeListingMedia>>;

  try {
    uploadedMedia = await storeListingMedia(mediaFiles);
  } catch (error) {
    console.error("[listings] updateListing media upload failed", {
      error,
      listingId: listingId.data,
      mediaCount: mediaUploadCount,
      mediaPayloadBytes,
      storageRoot: getMediaStorageRoot(),
      userId: session.user.id,
    });
    redirect(`/listings/${listingId.data}/edit?listingError=media-upload`);
  }
  const media = [
    ...parseExistingListingMedia(formData.get("existingMedia")),
    ...uploadedMedia,
  ].slice(0, maxListingMediaItems);
  const existingDetails = listingDetailsObject(existingListing.details);
  const existingLocationComplete = hasCompleteLocationParts({
    city: detailsString(existingDetails, "city"),
    country: detailsString(existingDetails, "country"),
    location: existingListing.location,
    province: detailsString(existingDetails, "province"),
  });
  const canChangePropertyIdentity =
    existingListing.status === "draft" || !existingLocationComplete;
  const googlePlaceData = canChangePropertyIdentity
    ? parseGooglePlaceData(data.googlePlaceData)
    : existingDetails.googlePlaceData || null;
  const locationFields = {
    city: canChangePropertyIdentity
      ? data.city || null
      : detailsString(existingDetails, "city") || null,
    country: canChangePropertyIdentity
      ? data.country || null
      : detailsString(existingDetails, "country") || null,
    googlePlaceData,
    googlePlaceId: canChangePropertyIdentity
      ? data.googlePlaceId || null
      : detailsString(existingDetails, "googlePlaceId") || null,
    location: canChangePropertyIdentity
      ? data.location
      : existingListing.location || data.location,
    province: canChangePropertyIdentity
      ? data.province || null
      : detailsString(existingDetails, "province") || null,
    suburb: canChangePropertyIdentity
      ? data.suburb || null
      : detailsString(existingDetails, "suburb") || null,
  };
  try {
    assertListingCanPublish(
      {
        ...data,
        city: locationFields.city || "",
        country: locationFields.country || "",
        googlePlaceData: canChangePropertyIdentity ? data.googlePlaceData : "",
        googlePlaceId: locationFields.googlePlaceId || "",
        location: locationFields.location,
        province: locationFields.province || "",
        suburb: locationFields.suburb || "",
      },
      description,
      media.length,
    );
  } catch (error) {
    console.warn("[listings] updateListing publish validation failed", {
      error,
      listingId: listingId.data,
      userId: session.user.id,
    });
    redirect(`/listings/${listingId.data}/edit?listingError=publish-validation`);
  }
  let reservationFields: Awaited<ReturnType<typeof getValidatedReservationFields>>;

  try {
    reservationFields = await getValidatedReservationFields(data);
  } catch (error) {
    console.error("[listings] updateListing reservation validation failed", {
      error,
      listingId: listingId.data,
      userId: session.user.id,
    });
    redirect(`/listings/${listingId.data}/edit?listingError=reservation-validation`);
  }
  const coverIndex = Math.min(
    Math.max(Number(formData.get("coverIndex") || 0), 0),
    Math.max(media.length - 1, 0),
  );
  const coverImageUrl = listingCoverImagePath(media, coverIndex);
  const askingPriceCents =
    typeof data.askingPrice === "number"
      ? Math.round(data.askingPrice * 100)
      : null;
  const previousAskingPriceCents =
    typeof data.previousAskingPrice === "number" &&
    typeof data.askingPrice === "number" &&
    data.previousAskingPrice > data.askingPrice
      ? Math.round(data.previousAskingPrice * 100)
      : null;
  const localTaxesCents =
    typeof data.localTaxes === "number" ? Math.round(data.localTaxes * 100) : null;
  const communityFeesCents =
    typeof data.communityFees === "number"
      ? Math.round(data.communityFees * 100)
      : null;
  const ratesAndTaxesCents =
    typeof data.ratesAndTaxes === "number" ? Math.round(data.ratesAndTaxes * 100) : null;
  const utilitiesEstimateCents =
    typeof data.utilitiesEstimate === "number"
      ? Math.round(data.utilitiesEstimate * 100)
      : null;
  const insuranceEstimateCents =
    typeof data.insuranceEstimate === "number"
      ? Math.round(data.insuranceEstimate * 100)
      : null;
  const transferCostsEstimateCents =
    typeof data.transferCostsEstimate === "number"
      ? Math.round(data.transferCostsEstimate * 100)
      : null;
  const priceLabel = buildPriceLabel({
    amount: data.askingPrice,
    listingType: data.listingType,
    qualifier: data.priceQualifier,
  });
  const nextStatus =
    existingListing.status === "reserved" ? "reserved" : data.publishIntent;
  try {
    const [identity] = canChangePropertyIdentity
      ? await db
          .insert(propertyIdentities)
          .values({
            city: locationFields.city,
            country: locationFields.country,
            googlePlaceData,
            googlePlaceId: locationFields.googlePlaceId,
            normalizedAddress: locationFields.location.toLowerCase(),
            province: locationFields.province,
            suburb: locationFields.suburb,
            propertyType: data.propertyType,
          })
          .onConflictDoNothing()
          .returning({ id: propertyIdentities.id })
      : [{ id: existingListing.propertyIdentityId }];

    await db
      .update(propertyListings)
      .set({
        agentProfileId: agentProfile?.id || null,
        askingPriceCents,
        coverImageUrl,
        description: description || null,
        details: {
          addressVisibility: data.addressVisibility || "area",
          availableFrom: data.availableFrom || null,
          bathrooms: data.bathrooms ?? null,
          bedrooms: data.bedrooms ?? null,
          buyerIncentive: data.buyerIncentive || null,
          communityFeesCents,
          developerName: data.developerName || null,
          erfSize: data.erfSize ?? null,
          estateName: data.estateName || null,
          floorSize: data.floorSize ?? null,
          furnishedStatus: data.furnishedStatus || null,
          garages: data.garages ?? null,
          grossLettableArea: data.grossLettableArea ?? null,
          googlePlaceData: locationFields.googlePlaceData,
          googlePlaceId: locationFields.googlePlaceId,
          insuranceEstimateCents,
          landSizeHectares: data.landSizeHectares ?? null,
          leaseExpiryDate: data.leaseExpiryDate || null,
          listingVisibility: data.listingVisibility || "public",
          city: locationFields.city,
          country: locationFields.country,
          localTaxesCents,
          loadingBays: data.loadingBays ?? null,
          occupancyStatus: data.occupancyStatus || null,
          ownershipType: data.ownershipType || null,
          outbuildings: data.outbuildings || null,
          parking: data.parking ?? null,
          petsAllowed: data.petsAllowed || null,
          powerSupply: data.powerSupply || null,
          previousAskingPriceCents,
          priceQualifier: data.priceQualifier || null,
          propertyCategory: data.propertyCategory,
          province: locationFields.province,
          ratesAndTaxesCents,
          rentalYield: data.rentalYield ?? null,
          servitudes: data.servitudes || null,
          shortLetAllowed: data.shortLetAllowed || null,
          suburb: locationFields.suburb,
          titleDeedStatus: data.titleDeedStatus || null,
          transferCostsEstimateCents,
          unitCount: data.unitCount ?? null,
          contactVisibility: data.contactVisibility || "show",
          utilitiesEstimateCents,
          waterRights: data.waterRights || null,
          zoning: data.zoning || null,
        },
        features: data.features || [],
        listedAt:
          data.publishIntent === "published" &&
          existingListing.status !== "published"
            ? new Date()
            : existingListing.listedAt,
        listingType: data.listingType,
        location: locationFields.location,
        mandateEndDate: parseDate(data.mandateEndDate),
        mandateStartDate: parseDate(data.mandateStartDate),
        mandateType: data.mandateType,
        media,
        priceLabel,
        propertyIdentityId: canChangePropertyIdentity
          ? identity?.id || existingListing.propertyIdentityId || null
          : existingListing.propertyIdentityId,
        propertyType: data.propertyType,
        ...reservationFields,
        status: nextStatus,
        title: data.title,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(propertyListings.id, listingId.data),
          eq(propertyListings.userId, session.user.id),
        ),
      );

    await db.insert(propertyListingStatusHistory).values({
      listingId: listingId.data,
      reason:
        existingListing.status === nextStatus
          ? "Listing details updated."
          : nextStatus === "published"
            ? "Listing updated and published."
            : "Listing updated and saved as draft.",
      toStatus: nextStatus,
      userId: session.user.id,
    });
  } catch (error) {
    console.error("[listings] updateListing database save failed", {
      error,
      listingId: listingId.data,
      mediaCount: media.length,
      userId: session.user.id,
    });
    redirect(`/listings/${listingId.data}/edit?listingError=save-failed`);
  }

  if (data.publishIntent === "published") {
    void recordHashtagUsage({
      sourceId: listingId.data,
      sourceType: "listing",
      tags: extractHashtags(data.title, plainListingDescription(description)),
      userId: session.user.id,
    }).catch((error) => {
      console.error("[listings] updateListing hashtag recording failed", {
        error,
        listingId: listingId.data,
        userId: session.user.id,
      });
    });

    if (existingListing.status !== "published") {
      void notifyFollowersAboutPublishedListing({
        listingId: listingId.data,
        ownerUserId: session.user.id,
      }).catch((error) => {
        console.error("[email] listing follower notification failed", error);
      });
    }
  }

  const updateResult =
    existingListing.status === "draft" && nextStatus === "published"
      ? "published"
      : nextStatus === "draft"
        ? "draft"
        : "updated";

  redirect(`/listings/${listingId.data}/edit?listingUpdated=${updateResult}`);
}

export async function archiveListing(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const listingId = z.string().uuid().safeParse(formData.get("listingId"));

  if (!listingId.success) {
    throw new Error("Listing ID is invalid.");
  }

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.username) {
    redirect("/onboarding/username");
  }

  const [existingListing] = await db
    .select({
      lockedAt: propertyListings.lockedAt,
      location: propertyListings.location,
      propertyIdentityId: propertyListings.propertyIdentityId,
      status: propertyListings.status,
    })
    .from(propertyListings)
    .where(
      and(
        eq(propertyListings.id, listingId.data),
        eq(propertyListings.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!existingListing) {
    throw new Error("Listing not found.");
  }

  if (existingListing.lockedAt || existingListing.status === "archived") {
    throw new Error("This listing is already locked or archived.");
  }

  const normalizedLocation = normalizeDuplicateLocation(
    existingListing.location || "",
  );
  const hasBeenPublished = existingListing.status !== "draft";
  const [winningSale] = hasBeenPublished
    ? existingListing.propertyIdentityId
      ? await db
          .select({
            id: propertyListings.id,
            outcomeAt: propertyListings.outcomeAt,
            soldAt: propertyListings.soldAt,
          })
          .from(propertyListings)
          .where(
            and(
              eq(
                propertyListings.propertyIdentityId,
                existingListing.propertyIdentityId,
              ),
              eq(propertyListings.status, "sold"),
              ne(propertyListings.id, listingId.data),
            ),
          )
          .limit(1)
      : normalizedLocation.length >= 2
        ? await db
            .select({
              id: propertyListings.id,
              outcomeAt: propertyListings.outcomeAt,
              soldAt: propertyListings.soldAt,
            })
            .from(propertyListings)
            .where(
              and(
                eq(propertyListings.status, "sold"),
                ne(propertyListings.id, listingId.data),
                sql`lower(regexp_replace(${propertyListings.location}, '\\s+', ' ', 'g')) = ${normalizedLocation}`,
              ),
            )
            .limit(1)
        : []
    : [];
  const now = new Date();
  const archiveStatus = winningSale ? "sold_externally" : "archived";
  const outcomeAt = winningSale
    ? winningSale.soldAt || winningSale.outcomeAt || now
    : null;

  await db
    .update(propertyListings)
    .set({
      archivedAt: now,
      outcomeAt,
      status: archiveStatus,
      updatedAt: now,
    })
    .where(
      and(
        eq(propertyListings.id, listingId.data),
        eq(propertyListings.userId, session.user.id),
      ),
    );

  await db.insert(propertyListingStatusHistory).values({
    fromStatus: existingListing.status,
    listingId: listingId.data,
    reason: winningSale
      ? "Listing archived after the same property was recorded as sold by another agent. Performance history is retained and the listing is counted as sold externally."
      : "Listing archived by owner. Performance history is retained and remains protected.",
    toStatus: archiveStatus,
    userId: session.user.id,
  });

  redirect(
    `/users/${user.username}?tab=listings&listingArchived=${listingId.data}&archiveStatus=${archiveStatus}`,
  );
}

export async function startListingReservationCheckout(listingId: string) {
  const parsed = listingIdSchema.safeParse(listingId);

  if (!parsed.success) {
    return { error: "Listing ID is invalid.", ok: false as const };
  }

  if (areListingReservationsPaused()) {
    return {
      error: "Reservations are temporarily unavailable.",
      ok: false as const,
    };
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { error: "Sign in before reserving a listing.", ok: false as const };
  }

  const [buyer] = await db
    .select({
      email: users.email,
      id: users.id,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!buyer) {
    return { error: "Could not find your account.", ok: false as const };
  }

  const [listing] = await db
    .select({
      details: propertyListings.details,
      id: propertyListings.id,
      listingType: propertyListings.listingType,
      location: propertyListings.location,
      propertyType: propertyListings.propertyType,
      reservationAmountCents: propertyListings.reservationAmountCents,
      reservationEnabled: propertyListings.reservationEnabled,
      status: propertyListings.status,
      title: propertyListings.title,
      userId: propertyListings.userId,
    })
    .from(propertyListings)
    .where(eq(propertyListings.id, parsed.data))
    .limit(1);

  if (!listing || listing.status !== "published") {
    return { error: "This listing is not available for reservation.", ok: false as const };
  }

  if (listing.userId === buyer.id) {
    return { error: "You cannot reserve your own listing.", ok: false as const };
  }

  if (
    !listing.reservationEnabled ||
    listing.listingType === "rental" ||
    !listing.reservationAmountCents
  ) {
    return {
      error: "This listing is not accepting reservations.",
      ok: false as const,
    };
  }

  const [activeReservation] = await db
    .select({ id: listingReservations.id })
    .from(listingReservations)
    .where(
      and(
        eq(listingReservations.listingId, listing.id),
        inArray(listingReservations.status, [
          "awaiting_documents",
          "documents_received",
          "approved_for_release",
          "released",
          "paid",
        ]),
      ),
    )
    .limit(1);

  if (activeReservation) {
    return { error: "This listing has already been reserved.", ok: false as const };
  }

  const settings = await getStoredReservationSettings();

  if (!settings.enabled) {
    return { error: "Reservations are currently unavailable.", ok: false as const };
  }

  if (
    listing.reservationAmountCents < settings.minReservationAmountCents ||
    listing.reservationAmountCents > settings.maxReservationAmountCents
  ) {
    return {
      error: "This listing's reservation amount is outside current platform limits.",
      ok: false as const,
    };
  }

  const fees = calculateReservationFees({
    amountCents: listing.reservationAmountCents,
    settings,
  });

  try {
    const stripe = await getStripe();
    const publishableKey = await getStripePublishableKey();

    if (!publishableKey) {
      return { error: "Stripe publishable key is not configured.", ok: false as const };
    }

    const [reservation] = await db
      .insert(listingReservations)
      .values({
        agentUserId: listing.userId,
        amountCents: listing.reservationAmountCents,
        buyerUserId: buyer.id,
        currency: "ZAR",
        listingId: listing.id,
        platformFeeCents: fees.platformFeeCents,
        processingFeeCents: fees.processingFeeCents,
        status: "pending",
        totalPaidCents: fees.totalPaidCents,
      })
      .returning({ id: listingReservations.id });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: fees.totalPaidCents,
      automatic_payment_methods: {
        enabled: true,
      },
      currency: "zar",
      description: `Homzie reservation for ${listing.title}`,
      metadata: {
        buyerUserId: buyer.id,
        listingId: listing.id,
        reservationId: reservation.id,
        type: "listing_reservation",
      },
      receipt_email: buyer.email,
    });

    await db
      .update(listingReservations)
      .set({
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      })
      .where(eq(listingReservations.id, reservation.id));

    await trackListingAction({
      actionType: "reserve_now",
      listingId: listing.id,
      source: "listing_detail",
      viewerSessionId: `reservation-${reservation.id}`,
    });

    return {
      clientSecret: paymentIntent.client_secret || "",
      ok: true as const,
      publishableKey,
      reservationId: reservation.id,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not start reservation checkout.",
      ok: false as const,
    };
  }
}

export async function confirmListingReservationPayment(paymentIntentId: string) {
  const parsed = z.string().trim().min(4).safeParse(paymentIntentId);
  const session = await getServerSession(authOptions);

  if (!parsed.success) {
    return { error: "Payment confirmation is invalid.", ok: false as const };
  }

  if (!session?.user?.id) {
    return { error: "Sign in before confirming a reservation.", ok: false as const };
  }

  try {
    const stripe = await getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(parsed.data);

    if (paymentIntent.metadata?.type !== "listing_reservation") {
      return { error: "Payment is not linked to a listing reservation.", ok: false as const };
    }

    if (paymentIntent.status !== "succeeded") {
      return { error: "Payment has not succeeded yet.", ok: false as const };
    }

    const reservationId = paymentIntent.metadata.reservationId;
    const listingId = paymentIntent.metadata.listingId;

    if (!reservationId || !listingId) {
      return { error: "Reservation metadata is incomplete.", ok: false as const };
    }

    const [reservation] = await db
      .select({
        buyerUserId: listingReservations.buyerUserId,
      })
      .from(listingReservations)
      .where(eq(listingReservations.id, reservationId))
      .limit(1);

    if (!reservation || reservation.buyerUserId !== session.user.id) {
      return { error: "Reservation does not belong to your account.", ok: false as const };
    }

    const latestCharge =
      typeof paymentIntent.latest_charge === "string"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id || null;

    await completeListingReservationPayment({
      chargeId: latestCharge,
      listingId,
      paymentIntentId: paymentIntent.id,
      reservationId,
    });

    revalidatePath(`/listings/${listingId}`);

    return { ok: true as const };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not confirm reservation payment.",
      ok: false as const,
    };
  }
}

export async function reopenReservedListing(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const listingId = z.string().uuid().safeParse(formData.get("listingId"));

  if (!listingId.success) {
    throw new Error("Listing ID is invalid.");
  }

  const [listing] = await db
    .select({
      activeReservationId: propertyListings.activeReservationId,
      status: propertyListings.status,
      userId: propertyListings.userId,
    })
    .from(propertyListings)
    .where(
      and(
        eq(propertyListings.id, listingId.data),
        eq(propertyListings.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!listing) {
    throw new Error("Listing not found.");
  }

  if (listing.status !== "reserved") {
    throw new Error("Only reserved listings can be reopened.");
  }

  const now = new Date();

  if (listing.activeReservationId) {
    await db
      .update(listingReservations)
      .set({
        cancelledAt: now,
        cancelledReason: "Deal fell through; listing reopened by agent.",
        status: "cancelled",
        updatedAt: now,
      })
      .where(eq(listingReservations.id, listing.activeReservationId));
  }

  await db
    .update(propertyListings)
    .set({
      activeReservationId: null,
      status: "published",
      updatedAt: now,
    })
    .where(eq(propertyListings.id, listingId.data));

  await db.insert(propertyListingStatusHistory).values({
    fromStatus: "reserved",
    listingId: listingId.data,
    reason: "Reservation cancelled by agent. Listing is accepting reservations again.",
    toStatus: "published",
    userId: session.user.id,
  });

  revalidatePath(`/listings/${listingId.data}`);
  redirect(`/listings/${listingId.data}/edit?listingUpdated=updated`);
}

export async function toggleListingSave(listingId: string) {
  const parsed = listingIdSchema.safeParse(listingId);
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!parsed.success || !userId) {
    return { error: "Sign in to save listings.", ok: false as const };
  }

  const [existing] = await db
    .select({ listingId: listingSaves.listingId })
    .from(listingSaves)
    .where(
      and(eq(listingSaves.listingId, parsed.data), eq(listingSaves.userId, userId)),
    )
    .limit(1);

  const [listing] = await db
    .select({
      id: propertyListings.id,
      status: propertyListings.status,
      title: propertyListings.title,
      userId: propertyListings.userId,
    })
    .from(propertyListings)
    .where(eq(propertyListings.id, parsed.data))
    .limit(1);

  if (
    !listing ||
    (!existing && listing.status !== "published" && listing.userId !== userId)
  ) {
    return { error: "This listing is not available to save.", ok: false as const };
  }

  if (existing) {
    await db
      .delete(listingSaves)
      .where(
        and(eq(listingSaves.listingId, parsed.data), eq(listingSaves.userId, userId)),
      );
  } else {
    await db.insert(listingSaves).values({ listingId: parsed.data, userId });

    await createUserEvent({
      actorUserId: userId,
      entityId: listing.id,
      entityType: "listing",
      eventType: "listing.saved",
      listingId: listing.id,
      metadata: { listingTitle: listing.title },
      userId: listing.userId,
    });
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listingSaves)
    .where(eq(listingSaves.listingId, parsed.data));

  revalidatePath(`/listings/${parsed.data}`);

  return {
    count,
    countLabel: formatCompactCount(count),
    ok: true as const,
    saved: !existing,
  };
}

export async function toggleListingLike(listingId: string) {
  const parsed = listingIdSchema.safeParse(listingId);
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!parsed.success || !userId) {
    return { error: "Sign in to like listings.", ok: false as const };
  }

  const [listing] = await db
    .select({
      id: propertyListings.id,
      status: propertyListings.status,
      title: propertyListings.title,
      userId: propertyListings.userId,
    })
    .from(propertyListings)
    .where(eq(propertyListings.id, parsed.data))
    .limit(1);

  if (!listing || (listing.status !== "published" && listing.userId !== userId)) {
    return { error: "This listing is not available to like.", ok: false as const };
  }

  const [existing] = await db
    .select({ listingId: listingLikes.listingId })
    .from(listingLikes)
    .where(
      and(eq(listingLikes.listingId, parsed.data), eq(listingLikes.userId, userId)),
    )
    .limit(1);

  if (existing) {
    await db
      .delete(listingLikes)
      .where(
        and(eq(listingLikes.listingId, parsed.data), eq(listingLikes.userId, userId)),
      );
  } else {
    await db.insert(listingLikes).values({ listingId: parsed.data, userId });

    await createUserEvent({
      actorUserId: userId,
      entityId: listing.id,
      entityType: "listing",
      eventType: "listing.liked",
      listingId: listing.id,
      metadata: { listingTitle: listing.title },
      userId: listing.userId,
    });
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listingLikes)
    .where(eq(listingLikes.listingId, parsed.data));

  revalidatePath(`/listings/${parsed.data}`);

  return {
    count,
    countLabel: formatCompactCount(count),
    liked: !existing,
    ok: true as const,
  };
}

const offerStatsSchema = z.object({
  currency: z.string().trim().min(3).max(3),
  listingId: listingIdSchema,
});

export async function getListingOfferStatsAction(
  input: z.input<typeof offerStatsSchema>,
) {
  const parsed = offerStatsSchema.parse(input);
  const currency = parsed.currency.toUpperCase();
  const [stats] = await db
    .select({
      averageAmountCents: sql<number | null>`round(avg(${propertyOffers.amountCents}))::int`,
      count: sql<number>`count(*)::int`,
      maxAmountCents: sql<number | null>`max(${propertyOffers.amountCents})`,
      minAmountCents: sql<number | null>`min(${propertyOffers.amountCents})`,
    })
    .from(propertyOffers)
    .where(
      and(
        eq(propertyOffers.listingId, parsed.listingId),
        eq(propertyOffers.currency, currency),
        eq(propertyOffers.status, "pending"),
      ),
    );

  return {
    averageAmountCents: stats?.averageAmountCents ?? null,
    count: stats?.count ?? 0,
    currency,
    maxAmountCents: stats?.maxAmountCents ?? null,
    minAmountCents: stats?.minAmountCents ?? null,
  };
}

async function getTrackableListing(listingId: string, viewerUserId?: string | null) {
  const [listing] = await db
    .select({
      id: propertyListings.id,
      status: propertyListings.status,
      title: propertyListings.title,
      userId: propertyListings.userId,
    })
    .from(propertyListings)
    .where(eq(propertyListings.id, listingId))
    .limit(1);

  if (
    !listing ||
    (listing.status !== "published" && (!viewerUserId || listing.userId !== viewerUserId))
  ) {
    return null;
  }

  return listing;
}

export async function trackListingView(input: unknown) {
  const parsed = listingViewEventSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false as const };
  }

  const session = await getServerSession(authOptions);
  const viewerUserId = session?.user?.id || null;

  const listing = await getTrackableListing(parsed.data.listingId, viewerUserId);

  if (!listing) {
    return { ok: false as const };
  }

  if (viewerUserId && listing.userId === viewerUserId) {
    return { ok: true as const, skippedOwner: true as const };
  }

  if (parsed.data.viewInstanceId) {
    const [recordedInstance] = await db
      .select({ id: listingViewEvents.id })
      .from(listingViewEvents)
      .where(
        and(
          eq(listingViewEvents.listingId, parsed.data.listingId),
          eq(listingViewEvents.viewInstanceId, parsed.data.viewInstanceId),
        ),
      )
      .limit(1);

    if (recordedInstance) {
      return { ok: true as const, deduped: true as const };
    }
  }

  await db.insert(listingViewEvents).values({
    listingId: parsed.data.listingId,
    source: parsed.data.source || "listing_detail",
    viewInstanceId: parsed.data.viewInstanceId,
    viewerSessionId: parsed.data.viewerSessionId,
    viewerUserId,
  });

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listingViewEvents)
    .where(eq(listingViewEvents.listingId, parsed.data.listingId));
  const milestone = viewMilestoneForCount(count);

  if (milestone && listing.userId !== viewerUserId) {
    await createUserEventOnce({
      dedupeKey: `listing:${listing.id}:views:${milestone}`,
      entityId: listing.id,
      entityType: "listing",
      eventType: "listing.views.milestone",
      listingId: listing.id,
      metadata: { count: milestone, listingTitle: listing.title },
      userId: listing.userId,
    });
  }

  return { ok: true as const };
}

export async function trackListingPresence(input: unknown) {
  try {
    const parsed = listingViewEventSchema.safeParse(input);

    if (!parsed.success) {
      return { ok: false as const };
    }

    const session = await getServerSession(authOptions);
    const viewerUserId = session?.user?.id || null;
    const listing = await getTrackableListing(parsed.data.listingId, viewerUserId);

    if (!listing) {
      return { ok: false as const };
    }

    if (viewerUserId && listing.userId === viewerUserId) {
      return { ok: true as const, skippedOwner: true as const };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + listingPresenceWindowSeconds * 1000);

    await db
      .insert(listingPresenceSessions)
      .values({
        expiresAt,
        lastSeenAt: now,
        listingId: parsed.data.listingId,
        source: parsed.data.source || "listing_detail",
        updatedAt: now,
        viewerSessionId: parsed.data.viewerSessionId,
        viewerUserId,
      })
      .onConflictDoUpdate({
        target: [
          listingPresenceSessions.listingId,
          listingPresenceSessions.viewerSessionId,
        ],
        set: {
          expiresAt,
          lastSeenAt: now,
          source: parsed.data.source || "listing_detail",
          updatedAt: now,
          viewerUserId,
        },
      });

    if (viewerUserId && listing.userId !== viewerUserId) {
      const [{ count: buyerViewCount }] = await db
        .select({
          count: sql<number>`count(distinct coalesce(${listingViewEvents.viewInstanceId}, ${listingViewEvents.viewerSessionId}))::int`,
        })
        .from(listingViewEvents)
        .where(
          and(
            eq(listingViewEvents.listingId, listing.id),
            eq(listingViewEvents.viewerUserId, viewerUserId),
            eq(listingViewEvents.source, "listing_detail"),
          ),
        );

      if ([3, 5, 10].includes(buyerViewCount)) {
        await createUserEventOnce({
          actorUserId: viewerUserId,
          dedupeKey: `listing:${listing.id}:buyer:${viewerUserId}:repeat-views:${buyerViewCount}`,
          entityId: listing.id,
          entityType: "listing",
          eventType: "listing.buyer_intent.repeat_view",
          listingId: listing.id,
          metadata: {
            listingTitle: listing.title,
            viewCount: buyerViewCount,
          },
          userId: listing.userId,
        });
      }
    }

    const [{ activeViewerCount }] = await db
      .select({
        activeViewerCount: sql<number>`count(distinct ${listingPresenceSessions.viewerSessionId})::int`,
      })
      .from(listingPresenceSessions)
      .where(
        and(
          eq(listingPresenceSessions.listingId, listing.id),
          sql`${listingPresenceSessions.expiresAt} > now()`,
          sql`(${listingPresenceSessions.viewerUserId} IS NULL OR ${listingPresenceSessions.viewerUserId} <> ${listing.userId})`,
        ),
      );

    if (activeViewerCount >= 3) {
      await createUserEventOnce({
        dedupeKey: `listing:${listing.id}:active-viewers:${activeViewerCount}`,
        entityId: listing.id,
        entityType: "listing",
        eventType: "listing.buyer_intent.active_viewers",
        listingId: listing.id,
        metadata: {
          activeViewerCount,
          listingTitle: listing.title,
        },
        userId: listing.userId,
      });
    }

    return { ok: true as const, activeViewerCount };
  } catch (error) {
    console.error("[listing-intent] presence heartbeat failed", error);
    return { ok: false as const };
  }
}

export async function getListingLiveIntentAction(input: unknown) {
  try {
    const parsed = listingLiveIntentSchema.safeParse(input);

    if (!parsed.success) {
      return { ok: false as const, activeBuyerCount: 0, activeViewerCount: 0, buyers: [] };
    }

    const session = await getServerSession(authOptions);
    const ownerUserId = session?.user?.id;

    if (!ownerUserId) {
      return { ok: false as const, activeBuyerCount: 0, activeViewerCount: 0, buyers: [] };
    }

    const [listing] = await db
      .select({
        id: propertyListings.id,
        userId: propertyListings.userId,
      })
      .from(propertyListings)
      .where(eq(propertyListings.id, parsed.data.listingId))
      .limit(1);

    if (!listing || listing.userId !== ownerUserId) {
      return { ok: false as const, activeBuyerCount: 0, activeViewerCount: 0, buyers: [] };
    }

    const [activeViewerRow] = await rawSql<{ active_viewer_count: number }[]>`
      SELECT count(DISTINCT viewer_session_id)::int AS active_viewer_count
      FROM listing_presence_sessions
      WHERE listing_id = ${parsed.data.listingId}
        AND expires_at > now()
        AND (viewer_user_id IS NULL OR viewer_user_id <> ${ownerUserId})
    `;
    const [viewStatsRow] = await rawSql<{
      previous_views: number;
      total_views: number;
    }[]>`
      SELECT
        count(DISTINCT coalesce(view_instance_id, viewer_session_id)) FILTER (
          WHERE source = 'listing_detail'
            AND created_at >= now() - interval '24 hours'
        )::int AS total_views,
        count(DISTINCT coalesce(view_instance_id, viewer_session_id)) FILTER (
          WHERE source = 'listing_detail'
            AND created_at >= now() - interval '48 hours'
            AND created_at < now() - interval '24 hours'
        )::int AS previous_views
      FROM listing_view_events
      WHERE listing_id = ${parsed.data.listingId}
        AND (viewer_user_id IS NULL OR viewer_user_id <> ${ownerUserId})
    `;
    const [durationRow] = await rawSql<{ average_seconds: number | null }[]>`
      SELECT avg(greatest(0, extract(epoch from (last_seen_at - started_at))))::int AS average_seconds
      FROM listing_presence_sessions
      WHERE listing_id = ${parsed.data.listingId}
        AND expires_at > now()
        AND (viewer_user_id IS NULL OR viewer_user_id <> ${ownerUserId})
    `;

    const buyerRows = await rawSql<{
      avatar_url: string | null;
      buyer_id: string;
      duration_seconds: number;
      last_seen_at: Date;
      name: string;
      username: string | null;
      view_count: number;
    }[]>`
      SELECT
        u.id AS buyer_id,
        u.name,
        u.username,
        u.avatar_url,
        max(lps.last_seen_at) AS last_seen_at,
        max(greatest(0, extract(epoch from (lps.last_seen_at - lps.started_at))))::int AS duration_seconds,
        count(DISTINCT coalesce(lve.view_instance_id, lve.viewer_session_id))::int AS view_count
      FROM listing_presence_sessions lps
      JOIN users u ON u.id = lps.viewer_user_id
      LEFT JOIN listing_view_events lve
        ON lve.listing_id = lps.listing_id
        AND lve.viewer_user_id = lps.viewer_user_id
        AND lve.source = 'listing_detail'
      WHERE lps.listing_id = ${parsed.data.listingId}
        AND lps.expires_at > now()
        AND lps.viewer_user_id IS NOT NULL
        AND lps.viewer_user_id <> ${ownerUserId}
        AND u.role = 'user'
        AND u.status = 'active'
        AND u.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM agent_profiles ap
          WHERE ap.user_id = u.id
            AND ap.status = 'active'
        )
      GROUP BY u.id, u.name, u.username, u.avatar_url
      ORDER BY max(lps.last_seen_at) DESC
      LIMIT 12
    `;
    const recentActivityRows = await rawSql<{
      action_type: string | null;
      activity_type: "action" | "view";
      avatar_url: string | null;
      buyer_id: string;
      created_at: Date;
      name: string;
      username: string | null;
      view_count: number;
    }[]>`
      WITH buyer_counts AS (
        SELECT
          viewer_user_id,
          count(DISTINCT coalesce(view_instance_id, viewer_session_id))::int AS view_count
        FROM listing_view_events
        WHERE listing_id = ${parsed.data.listingId}
          AND source = 'listing_detail'
          AND viewer_user_id IS NOT NULL
          AND viewer_user_id <> ${ownerUserId}
        GROUP BY viewer_user_id
      ),
      activity_rows AS (
        SELECT
          'view'::text AS activity_type,
          NULL::text AS action_type,
          created_at,
          viewer_user_id
        FROM listing_view_events
        WHERE listing_id = ${parsed.data.listingId}
          AND source = 'listing_detail'
          AND viewer_user_id IS NOT NULL
          AND viewer_user_id <> ${ownerUserId}
        UNION ALL
        SELECT
          'action'::text AS activity_type,
          action_type,
          created_at,
          viewer_user_id
        FROM listing_action_events
        WHERE listing_id = ${parsed.data.listingId}
          AND viewer_user_id IS NOT NULL
          AND viewer_user_id <> ${ownerUserId}
      )
      SELECT
        ar.activity_type,
        ar.action_type,
        ar.created_at,
        u.id AS buyer_id,
        u.name,
        u.username,
        u.avatar_url,
        coalesce(bc.view_count, 1)::int AS view_count
      FROM activity_rows ar
      JOIN users u ON u.id = ar.viewer_user_id
      LEFT JOIN buyer_counts bc ON bc.viewer_user_id = ar.viewer_user_id
      WHERE u.role = 'user'
        AND u.status = 'active'
        AND u.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM agent_profiles ap
          WHERE ap.user_id = u.id
            AND ap.status = 'active'
        )
      ORDER BY ar.created_at DESC
      LIMIT 8
    `;

    return {
      ok: true as const,
      activeBuyerCount: buyerRows.length,
      activeViewerCount: activeViewerRow?.active_viewer_count || 0,
      averageSeconds: durationRow?.average_seconds || 0,
      previousViews24h: viewStatsRow?.previous_views || 0,
      recentActivities: recentActivityRows.map((activity) => ({
        actionType: activity.action_type,
        activityType: activity.activity_type,
        buyer: {
          avatarUrl: toPublicMediaUrl(activity.avatar_url),
          id: activity.buyer_id,
          lastSeenAt: new Date(activity.created_at).toISOString(),
          name: activity.name,
          profileHref: activity.username ? `/users/${activity.username}` : null,
          username: activity.username,
          viewCount: activity.view_count,
        },
        createdAt: new Date(activity.created_at).toISOString(),
      })),
      returningViewerCount: buyerRows.filter((buyer) => buyer.view_count > 1).length,
      totalViews24h: viewStatsRow?.total_views || 0,
      buyers: buyerRows.map((buyer) => ({
        avatarUrl: toPublicMediaUrl(buyer.avatar_url),
        durationSeconds: buyer.duration_seconds,
        id: buyer.buyer_id,
        lastSeenAt: new Date(buyer.last_seen_at).toISOString(),
        name: buyer.name,
        profileHref: buyer.username ? `/users/${buyer.username}` : null,
        username: buyer.username,
        viewCount: buyer.view_count,
      })),
    };
  } catch (error) {
    console.error("[listing-intent] live intent load failed", error);
    return { ok: false as const, activeBuyerCount: 0, activeViewerCount: 0, buyers: [] };
  }
}

export async function trackListingAction(input: unknown) {
  const parsed = listingActionEventSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false as const };
  }

  const session = await getServerSession(authOptions);
  const viewerUserId = session?.user?.id || null;

  const listing = await getTrackableListing(parsed.data.listingId, viewerUserId);

  if (!listing) {
    return { ok: false as const };
  }

  if (viewerUserId && listing.userId === viewerUserId) {
    return { ok: true as const, skippedOwner: true as const };
  }

  await db.insert(listingActionEvents).values({
    actionType: parsed.data.actionType,
    listingId: parsed.data.listingId,
    source: parsed.data.source || "listing_detail",
    viewerSessionId: parsed.data.viewerSessionId,
    viewerUserId,
  });

  if (
    viewerUserId &&
    listing.userId !== viewerUserId &&
    ["call_agent", "contact_agent", "email_agent", "whatsapp_agent"].includes(
      parsed.data.actionType,
    )
  ) {
    await createUserEvent({
      actorUserId: viewerUserId,
      entityId: listing.id,
      entityType: "listing",
      eventType: "listing.contacted",
      listingId: listing.id,
      metadata: {
        actionType: parsed.data.actionType,
        listingTitle: listing.title,
        source: parsed.data.source || "listing_detail",
      },
      userId: listing.userId,
    });
  }

  return { ok: true as const };
}

export async function improveListingTitle(input: {
  description?: string;
  listingType: string;
  location?: string;
  propertyType: string;
  title: string;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { error: "Sign in before using AI title polish." };
  }

  const parsed = titleImprovementSchema.safeParse(input);

  if (!parsed.success) {
    return {
      error: `Add a title between 4 and ${maxListingTitleLength} characters first.`,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { error: "OpenAI is not configured yet." };
  }

  const cooldown = await checkAiActionCooldown(session.user.id, "listing-title");

  if (!cooldown.allowed) {
    return { error: cooldown.message };
  }

  const data = parsed.data;
  const currentDescription = plainListingDescription(
    sanitizeListingDescription(data.description || ""),
  );
  const propertyTypeLabel =
    propertyTypeOptions.find((option) => option.value === data.propertyType)
      ?.label || data.propertyType;
  const listingTypeLabel =
    listingTypeOptions.find((option) => option.value === data.listingType)
      ?.label || data.listingType;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            content: [
              {
                text: [
                  "Rewrite this property listing title into one polished, premium, buyer-friendly title.",
                  `Keep it under ${maxListingTitleLength} characters.`,
                  "Do not use emojis, hashtags, quotes, clickbait, or a trailing full stop.",
                  "Return only the improved title.",
                  "",
                  `Current title: ${data.title}`,
                  `Listing type: ${listingTypeLabel}`,
                  `Property type: ${propertyTypeLabel}`,
                  `Location: ${data.location || "Not provided"}`,
                  `Description: ${currentDescription || "Not provided"}`,
                ].join("\n"),
                type: "input_text",
              },
            ],
            role: "user",
          },
        ],
        max_output_tokens: 80,
        model: process.env.OPENAI_TITLE_MODEL || defaultTitleImprovementModel,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[listings] title improvement failed", {
        error: errorText.slice(0, 500),
        model: process.env.OPENAI_TITLE_MODEL || defaultTitleImprovementModel,
        status: response.status,
      });

      return { error: "Could not improve the title right now." };
    }

    const result = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{ text?: string; type?: string }>;
      }>;
    };
    const rawTitle =
      result.output_text ||
      result.output
        ?.flatMap((item) => item.content || [])
        .map((content) => content.text || "")
        .join(" ");
    const title = cleanListingTitle(rawTitle || "");

    if (!title) {
      return { error: "OpenAI did not return a usable title." };
    }

    return { title };
  } catch (error) {
    console.error("[listings] title improvement error", error);

    return { error: "Could not improve the title right now." };
  }
}

export async function improveListingDescription(input: {
  bathrooms?: string;
  bedrooms?: string;
  description?: string;
  erfSize?: string;
  features?: string[];
  floorSize?: string;
  listingType: string;
  location?: string;
  propertyType: string;
  title: string;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { error: "Sign in before using AI description polish." };
  }

  const parsed = descriptionImprovementSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Add a listing title before improving the description." };
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { error: "OpenAI is not configured yet." };
  }

  const cooldown = await checkAiActionCooldown(
    session.user.id,
    "listing-description",
  );

  if (!cooldown.allowed) {
    return { error: cooldown.message };
  }

  const data = parsed.data;
  const currentDescription = plainListingDescription(
    sanitizeListingDescription(data.description || ""),
  );
  const propertyTypeLabel =
    propertyTypeOptions.find((option) => option.value === data.propertyType)
      ?.label || data.propertyType;
  const listingTypeLabel =
    listingTypeOptions.find((option) => option.value === data.listingType)
      ?.label || data.listingType;
  const selectedFeatures = (data.features || []).join(", ");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            content: [
              {
                text: [
                  "Write a polished, premium property listing description.",
                  `Keep it under ${maxListingDescriptionLength} characters.`,
                  "Use warm, confident real-estate copy that is easy to scan.",
                  "Do not invent facts, numbers, suburbs, views, amenities, or sale claims that are not provided.",
                  "Do not use emojis, hashtags, markdown, headings, or bullet points.",
                  "Return only the improved description.",
                  "",
                  `Title: ${data.title}`,
                  `Current description: ${currentDescription || "Not provided"}`,
                  `Listing type: ${listingTypeLabel}`,
                  `Property type: ${propertyTypeLabel}`,
                  `Location: ${data.location || "Not provided"}`,
                  `Bedrooms: ${data.bedrooms || "Not provided"}`,
                  `Bathrooms: ${data.bathrooms || "Not provided"}`,
                  `Floor size: ${data.floorSize || "Not provided"}`,
                  `Erf size: ${data.erfSize || "Not provided"}`,
                  `Features: ${selectedFeatures || "Not provided"}`,
                ].join("\n"),
                type: "input_text",
              },
            ],
            role: "user",
          },
        ],
        max_output_tokens: 520,
        model: process.env.OPENAI_DESCRIPTION_MODEL || defaultTitleImprovementModel,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[listings] description improvement failed", {
        error: errorText.slice(0, 500),
        model: process.env.OPENAI_DESCRIPTION_MODEL || defaultTitleImprovementModel,
        status: response.status,
      });

      return { error: "Could not improve the description right now." };
    }

    const result = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{ text?: string; type?: string }>;
      }>;
    };
    const rawDescription =
      result.output_text ||
      result.output
        ?.flatMap((item) => item.content || [])
        .map((content) => content.text || "")
        .join(" ");
    const description = cleanListingDescription(rawDescription || "");

    if (!description) {
      return { error: "OpenAI did not return a usable description." };
    }

    return { description };
  } catch (error) {
    console.error("[listings] description improvement error", error);

    return { error: "Could not improve the description right now." };
  }
}

function numberOrUndefined(value: FormDataEntryValue | null) {
  const stringValue = String(value || "").trim();

  return stringValue ? stringValue : undefined;
}

function decimalOrUndefined(value: FormDataEntryValue | null, decimalPlaces = 2) {
  const stringValue = String(value || "").trim();

  if (!stringValue) return undefined;

  const [, decimals = ""] = stringValue.split(".");

  if (decimals.length > decimalPlaces) {
    throw new Error(`Use no more than ${decimalPlaces} decimal places.`);
  }

  return stringValue;
}

async function checkAiActionCooldown(userId: string, action: string) {
  const key = `homzie:ai-cooldown:${action}:${userId}`;

  try {
    const client = await getAiCooldownClient();
    const existing = await client.get(key);

    if (existing) {
      const ttl = await client.ttl(key);
      const seconds = ttl > 0 ? ttl : aiActionCooldownSeconds;

      return {
        allowed: false,
        message: `AI cooldown active. Try again in ${formatCooldown(seconds)}.`,
      };
    }

    await client.set(key, "1", { EX: aiActionCooldownSeconds });

    return { allowed: true };
  } catch (error) {
    console.error("[listings] AI cooldown Redis fallback", error);

    return checkLocalAiActionCooldown(key);
  }
}

async function getAiCooldownClient() {
  if (!aiCooldownClientPromise) {
    aiCooldownClientPromise = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6380",
    })
      .on("error", (error) => {
        console.error("[listings] AI cooldown Redis error", error);
      })
      .connect() as Promise<RedisClientType>;
  }

  return aiCooldownClientPromise;
}

function checkLocalAiActionCooldown(key: string) {
  const now = Date.now();
  const expiresAt = localAiCooldowns.get(key) || 0;

  if (expiresAt > now) {
    const seconds = Math.ceil((expiresAt - now) / 1000);

    return {
      allowed: false,
      message: `AI cooldown active. Try again in ${formatCooldown(seconds)}.`,
    };
  }

  localAiCooldowns.set(key, now + aiActionCooldownSeconds * 1000);

  for (const [cooldownKey, cooldownExpiresAt] of localAiCooldowns.entries()) {
    if (cooldownExpiresAt <= now) {
      localAiCooldowns.delete(cooldownKey);
    }
  }

  return { allowed: true };
}

function formatCooldown(seconds: number) {
  if (seconds <= 1) return "1 second";

  return `${seconds} seconds`;
}

function parseDate(value: string | undefined) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function buildPriceLabel({
  amount,
  listingType,
  qualifier,
}: {
  amount?: number;
  listingType: string;
  qualifier?: string;
}) {
  if (typeof amount !== "number" || amount <= 0) {
    return qualifier || null;
  }

  const formatted = new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);

  if (listingType === "rental") {
    return `${formatted}/month`;
  }

  if (qualifier) {
    return `${qualifier} ${formatted}`;
  }

  return formatted;
}

function cleanListingTitle(value: string) {
  return value
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.。]+$/g, "")
    .slice(0, maxListingTitleLength)
    .trim();
}

function cleanListingDescription(value: string) {
  return value
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxListingDescriptionLength)
    .trim();
}

function normalizeListingFeature(value: string) {
  return value
    .replace(/^#+/, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxListingFeatureLength);
}

function sanitizeListingDescription(value: string) {
  const withoutDangerousBlocks = value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  return withoutDangerousBlocks
    .replace(/<\/?([a-z][a-z0-9-]*)(?:\s[^>]*)?>/gi, (match, tagName) => {
      const isClosing = match.startsWith("</");
      const normalizedTag = normalizeDescriptionTag(tagName);

      return normalizedTag ? `<${isClosing ? "/" : ""}${normalizedTag}>` : "";
    })
    .replace(/<(strong|em|p|ul|ol|li)>\s*<\/\1>/gi, "")
    .replace(/\s+/g, " ")
    .replace(/ ?<(\/?(?:strong|em|p|ul|ol|li|br))> ?/gi, "<$1>")
    .trim();
}

function normalizeDescriptionTag(tagName: string) {
  const tag = tagName.toLowerCase();

  if (tag === "b") return "strong";
  if (tag === "i") return "em";
  if (["br", "em", "li", "ol", "p", "strong", "ul"].includes(tag)) return tag;

  return "";
}

function plainListingDescription(value: string) {
  return value
    .replace(/<\/?(p|br|li|ul|ol)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function notifyFollowersAboutPublishedListing({
  listingId,
  ownerUserId,
}: {
  listingId: string;
  ownerUserId: string;
}) {
  const [listing] = await rawSql<{
    details: Record<string, unknown> | null;
    id: string;
    listing_type: string;
    location: string | null;
    price_label: string | null;
    property_type: string;
    title: string;
    user_name: string;
    username: string | null;
  }[]>`
    SELECT
      pl.id,
      pl.title,
      pl.location,
      pl.price_label,
      pl.listing_type,
      pl.property_type,
      pl.details,
      u.name AS user_name,
      u.username
    FROM property_listings pl
    JOIN users u ON u.id = pl.user_id
    WHERE pl.id = ${listingId}
      AND pl.user_id = ${ownerUserId}
      AND pl.status = 'published'
    LIMIT 1
  `;

  if (!listing) return;

  const listingUrl = absoluteAppUrl(
    buildListingPath({
      bedrooms: listing.details?.bedrooms as number | string | null,
      city: typeof listing.details?.city === "string" ? listing.details.city : "",
      country:
        typeof listing.details?.country === "string" ? listing.details.country : "",
      id: listing.id,
      listingType: listing.listing_type,
      location: listing.location,
      propertyType: listing.property_type,
      province:
        (typeof listing.details?.province === "string"
          ? listing.details.province
          : "") ||
        (typeof listing.details?.state === "string" ? listing.details.state : "") ||
        (typeof listing.details?.region === "string" ? listing.details.region : ""),
      suburb: typeof listing.details?.suburb === "string" ? listing.details.suburb : "",
      title: listing.title,
    }),
  );

  const followers = await rawSql<{
    follower_id: string;
    name: string;
  }[]>`
    SELECT u.id AS follower_id, u.name
    FROM user_follows uf
    JOIN users u ON u.id = uf.follower_id
    WHERE uf.following_id = ${ownerUserId}
      AND u.status = 'active'
      AND u.deleted_at IS NULL
  `;

  await Promise.allSettled(
    followers.map((follower) =>
      sendTemplatedEmailToUser({
        eventKey: "listing.new_from_followed_profile",
        preferenceCategory: "listingActivity",
        templateKey: "listing.new_from_followed_profile",
        userId: follower.follower_id,
        variables: {
          agent: {
            name: listing.user_name,
            username: listing.username || "",
          },
          app: {
            name: "Homzie",
            url: absoluteAppUrl("/"),
          },
          listing: {
            location: listing.location || "Location not set",
            priceLabel: listing.price_label || "Price on request",
            title: listing.title,
            url: listingUrl,
          },
          user: {
            firstName: follower.name.split(/\s+/)[0] || follower.name,
            name: follower.name,
          },
        },
      }),
    ),
  );
}

function parseExistingListingMedia(value: FormDataEntryValue | null) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(String(value)) as unknown;

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): StoredListingMedia | null => {
        if (!item || typeof item !== "object") return null;

        const mediaItem = item as Partial<StoredListingMedia>;
        const path = String(mediaItem.path || "");

        if (!isSafeMediaPath(path)) return null;

        return {
          name: String(mediaItem.name || path.split("/").pop() || "Listing image"),
          path,
          size: Number(mediaItem.size || 0),
          sourceUrl:
            typeof mediaItem.sourceUrl === "string"
              ? mediaItem.sourceUrl.slice(0, 2_000)
              : undefined,
          type: String(mediaItem.type || "image/webp"),
        };
      })
      .filter((item): item is StoredListingMedia => Boolean(item))
      .slice(0, maxListingMediaItems);
  } catch {
    return [];
  }
}

async function storeListingMedia(values: FormDataEntryValue[]) {
  const files = values
    .filter((value): value is File => value instanceof File && value.size > 0)
    .slice(0, maxListingMediaItems);

  const storedFiles: Array<{
    name: string;
    path: string;
    size: number;
    type: string;
  }> = [];

  for (const file of files) {
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (isImage && file.size > maxListingImageBytes) {
      throw new Error("Listing images must be 15MB or smaller after optimization.");
    }

    if (isVideo && file.size > maxListingVideoBytes) {
      throw new Error("Listing videos must be 80MB or smaller after optimization.");
    }

    const extension = isVideo ? listingVideoTypes[file.type] : listingImageTypes[file.type];

    if (!extension) {
      throw new Error("Upload JPG, PNG, WebP, MP4, MOV, or WebM listing media.");
    }

    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const fileName = `${randomUUID()}.${extension}`;
    const relativePath = ["listings", year, month, fileName].join("/");
    const storagePath = path.join(
      /*turbopackIgnore: true*/ getMediaStorageRoot(),
      relativePath,
    );
    const bytes = Buffer.from(await file.arrayBuffer());

    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, bytes);

    storedFiles.push({
      name: file.name,
      path: relativePath,
      size: file.size,
      type: file.type,
    });
  }

  return storedFiles;
}

export async function loadDiscoverListings({
  filters,
  limit = 8,
  offset = 0,
}: {
  filters?: DiscoverListingFilters;
  limit?: number;
  offset?: number;
}) {
  const session = await getServerSession(authOptions);

  return getDiscoverListings({
    filters,
    limit,
    offset,
    viewerUserId: session?.user?.id || null,
  });
}

export async function loadDiscoverListingCount(filters?: DiscoverListingFilters) {
  return getDiscoverListingCount(filters);
}
