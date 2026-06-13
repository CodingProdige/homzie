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
import { isSafeMediaPath } from "@/media/paths";
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
  propertyTypeOptions,
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
const maxListingPublishPayloadBytes = 90 * 1024 * 1024;
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

const listingTypeValues = listingTypeOptions.map((option) => option.value) as [
  string,
  ...string[],
];
const propertyTypeValues = propertyTypeOptions.map((option) => option.value) as [
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
const activeDuplicateListingStatuses = ["draft", "published", "reserved"];

type StoredListingMedia = {
  name: string;
  path: string;
  size: number;
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
  askingPrice: z.coerce.number().finite().min(0).max(10_000_000_000).optional(),
  availableFrom: z.string().trim().max(32).optional(),
  bathrooms: z.coerce.number().min(0).max(99).optional(),
  bedrooms: z.coerce.number().int().min(0).max(99).optional(),
  buyerIncentive: z.string().trim().max(40).optional(),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  description: z.string().trim().max(10_000).optional(),
  erfSize: z.coerce.number().min(0).max(10_000_000).optional(),
  features: z.array(z.string()).optional(),
  floorSize: z.coerce.number().min(0).max(10_000_000).optional(),
  furnishedStatus: z.enum(["", "yes", "no"]).optional(),
  garages: z.coerce.number().int().min(0).max(99).optional(),
  googlePlaceId: z.string().trim().max(180).optional(),
  googlePlaceData: z.string().trim().max(10_000).optional(),
  insuranceEstimate: z.coerce.number().finite().min(0).max(10_000_000_000).optional(),
  listingType: z.enum(listingTypeValues),
  location: z.string().trim().min(2).max(240),
  localTaxes: z.coerce.number().finite().min(0).max(10_000_000_000).optional(),
  mandateEndDate: z.string().trim().max(32).optional(),
  mandateStartDate: z.string().trim().max(32).optional(),
  mandateType: z.enum(mandateTypeValues),
  communityFees: z.coerce.number().finite().min(0).max(10_000_000_000).optional(),
  parking: z.coerce.number().int().min(0).max(99).optional(),
  petsAllowed: z.enum(["", "yes", "no"]).optional(),
  previousAskingPrice: z.coerce
    .number()
    .finite()
    .min(0)
    .max(10_000_000_000)
    .optional(),
  priceQualifier: z.string().trim().max(40).optional(),
  propertyType: z.enum(propertyTypeValues),
  province: z.string().trim().max(120).optional(),
  publishIntent: z.enum(["draft", "published"]),
  reservationAmount: z.coerce
    .number()
    .finite()
    .min(0)
    .max(10_000_000_000)
    .optional(),
  reservationEnabled: z.boolean().optional(),
  rentalYield: z.coerce.number().finite().min(0).max(100).optional(),
  shortLetAllowed: z.enum(["", "yes", "no"]).optional(),
  suburb: z.string().trim().max(120).optional(),
  title: z.string().trim().min(4).max(maxListingTitleLength),
  transferCostsEstimate: z.coerce
    .number()
    .finite()
    .min(0)
    .max(10_000_000_000)
    .optional(),
  utilitiesEstimate: z.coerce.number().finite().min(0).max(10_000_000_000).optional(),
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
  "hover",
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
  viewerSessionId: listingViewerSessionSchema,
});
const listingActionEventSchema = listingViewEventSchema.extend({
  actionType: listingActionTypeSchema,
});

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

