import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  listingLikes,
  listingSaves,
  propertyListings,
  propertyOffers,
  users,
} from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import {
  listingTypeOptions,
  mandateTypeOptions,
  propertyTypeOptions,
  type ListingType,
  type PropertyType,
} from "@/modules/listings/options";
import { buildListingPath } from "@/modules/listings/seo";
import {
  getEffectiveAgencyBrandsForUsers,
  type EffectiveAgencyBrand,
} from "@/modules/agencies/server";
import {
  calculateReservationFees,
  getStoredReservationSettings,
} from "@/modules/platform-settings/reservation-settings";
import { getAgentAccess } from "@/modules/access/agent-access";

export type ListingMediaItem = {
  name: string;
  path: string;
  previewUrl: string;
  size: number;
  type: string;
};

export type ListingDetailData = {
  agent: {
    agencyBrand: EffectiveAgencyBrand | null;
    avatarUrl: string | null;
    bio: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    id: string;
    location: string | null;
    name: string;
    publicContactVisible: boolean;
    username: string | null;
    whatsappNumber: string | null;
  };
  addressVisibility: string;
  askingPriceCents: number | null;
  availableFrom: string | null;
  bathrooms: number | null;
  bedrooms: number | null;
  buyerIncentive: string;
  canViewBuyerIntent: boolean;
  city: string;
  communityFeesCents: number | null;
  country: string;
  coverImageUrl: string | null;
  developerName: string;
  description: string | null;
  erfSize: number | null;
  estateName: string;
  features: string[];
  floorSize: number | null;
  furnishedStatus: string;
  garages: number | null;
  grossLettableArea: number | null;
  googlePlaceData: string;
  googlePlaceId: string;
  href: string;
  id: string;
  insuranceEstimateCents: number | null;
  landSizeHectares: number | null;
  leaseExpiryDate: string;
  isOwner: boolean;
  isUnavailableForViewer: boolean;
  likedByViewer: boolean;
  likeCount: number;
  likeCountLabel: string;
  offerCount: number;
  offerCountLabel: string;
  reservationAmountCents: number | null;
  reservationEnabled: boolean;
  reservationPlatformFeeCents: number;
  reservationProcessingFeeCents: number;
  reservationTermsText: string;
  reservationTotalCents: number | null;
  savedByViewer: boolean;
  saveCount: number;
  saveCountLabel: string;
  listedAt: string;
  listingVisibility: string;
  listingType: ListingType | string;
  listingTypeLabel: string;
  location: string | null;
  localTaxesCents: number | null;
  loadingBays: number | null;
  mandateEndDate: string;
  mandateStartDate: string;
  mandateType: string;
  mandateTypeLabel: string;
  media: ListingMediaItem[];
  occupancyStatus: string;
  ownershipType: string;
  outbuildings: string;
  parking: number | null;
  petsAllowed: string;
  powerSupply: string;
  previousAskingPriceCents: number | null;
  priceLabel: string | null;
  priceQualifier: string;
  propertyCategory: string;
  propertyType: PropertyType | string;
  propertyTypeLabel: string;
  province: string;
  ratesAndTaxesCents: number | null;
  rentalYield: number | null;
  servitudes: string;
  shortLetAllowed: string;
  status: string;
  statusLabel: string;
  suburb: string;
  titleDeedStatus: string;
  title: string;
  transferCostsEstimateCents: number | null;
  unitCount: number | null;
  updatedAt: string;
  contactVisibility: string;
  utilitiesEstimateCents: number | null;
  waterRights: string;
  zoning: string;
};

type ListingRow = Awaited<ReturnType<typeof getListingRow>>;

function objectValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function jsonStringValue(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isoDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) || "";
}

function formatCompactCount(value: number) {
  if (value < 1000) {
    return String(value);
  }

  const compactValue = value / 1000;

  return `${Number.isInteger(compactValue) ? compactValue.toFixed(0) : compactValue.toFixed(1)}K`;
}

function listingStatusLabel(status: string) {
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  if (status === "reserved") return "Reserved";
  if (status === "sold") return "Sold";
  if (status === "sold_externally") return "Sold externally";
  if (status === "draft") return "Draft";
  if (status === "withdrawn") return "Withdrawn";
  if (status === "expired") return "Expired";

  return status.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function parseListingMedia(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): ListingMediaItem | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const mediaItem = item as Record<string, unknown>;
      const path = stringValue(mediaItem.path);
      const previewUrl = toPublicMediaUrl(path);

      if (!path || !previewUrl) return null;

      return {
        name: stringValue(mediaItem.name) || path.split("/").pop() || "Listing image",
        path,
        previewUrl,
        size: numberValue(mediaItem.size) || 0,
        type: stringValue(mediaItem.type) || "image/webp",
      };
    })
    .filter((item): item is ListingMediaItem => Boolean(item));
}

