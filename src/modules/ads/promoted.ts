import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import {
  adCampaigns,
  agentProfiles,
  propertyListings,
  reels,
  users,
} from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import {
  listingTypeOptions,
  propertyTypeOptions,
} from "@/modules/listings/options";
import { buildListingPath } from "@/modules/listings/seo";
import { buildReelPath } from "@/modules/reels/urls";

type TargetArea = { label?: string; placeId?: string };

function optionLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string,
) {
  return options.find((o) => o.value === value)?.label ?? value;
}

function metadataObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function numVal(value: unknown): number {
  return typeof value === "number" ? value : Number(value || 0) || 0;
}

function formatDuration(value: unknown) {
  const seconds = Math.max(0, Math.round(Number(value) || 0));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function formatCompactCount(n: number) {
  if (n < 1000) return String(n);
  const v = n / 1000;
  return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}K`;
}

function matchesAreaContext(
  targetScope: string,
  targetAreas: unknown,
  areas: string[],
): boolean {
  if (targetScope === "global") return true;
  if (!areas.length) return true;

  const areaList = Array.isArray(targetAreas)
    ? (targetAreas as TargetArea[])
    : [];

  if (!areaList.length) return true;

  const lowerAreas = areas.map((a) => a.toLowerCase());
  return areaList.some((ta) => {
    const label = (ta.label ?? "").toLowerCase();
    return lowerAreas.some((a) => label.includes(a) || a.includes(label));
  });
}

export type PromotedProfile = {
  campaignId: string;
  avatarUrl: string | null;
  displayName: string;
  headline: string | null;
  location: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  locationProvince: string | null;
  username: string;
};

export type PromotedListing = {
  campaignId: string;
  id: string;
  href: string;
  title: string;
  location: string | null;
  coverImageUrl: string | null;
  videoUrls: string[];
  priceCents: number | null;
  priceLabel: string | null;
  listingType: string;
  listingTypeLabel: string;
  propertyTypeLabel: string;
  status: string;
  statusLabel?: string;
  bedrooms: number;
  bathrooms: number;
  garages: number;
  parking: number;
  floorSize: number;
  erfSize: number;
  mandateType: string | null;
};

export type PromotedReel = {
  campaignId: string;
  coverUrl: string | null;
  durationLabel: string;
  href: string;
  id: string;
  title: string;
  username: string;
  viewCountLabel: string;
};

export type PromotedItems = {
  listings: PromotedListing[];
  profiles: PromotedProfile[];
  reels: PromotedReel[];
};

export async function getPromotedItems({
  areas = [],
}: {
  areas?: string[];
} = {}): Promise<PromotedItems> {
  const [profileRows, listingRows, reelRows] = await Promise.all([
    db
      .select({
        campaignId: adCampaigns.id,
        targetScope: adCampaigns.targetScope,
        targetAreas: adCampaigns.targetAreas,
        avatarUrl: users.avatarUrl,
        displayName: agentProfiles.displayName,
        headline: agentProfiles.headline,
        location: agentProfiles.location,
        locationCity: agentProfiles.locationCity,
        locationCountry: agentProfiles.locationCountry,
        locationProvince: agentProfiles.locationProvince,
        username: users.username,
      })
      .from(adCampaigns)
      .innerJoin(users, eq(users.id, adCampaigns.userId))
      .innerJoin(agentProfiles, eq(agentProfiles.userId, adCampaigns.userId))
      .where(
        and(
          inArray(adCampaigns.status, ["ready", "live"]),
          eq(adCampaigns.promotedType, "profile"),
          eq(agentProfiles.status, "active"),
        ),
      )
      .orderBy(adCampaigns.createdAt)
      .limit(20),

    db
      .select({
        campaignId: adCampaigns.id,
        targetScope: adCampaigns.targetScope,
        targetAreas: adCampaigns.targetAreas,
        listingId: propertyListings.id,
        title: propertyListings.title,
        location: propertyListings.location,
        coverImageUrl: propertyListings.coverImageUrl,
        askingPriceCents: propertyListings.askingPriceCents,
        priceLabel: propertyListings.priceLabel,
        listingType: propertyListings.listingType,
        propertyType: propertyListings.propertyType,
        status: propertyListings.status,
        details: propertyListings.details,
        media: propertyListings.media,
        mandateType: propertyListings.mandateType,
      })
      .from(adCampaigns)
      .innerJoin(propertyListings, eq(propertyListings.id, adCampaigns.listingId))
      .where(
        and(
          inArray(adCampaigns.status, ["ready", "live"]),
          eq(adCampaigns.promotedType, "listing"),
          isNotNull(adCampaigns.listingId),
          eq(propertyListings.status, "published"),
        ),
      )
      .orderBy(adCampaigns.createdAt)
      .limit(20),

    db
      .select({
        campaignId: adCampaigns.id,
        targetScope: adCampaigns.targetScope,
        targetAreas: adCampaigns.targetAreas,
        reelId: reels.id,
        caption: reels.caption,
        editMetadata: reels.editMetadata,
        viewCount: reels.viewCount,
        username: users.username,
      })
      .from(adCampaigns)
      .innerJoin(reels, eq(reels.id, adCampaigns.reelId))
      .innerJoin(users, eq(users.id, reels.userId))
      .where(
        and(
          inArray(adCampaigns.status, ["ready", "live"]),
          eq(adCampaigns.promotedType, "reel"),
          isNotNull(adCampaigns.reelId),
          eq(reels.status, "published"),
        ),
      )
      .orderBy(adCampaigns.createdAt)
      .limit(20),
  ]);

  const profiles: PromotedProfile[] = profileRows
    .filter((r) => matchesAreaContext(r.targetScope, r.targetAreas, areas))
    .slice(0, 8)
    .map((r) => ({
      campaignId: r.campaignId,
      avatarUrl: toPublicMediaUrl(r.avatarUrl),
      displayName: r.displayName,
      headline: r.headline,
      location:
        [r.locationCity, r.locationProvince, r.locationCountry]
          .filter(Boolean)
          .join(", ") || r.location,
      locationCity: r.locationCity,
      locationCountry: r.locationCountry,
      locationProvince: r.locationProvince,
      username: r.username ?? "",
    }));

  const listings: PromotedListing[] = listingRows
    .filter((r) => matchesAreaContext(r.targetScope, r.targetAreas, areas))
    .slice(0, 8)
    .map((r) => {
      const details = metadataObject(r.details);
      const media = Array.isArray(r.media) ? r.media : [];
      const videoUrls = media
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return "";

          const mediaItem = item as Record<string, unknown>;

          if (typeof mediaItem.type !== "string" || !mediaItem.type.startsWith("video/")) {
            return "";
          }

          return toPublicMediaUrl(mediaItem.path as string) || "";
        })
        .filter(Boolean);

      return {
        campaignId: r.campaignId,
        id: r.listingId,
        href: buildListingPath({
          bedrooms: numVal(details.bedrooms),
          city: typeof details.city === "string" ? details.city : "",
          country: typeof details.country === "string" ? details.country : "",
          id: r.listingId,
          listingType: r.listingType,
          location: r.location,
          propertyType: r.propertyType,
          province:
            (typeof details.province === "string" ? details.province : "") ||
            (typeof details.state === "string" ? details.state : "") ||
            (typeof details.region === "string" ? details.region : ""),
          suburb: typeof details.suburb === "string" ? details.suburb : "",
          title: r.title,
        }),
        title: r.title,
        location: r.location,
        coverImageUrl: toPublicMediaUrl(r.coverImageUrl),
        videoUrls,
        priceCents: r.askingPriceCents,
        priceLabel: r.priceLabel,
        listingType: r.listingType,
        listingTypeLabel: optionLabel(listingTypeOptions, r.listingType),
        propertyTypeLabel: optionLabel(propertyTypeOptions, r.propertyType),
        status: r.status,
        statusLabel: undefined,
        bedrooms: numVal(details.bedrooms),
        bathrooms: numVal(details.bathrooms),
        garages: numVal(details.garages),
        parking: numVal(details.parking),
        floorSize: numVal(details.floorSize),
        erfSize: numVal(details.erfSize),
        mandateType: r.mandateType,
      };
    });

  const reelItems: PromotedReel[] = reelRows
    .filter((r) => matchesAreaContext(r.targetScope, r.targetAreas, areas))
    .slice(0, 8)
    .map((r) => {
      const metadata = metadataObject(r.editMetadata);
      const coverFrame = metadataObject(metadata.coverFrame);
      const render = metadataObject(metadata.render);
      const coverSrc =
        typeof coverFrame.src === "string" &&
        !coverFrame.src.startsWith("data:")
          ? coverFrame.src
          : null;
      const coverUrl =
        coverSrc || toPublicMediaUrl(render.mediaPath as string) || null;

      return {
        campaignId: r.campaignId,
        coverUrl,
        durationLabel: formatDuration(metadata.totalDuration),
        href: buildReelPath(r.reelId),
        id: r.reelId,
        title: r.caption ?? "Homzie reel",
        username: r.username ?? "homzie",
        viewCountLabel: `${formatCompactCount(r.viewCount)} views`,
      };
    });

  return { listings, profiles, reels: reelItems };
}