function parseListingFormData(formData: FormData) {
  const rawFeatures = formData
    .getAll("features")
    .map(String)
    .map(normalizeListingFeature)
    .filter(Boolean)
    .slice(0, maxListingFeatures);
  const publishIntent = String(formData.get("publishIntent") || "draft");
  const parsed = listingSchema.safeParse({
    askingPrice: numberOrUndefined(formData.get("askingPrice")),
    availableFrom: formData.get("availableFrom"),
    bathrooms: decimalOrUndefined(formData.get("bathrooms")),
    bedrooms: numberOrUndefined(formData.get("bedrooms")),
    buyerIncentive: formData.get("buyerIncentive"),
    city: formData.get("city"),
    country: formData.get("country"),
    description: formData.get("description"),
    erfSize: decimalOrUndefined(formData.get("erfSize")),
    features: Array.from(new Set(rawFeatures)),
    floorSize: decimalOrUndefined(formData.get("floorSize")),
    furnishedStatus: formData.get("furnishedStatus") || "",
    garages: numberOrUndefined(formData.get("garages")),
    googlePlaceId: formData.get("googlePlaceId"),
    googlePlaceData: formData.get("googlePlaceData"),
    insuranceEstimate: numberOrUndefined(formData.get("insuranceEstimate")),
    listingType: formData.get("listingType"),
    location:
      String(formData.get("location") || "").trim() ||
      (publishIntent === "draft" ? "Location not set" : ""),
    localTaxes: numberOrUndefined(formData.get("localTaxes")),
    mandateEndDate: formData.get("mandateEndDate"),
    mandateStartDate: formData.get("mandateStartDate"),
    mandateType: formData.get("mandateType"),
    communityFees: numberOrUndefined(formData.get("communityFees")),
    parking: numberOrUndefined(formData.get("parking")),
    petsAllowed: formData.get("petsAllowed") || "",
    previousAskingPrice: numberOrUndefined(formData.get("previousAskingPrice")),
    priceQualifier: formData.get("priceQualifier"),
    propertyType: formData.get("propertyType"),
    province: formData.get("province"),
    publishIntent,
    reservationAmount: numberOrUndefined(formData.get("reservationAmount")),
    reservationEnabled: formData.get("reservationEnabled") === "on",
    rentalYield: decimalOrUndefined(formData.get("rentalYield")),
    shortLetAllowed: formData.get("shortLetAllowed") || "",
    suburb: formData.get("suburb"),
    title:
      String(formData.get("title") || "").trim() ||
      (publishIntent === "draft" ? "Untitled listing" : ""),
    transferCostsEstimate: numberOrUndefined(formData.get("transferCostsEstimate")),
    utilitiesEstimate: numberOrUndefined(formData.get("utilitiesEstimate")),
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

  if (!data.bedrooms || !data.bathrooms || !data.floorSize) {
    issues.push("Add bedrooms, bathrooms, and floor size.");
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
  const mediaPayloadBytes = mediaFiles.reduce(
    (total, value) => total + (value instanceof File ? value.size : 0),
    0,
  );

  if (mediaPayloadBytes > maxListingPublishPayloadBytes) {
    console.warn("[listings] createListing media payload too large", {
      mediaCount: mediaFiles.filter((value) => value instanceof File && value.size > 0).length,
      mediaPayloadBytes,
      userId: session.user.id,
    });
    redirect("/listings/new?listingError=media-upload");
  }

  let media: Awaited<ReturnType<typeof storeListingMedia>>;

  try {
    media = await storeListingMedia(mediaFiles);
  } catch (error) {
    console.error("[listings] createListing media upload failed", {
      error,
      mediaCount: mediaFiles.filter((value) => value instanceof File && value.size > 0).length,
      mediaPayloadBytes,
      storageRoot: getMediaStorageRoot(),
      userId: session.user.id,
    });
    redirect("/listings/new?listingError=media-upload");
  }
  assertListingCanPublish(data, description, media.length);
  const reservationFields = await getValidatedReservationFields(data);
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
        availableFrom: data.availableFrom || null,
        bathrooms: data.bathrooms ?? null,
        bedrooms: data.bedrooms ?? null,
        buyerIncentive: data.buyerIncentive || null,
        communityFeesCents,
        erfSize: data.erfSize ?? null,
        floorSize: data.floorSize ?? null,
        furnishedStatus: data.furnishedStatus || null,
        garages: data.garages ?? null,
        googlePlaceData,
        googlePlaceId: data.googlePlaceId || null,
        insuranceEstimateCents,
        localTaxesCents,
        city: data.city || null,
        country: data.country || null,
        parking: data.parking ?? null,
        petsAllowed: data.petsAllowed || null,
        previousAskingPriceCents,
        priceQualifier: data.priceQualifier || null,
        province: data.province || null,
        rentalYield: data.rentalYield ?? null,
        shortLetAllowed: data.shortLetAllowed || null,
        suburb: data.suburb || null,
        transferCostsEstimateCents,
        utilitiesEstimateCents,
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
  const uploadedMedia = await storeListingMedia(formData.getAll("mediaFiles"));
  const media = [
    ...parseExistingListingMedia(formData.get("existingMedia")),
    ...uploadedMedia,
  ].slice(0, maxListingMediaItems);
  assertListingCanPublish(data, description, media.length);
  const reservationFields = await getValidatedReservationFields(data);
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
  const nextStatus =
    existingListing.status === "reserved" ? "reserved" : data.publishIntent;
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
  const canChangePropertyIdentity = existingListing.status === "draft";

  await db
    .update(propertyListings)
    .set({
      agentProfileId: agentProfile?.id || null,
      askingPriceCents,
      coverImageUrl,
      description: description || null,
      details: {
        availableFrom: data.availableFrom || null,
        bathrooms: data.bathrooms ?? null,
        bedrooms: data.bedrooms ?? null,
        buyerIncentive: data.buyerIncentive || null,
        communityFeesCents,
        erfSize: data.erfSize ?? null,
        floorSize: data.floorSize ?? null,
        furnishedStatus: data.furnishedStatus || null,
        garages: data.garages ?? null,
        googlePlaceData,
        googlePlaceId: data.googlePlaceId || null,
        insuranceEstimateCents,
        city: data.city || null,
        country: data.country || null,
        localTaxesCents,
        parking: data.parking ?? null,
        petsAllowed: data.petsAllowed || null,
        previousAskingPriceCents,
        priceQualifier: data.priceQualifier || null,
        province: data.province || null,
        rentalYield: data.rentalYield ?? null,
        shortLetAllowed: data.shortLetAllowed || null,
        suburb: data.suburb || null,
        transferCostsEstimateCents,
        utilitiesEstimateCents,
      },
      features: data.features || [],
      listedAt:
        data.publishIntent === "published" &&
        existingListing.status !== "published"
          ? new Date()
          : existingListing.listedAt,
      listingType: data.listingType,
      location: canChangePropertyIdentity
        ? data.location
        : existingListing.location,
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

  if (data.publishIntent === "published") {
    await recordHashtagUsage({
      sourceId: listingId.data,
      sourceType: "listing",
      tags: extractHashtags(data.title, plainListingDescription(description)),
      userId: session.user.id,
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
  const session = await getServerSession(authOptions);

  if (!parsed.success) {
    return { error: "Listing ID is invalid.", ok: false as const };
  }

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

  await db.insert(listingViewEvents).values({
    listingId: parsed.data.listingId,
    source: parsed.data.source || "listing_detail",
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