function optionLabel<T extends { label: string; value: string }>(
  options: readonly T[],
  value: string,
  fallback: string,
) {
  return options.find((option) => option.value === value)?.label || fallback;
}

async function getListingRow(listingId: string) {
  const [row] = await db
    .select({
      agentAvatarUrl: users.avatarUrl,
      agentBio: users.bio,
      agentContactEmail: users.contactEmail,
      agentContactPhone: users.contactPhone,
      agentLocation: users.location,
      agentName: users.name,
      agentPublicContactVisible: users.publicContactVisible,
      agentUsername: users.username,
      agentWhatsappNumber: users.whatsappNumber,
      askingPriceCents: propertyListings.askingPriceCents,
      coverImageUrl: propertyListings.coverImageUrl,
      description: propertyListings.description,
      details: propertyListings.details,
      features: propertyListings.features,
      id: propertyListings.id,
      listedAt: propertyListings.listedAt,
      listingType: propertyListings.listingType,
      location: propertyListings.location,
      mandateEndDate: propertyListings.mandateEndDate,
      mandateStartDate: propertyListings.mandateStartDate,
      mandateType: propertyListings.mandateType,
      media: propertyListings.media,
      priceLabel: propertyListings.priceLabel,
      propertyType: propertyListings.propertyType,
      reservationAmountCents: propertyListings.reservationAmountCents,
      reservationEnabled: propertyListings.reservationEnabled,
      status: propertyListings.status,
      title: propertyListings.title,
      updatedAt: propertyListings.updatedAt,
      userId: propertyListings.userId,
    })
    .from(propertyListings)
    .innerJoin(users, eq(users.id, propertyListings.userId))
    .where(eq(propertyListings.id, listingId))
    .limit(1);

  return row || null;
}

export async function getListingIdByShortId(shortId: string) {
  if (!/^[a-f0-9]{8}$/i.test(shortId)) {
    return null;
  }

  const rows = await db
    .select({ id: propertyListings.id })
    .from(propertyListings)
    .where(sql`${propertyListings.id}::text ilike ${`${shortId}%`}`)
    .limit(2);

  return rows.length === 1 ? rows[0].id : null;
}

export async function getListingDetail({
  listingId,
  viewerUserId,
}: {
  listingId: string;
  viewerUserId?: string | null;
}) {
  const row = await getListingRow(listingId);

  if (!row) return null;

  const [save] = viewerUserId
    ? await db
        .select({ listingId: listingSaves.listingId })
        .from(listingSaves)
        .where(
          and(
            eq(listingSaves.listingId, listingId),
            eq(listingSaves.userId, viewerUserId),
          ),
        )
        .limit(1)
    : [];
  const isOwner = row.userId === viewerUserId;
  const savedByViewer = Boolean(save);

  if (
    !isOwner &&
    row.status !== "published" &&
    row.status !== "reserved" &&
    !savedByViewer
  ) {
    return null;
  }

  const [like] = viewerUserId
    ? await db
        .select({ listingId: listingLikes.listingId })
        .from(listingLikes)
        .where(
          and(
            eq(listingLikes.listingId, listingId),
            eq(listingLikes.userId, viewerUserId),
          ),
        )
        .limit(1)
    : [];
  const [{ count: likeCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listingLikes)
    .where(eq(listingLikes.listingId, listingId));
  const [{ count: saveCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listingSaves)
    .where(eq(listingSaves.listingId, listingId));
  const [{ count: offerCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(propertyOffers)
    .where(eq(propertyOffers.listingId, listingId));
  const access = viewerUserId && isOwner ? await getAgentAccess(viewerUserId) : null;

  return await mapListingRow(row, {
    agencyBrand: (await getEffectiveAgencyBrandsForUsers([row.userId])).get(row.userId) || null,
    canViewBuyerIntent: Boolean(access?.canViewBuyerIntent),
    isOwner,
    isUnavailableForViewer: row.status !== "published",
    likedByViewer: Boolean(like),
    likeCount,
    offerCount,
    savedByViewer,
    saveCount,
  });
}

export async function getOwnedListingDetail({
  listingId,
  userId,
}: {
  listingId: string;
  userId: string;
}) {
  const [row] = await db
    .select({
      agentAvatarUrl: users.avatarUrl,
      agentBio: users.bio,
      agentContactEmail: users.contactEmail,
      agentContactPhone: users.contactPhone,
      agentLocation: users.location,
      agentName: users.name,
      agentPublicContactVisible: users.publicContactVisible,
      agentUsername: users.username,
      agentWhatsappNumber: users.whatsappNumber,
      askingPriceCents: propertyListings.askingPriceCents,
      coverImageUrl: propertyListings.coverImageUrl,
      description: propertyListings.description,
      details: propertyListings.details,
      features: propertyListings.features,
      id: propertyListings.id,
      listedAt: propertyListings.listedAt,
      listingType: propertyListings.listingType,
      location: propertyListings.location,
      mandateEndDate: propertyListings.mandateEndDate,
      mandateStartDate: propertyListings.mandateStartDate,
      mandateType: propertyListings.mandateType,
      media: propertyListings.media,
      priceLabel: propertyListings.priceLabel,
      propertyType: propertyListings.propertyType,
      reservationAmountCents: propertyListings.reservationAmountCents,
      reservationEnabled: propertyListings.reservationEnabled,
      status: propertyListings.status,
      title: propertyListings.title,
      updatedAt: propertyListings.updatedAt,
      userId: propertyListings.userId,
    })
    .from(propertyListings)
    .innerJoin(users, eq(users.id, propertyListings.userId))
    .where(and(eq(propertyListings.id, listingId), eq(propertyListings.userId, userId)))
    .limit(1);

  if (!row) return null;

  const [{ count: likeCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listingLikes)
    .where(eq(listingLikes.listingId, listingId));
  const [{ count: saveCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listingSaves)
    .where(eq(listingSaves.listingId, listingId));
  const [{ count: offerCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(propertyOffers)
    .where(eq(propertyOffers.listingId, listingId));

  return await mapListingRow(row, {
    agencyBrand: (await getEffectiveAgencyBrandsForUsers([row.userId])).get(row.userId) || null,
    canViewBuyerIntent: true,
    isOwner: true,
    isUnavailableForViewer: row.status !== "published",
    likedByViewer: false,
    likeCount,
    offerCount,
    savedByViewer: false,
    saveCount,
  });
}

async function mapListingRow(
  row: NonNullable<ListingRow>,
  viewerState: {
    agencyBrand: EffectiveAgencyBrand | null;
    canViewBuyerIntent: boolean;
    isOwner: boolean;
    isUnavailableForViewer: boolean;
    likedByViewer: boolean;
    likeCount: number;
    offerCount: number;
    savedByViewer: boolean;
    saveCount: number;
  },
): Promise<ListingDetailData> {
  const reservationSettings = await getStoredReservationSettings();
  const details = objectValue(row.details);
  const media = parseListingMedia(row.media);
  const coverImageUrl =
    toPublicMediaUrl(row.coverImageUrl) || media[0]?.previewUrl || null;
  const listingTypeLabel = optionLabel(
    listingTypeOptions,
    row.listingType,
    row.listingType,
  );
  const propertyTypeLabel = optionLabel(
    propertyTypeOptions,
    row.propertyType,
    row.propertyType,
  );
  const mandateTypeLabel = optionLabel(
    mandateTypeOptions,
    row.mandateType,
    row.mandateType,
  );
  const reservationAmountCents = row.reservationAmountCents;
  const reservationFees =
    reservationAmountCents && reservationAmountCents > 0
      ? calculateReservationFees({
          amountCents: reservationAmountCents,
          settings: reservationSettings,
        })
      : null;

  return {
    agent: {
      agencyBrand: viewerState.agencyBrand,
      avatarUrl: toPublicMediaUrl(row.agentAvatarUrl),
      bio: row.agentBio,
      contactEmail: row.agentPublicContactVisible ? row.agentContactEmail : null,
      contactPhone: row.agentPublicContactVisible ? row.agentContactPhone : null,
      id: row.userId,
      location: row.agentLocation,
      name: row.agentName,
      publicContactVisible: row.agentPublicContactVisible,
      username: row.agentUsername,
      whatsappNumber: row.agentPublicContactVisible ? row.agentWhatsappNumber : null,
    },
    addressVisibility: stringValue(details.addressVisibility) || "area",
    askingPriceCents: row.askingPriceCents,
    availableFrom: stringValue(details.availableFrom) || null,
    bathrooms: numberValue(details.bathrooms),
    bedrooms: numberValue(details.bedrooms),
    buyerIncentive: stringValue(details.buyerIncentive),
    canViewBuyerIntent: viewerState.canViewBuyerIntent,
    city: stringValue(details.city),
    communityFeesCents: numberValue(details.communityFeesCents),
    country: stringValue(details.country),
    coverImageUrl,
    developerName: stringValue(details.developerName),
    description: row.description,
    erfSize: numberValue(details.erfSize),
    estateName: stringValue(details.estateName),
    features: stringArray(row.features).slice(0, 10),
    floorSize: numberValue(details.floorSize),
    furnishedStatus: stringValue(details.furnishedStatus),
    garages: numberValue(details.garages),
    grossLettableArea: numberValue(details.grossLettableArea),
    googlePlaceData: jsonStringValue(details.googlePlaceData),
    googlePlaceId: stringValue(details.googlePlaceId),
    href: buildListingPath({
      bedrooms: numberValue(details.bedrooms),
      city: stringValue(details.city),
      country: stringValue(details.country),
      id: row.id,
      listingType: row.listingType,
      location: row.location,
      propertyType: row.propertyType,
      province:
        stringValue(details.province) ||
        stringValue(details.state) ||
        stringValue(details.region),
      suburb: stringValue(details.suburb),
      title: row.title,
    }),
    id: row.id,
    insuranceEstimateCents: numberValue(details.insuranceEstimateCents),
    landSizeHectares: numberValue(details.landSizeHectares),
    leaseExpiryDate: stringValue(details.leaseExpiryDate),
    isOwner: viewerState.isOwner,
    isUnavailableForViewer: viewerState.isUnavailableForViewer,
    likedByViewer: viewerState.likedByViewer,
    likeCount: viewerState.likeCount,
    likeCountLabel: formatCompactCount(viewerState.likeCount),
    offerCount: viewerState.offerCount,
    offerCountLabel: formatCompactCount(viewerState.offerCount),
    reservationAmountCents,
    reservationEnabled:
      reservationSettings.enabled &&
      row.reservationEnabled &&
      row.status === "published" &&
      row.listingType !== "rental" &&
      Boolean(row.reservationAmountCents),
    reservationPlatformFeeCents: reservationFees?.platformFeeCents || 0,
    reservationProcessingFeeCents: reservationFees?.processingFeeCents || 0,
    reservationTermsText: reservationSettings.termsText,
    reservationTotalCents: reservationFees?.totalPaidCents || null,
    savedByViewer: viewerState.savedByViewer,
    saveCount: viewerState.saveCount,
    saveCountLabel: formatCompactCount(viewerState.saveCount),
    listedAt: row.listedAt.toISOString(),
    listingVisibility: stringValue(details.listingVisibility) || "public",
    listingType: row.listingType,
    listingTypeLabel,
    location: row.location,
    localTaxesCents: numberValue(details.localTaxesCents),
    loadingBays: numberValue(details.loadingBays),
    mandateEndDate: isoDate(row.mandateEndDate),
    mandateStartDate: isoDate(row.mandateStartDate),
    mandateType: row.mandateType,
    mandateTypeLabel,
    media,
    occupancyStatus: stringValue(details.occupancyStatus),
    ownershipType: stringValue(details.ownershipType),
    outbuildings: stringValue(details.outbuildings),
    parking: numberValue(details.parking),
    petsAllowed: stringValue(details.petsAllowed),
    powerSupply: stringValue(details.powerSupply),
    previousAskingPriceCents: numberValue(details.previousAskingPriceCents),
    priceLabel: row.priceLabel,
    priceQualifier: stringValue(details.priceQualifier),
    propertyCategory: stringValue(details.propertyCategory),
    propertyType: row.propertyType,
    propertyTypeLabel,
    province:
      stringValue(details.province) ||
      stringValue(details.state) ||
      stringValue(details.region),
    ratesAndTaxesCents: numberValue(details.ratesAndTaxesCents),
    rentalYield: numberValue(details.rentalYield),
    servitudes: stringValue(details.servitudes),
    shortLetAllowed: stringValue(details.shortLetAllowed),
    status: row.status,
    statusLabel: listingStatusLabel(row.status),
    suburb: stringValue(details.suburb),
    titleDeedStatus: stringValue(details.titleDeedStatus),
    title: row.title,
    transferCostsEstimateCents: numberValue(details.transferCostsEstimateCents),
    unitCount: numberValue(details.unitCount),
    updatedAt: row.updatedAt.toISOString(),
    contactVisibility: stringValue(details.contactVisibility) || "show",
    utilitiesEstimateCents: numberValue(details.utilitiesEstimateCents),
    waterRights: stringValue(details.waterRights),
    zoning: stringValue(details.zoning),
  };
}
