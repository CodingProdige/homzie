import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { and, desc, eq, sql } from "drizzle-orm";
import { cache } from "react";

import { db, sql as rawSql } from "@/db";
import {
  listingLikes,
  listingSaves,
  propertyListings,
  reelReshares,
  reelSaves,
  reels,
  userFollows,
  users,
} from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { normalizeUsername } from "@/modules/auth/username";
import {
  getEffectiveAgencyBrandsForUsers,
  getPrimaryAgencyWorkspace,
} from "@/modules/agencies/server";
import { getAgentAccess } from "@/modules/access/agent-access";
import { getAgentPerformanceStats } from "@/modules/agents/performance";
import { UserProfilePage as UserProfile } from "@/modules/users/components/user-profile-page";
import { toPublicMediaUrl } from "@/media/paths";
import { buildListingPath } from "@/modules/listings/seo";
import { publicListingLocation } from "@/modules/listings/listing-validation";
import {
  formatSeoTitle,
  getStoredSeoSettings,
} from "@/modules/seo/settings";
import { absoluteUrl } from "@/modules/site/url";

type UserProfileRouteProps = {
  params: Promise<{
    username: string;
  }>;
  searchParams?: Promise<UserProfileSearchParams>;
};

type UserProfileSearchParams = {
  agent?: string;
  listingArchived?: string;
  archiveStatus?: string;
  tab?: string;
};

const getUserProfile = cache(async function getUserProfile(usernameParam: string) {
  const username = normalizeUsername(usernameParam);

  if (!username) {
    return null;
  }

  const [user] = await db
    .select({
      id: users.id,
      isDemo: users.isDemo,
      name: users.name,
      username: users.username,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      location: users.location,
      locationCity: users.locationCity,
      locationCountry: users.locationCountry,
      locationProvince: users.locationProvince,
      locationSuburb: users.locationSuburb,
      contactEmail: users.contactEmail,
      contactPhone: users.contactPhone,
      whatsappNumber: users.whatsappNumber,
      publicContactVisible: users.publicContactVisible,
      publicPerformanceVisible: users.publicPerformanceVisible,
    })
    .from(users)
    .where(
      and(
        eq(users.username, username),
        eq(users.status, "active"),
        eq(users.profileVisible, true),
      ),
    )
    .limit(1);

  return user || null;
});

function metadataObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function formatDuration(value: unknown) {
  const seconds = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatCompactCount(value: number) {
  if (value < 1000) {
    return String(value);
  }

  const compactValue = value / 1000;

  return `${Number.isInteger(compactValue) ? compactValue.toFixed(0) : compactValue.toFixed(1)}K`;
}

function countNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

type ProfileConnectionRow = {
  avatar_url: string | null;
  bio: string | null;
  followed_by_viewer: boolean | null;
  id: string;
  is_viewer: boolean | null;
  name: string;
  username: string | null;
};

function reelStatus(value: string): "draft" | "failed" | "processing" | "published" {
  return value === "draft" ||
    value === "failed" ||
    value === "processing" ||
    value === "published"
    ? value
    : "draft";
}

function listingDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function listingNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function listingStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isString(value: string | null): value is string {
  return typeof value === "string";
}

function listingMediaUrls(value: unknown, mediaType: "image" | "video") {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return "";

      const path = (item as { path?: unknown }).path;
      const type = (item as { type?: unknown }).type;
      const isVideo = typeof type === "string" && type.startsWith("video/");

      if (mediaType === "video" ? !isVideo : isVideo) return "";

      return typeof path === "string" ? toPublicMediaUrl(path) : "";
    })
    .filter(isString);
}

function listingCoverImageUrl(coverImageUrl: string | null, media: unknown) {
  const coverUrl = toPublicMediaUrl(coverImageUrl);
  const imageUrls = listingMediaUrls(media, "image");

  return imageUrls.includes(coverUrl || "") ? coverUrl : imageUrls[0] || coverUrl;
}

function listingUnavailableLabel(status: string) {
  if (status === "sold" || status === "sold_externally") return "Sold";
  if (status === "reserved") return "Reserved";
  if (status === "archived") return "Archived";
  if (status === "draft") return "Draft";
  if (status === "withdrawn") return "Withdrawn";
  if (status === "expired") return "Expired";

  return status === "published" ? "" : "No longer available";
}

function profileLocationLabel(profile: {
  location: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  locationProvince: string | null;
  locationSuburb: string | null;
}) {
  return (
    [
      profile.locationSuburb,
      profile.locationCity,
      profile.locationProvince,
      profile.locationCountry,
    ]
      .filter(Boolean)
      .join(", ") ||
    profile.location ||
    ""
  );
}

function profilePostalAddress(profile: {
  location: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  locationProvince: string | null;
  locationSuburb: string | null;
}) {
  if (
    !profile.location &&
    !profile.locationCity &&
    !profile.locationCountry &&
    !profile.locationProvince &&
    !profile.locationSuburb
  ) {
    return undefined;
  }

  return {
    "@type": "PostalAddress",
    addressCountry: profile.locationCountry || undefined,
    addressLocality: profile.locationCity || undefined,
    addressRegion: profile.locationProvince || undefined,
    streetAddress: profile.locationSuburb || profile.location || undefined,
  };
}

function archiveFeedbackMessage(status?: string) {
  if (status === "sold_externally") {
    return "Listing marked as sold externally. It stays here for your records and is hidden from buyers.";
  }

  return "Listing archived. It stays here for your records and is hidden from buyers.";
}

async function getProfileReels({
  isOwner,
  userId,
}: {
  isOwner: boolean;
  userId: string;
}) {
  const ownedRows = await db
    .select({
      caption: reels.caption,
      createdAt: reels.createdAt,
      editMetadata: reels.editMetadata,
      id: reels.id,
      status: reels.status,
      viewCount: reels.viewCount,
    })
    .from(reels)
    .where(
      isOwner
        ? eq(reels.userId, userId)
        : and(eq(reels.userId, userId), eq(reels.status, "published")),
    )
    .orderBy(desc(reels.createdAt));

  const resharedRows = await db
    .select({
      caption: reels.caption,
      createdAt: reelReshares.createdAt,
      editMetadata: reels.editMetadata,
      id: reels.id,
      status: reels.status,
      viewCount: reels.viewCount,
    })
    .from(reelReshares)
    .innerJoin(reels, eq(reels.id, reelReshares.reelId))
    .where(and(eq(reelReshares.userId, userId), eq(reels.status, "published")))
    .orderBy(desc(reelReshares.createdAt));

  return [
    ...ownedRows.map((reel) => ({ ...reel, sortDate: reel.createdAt })),
    ...resharedRows.map((reel) => ({ ...reel, sortDate: reel.createdAt })),
  ]
    .sort((first, second) => second.sortDate.getTime() - first.sortDate.getTime())
    .map(mapProfileReel);
}

function mapProfileReel(reel: {
  caption: string | null;
  editMetadata: unknown;
  id: string;
  status: string;
  viewCount: number;
}) {
  const metadata = metadataObject(reel.editMetadata);
  const coverFrame = metadataObject(metadata.coverFrame);
  const render = metadataObject(metadata.render);
  const coverUrl =
    typeof coverFrame.src === "string"
      ? coverFrame.src
      : toPublicMediaUrl(render.mediaPath as string);
  const renderProgress =
    typeof render.progress === "number"
      ? Math.max(0, Math.min(100, Math.round(render.progress)))
      : reel.status === "processing"
        ? 10
        : null;

  return {
    caption: reel.caption,
    coverUrl,
    durationLabel: formatDuration(metadata.totalDuration),
    editHref: `/reels/${reel.id}/edit`,
    id: reel.id,
    renderProgress,
    status: reelStatus(reel.status),
    viewCountLabel: formatCompactCount(reel.viewCount),
  };
}

async function getSavedReels({
  canViewSaved,
  userId,
}: {
  canViewSaved: boolean;
  userId: string;
}) {
  if (!canViewSaved) return [];

  const rows = await db
    .select({
      caption: reels.caption,
      editMetadata: reels.editMetadata,
      id: reels.id,
      status: reels.status,
      viewCount: reels.viewCount,
    })
    .from(reelSaves)
    .innerJoin(reels, eq(reels.id, reelSaves.reelId))
    .where(and(eq(reelSaves.userId, userId), eq(reels.status, "published")))
    .orderBy(desc(reelSaves.createdAt));

  return rows.map(mapProfileReel);
}

async function getProfileListings({
  isOwner,
  userId,
  viewerUserId,
}: {
  isOwner: boolean;
  userId: string;
  viewerUserId?: string | null;
}) {
  const rows = await db
    .select({
      askingPriceCents: propertyListings.askingPriceCents,
      coverImageUrl: propertyListings.coverImageUrl,
      details: propertyListings.details,
      features: propertyListings.features,
      id: propertyListings.id,
      likeCount: sql<number>`(
        select count(*)::int
        from ${listingLikes}
        where ${listingLikes.listingId} = ${propertyListings.id}
      )`,
      likedByViewer: viewerUserId
        ? sql<boolean>`exists (
            select 1
            from ${listingLikes}
            where ${listingLikes.listingId} = ${propertyListings.id}
              and ${listingLikes.userId} = ${viewerUserId}
          )`
        : sql<boolean>`false`,
      listingType: propertyListings.listingType,
      location: propertyListings.location,
      mandateEndDate: propertyListings.mandateEndDate,
      mandateStartDate: propertyListings.mandateStartDate,
      mandateType: propertyListings.mandateType,
      media: propertyListings.media,
      priceLabel: propertyListings.priceLabel,
      propertyType: propertyListings.propertyType,
      saveCount: sql<number>`(
        select count(*)::int
        from ${listingSaves}
        where ${listingSaves.listingId} = ${propertyListings.id}
      )`,
      savedByViewer: viewerUserId
        ? sql<boolean>`exists (
            select 1
            from ${listingSaves}
            where ${listingSaves.listingId} = ${propertyListings.id}
              and ${listingSaves.userId} = ${viewerUserId}
          )`
        : sql<boolean>`false`,
      status: propertyListings.status,
      title: propertyListings.title,
      updatedAt: propertyListings.updatedAt,
      userId: propertyListings.userId,
    })
    .from(propertyListings)
    .where(
      isOwner
        ? eq(propertyListings.userId, userId)
        : and(
            eq(propertyListings.userId, userId),
            eq(propertyListings.status, "published"),
          ),
    )
    .orderBy(desc(propertyListings.updatedAt));

  const agencyBrands = await getEffectiveAgencyBrandsForUsers([userId]);

  return rows.map((listing) => {
    const details = listingDetails(listing.details);
    const unavailable = listing.status !== "published";
    const addressVisibility =
      typeof details.addressVisibility === "string" ? details.addressVisibility : "area";
    const city = typeof details.city === "string" ? details.city : "";
    const country = typeof details.country === "string" ? details.country : "";
    const province =
      (typeof details.province === "string" ? details.province : "") ||
      (typeof details.state === "string" ? details.state : "") ||
      (typeof details.region === "string" ? details.region : "");
    const suburb = typeof details.suburb === "string" ? details.suburb : "";
    const displayLocation = publicListingLocation({
      addressVisibility,
      city,
      country,
      isOwner,
      location: listing.location,
      province,
      suburb,
    });

    return {
      askingPriceCents: listing.askingPriceCents,
      agencyBrand: agencyBrands.get(listing.userId) || null,
      bathrooms: listingNumber(details.bathrooms),
      bedrooms: listingNumber(details.bedrooms),
      buyerIncentive:
        typeof details.buyerIncentive === "string" ? details.buyerIncentive : "",
      coverImageUrl: listingCoverImageUrl(listing.coverImageUrl, listing.media),
      erfSize: listingNumber(details.erfSize),
      features: listingStringArray(listing.features).slice(0, 10),
      floorSize: listingNumber(details.floorSize),
      garages: listingNumber(details.garages),
      grossLettableArea: listingNumber(details.grossLettableArea),
      href: buildListingPath({
        bedrooms: listingNumber(details.bedrooms),
        city,
        country,
        id: listing.id,
        listingType: listing.listingType,
        location: displayLocation,
        propertyType: listing.propertyType,
        province,
        suburb,
        title: listing.title,
      }),
      id: listing.id,
      imageUrls: listingMediaUrls(listing.media, "image"),
      landSizeHectares: listingNumber(details.landSizeHectares),
      listingType: listing.listingType,
      likedByViewer: listing.likedByViewer,
      likeCount: listing.likeCount,
      likeCountLabel: formatCompactCount(listing.likeCount),
      location: displayLocation,
      mandateEndDate: (!isOwner && details.mandateVisibility === "hide") ? "" : listing.mandateEndDate?.toISOString().slice(0, 10) || "",
      mandateStartDate: (!isOwner && details.mandateVisibility === "hide") ? "" : listing.mandateStartDate?.toISOString().slice(0, 10) || "",
      mandateType: (!isOwner && details.mandateVisibility === "hide") ? null : listing.mandateType,
      loadingBays: listingNumber(details.loadingBays),
      parking: listingNumber(details.parking),
      priceLabel: listing.priceLabel,
      previousAskingPriceCents: (!isOwner && details.previousPriceVisibility === "hide") ? 0 : listingNumber(details.previousAskingPriceCents),
      propertyCategory:
        typeof details.propertyCategory === "string" ? details.propertyCategory : null,
      propertyType: listing.propertyType,
      savedByViewer: listing.savedByViewer,
      saveCount: listing.saveCount,
      saveCountLabel: formatCompactCount(listing.saveCount),
      status: listing.status,
      statusLabel: undefined,
      title: listing.title,
      unavailable,
      unavailableLabel: unavailable ? listingUnavailableLabel(listing.status) : "",
      videoUrls: listingMediaUrls(listing.media, "video"),
    };
  });
}

async function getSavedListings({
  canViewSaved,
  userId,
  viewerUserId,
}: {
  canViewSaved: boolean;
  userId: string;
  viewerUserId?: string | null;
}) {
  if (!canViewSaved) return [];

  const rows = await db
    .select({
      askingPriceCents: propertyListings.askingPriceCents,
      coverImageUrl: propertyListings.coverImageUrl,
      details: propertyListings.details,
      features: propertyListings.features,
      id: propertyListings.id,
      likeCount: sql<number>`(
        select count(*)::int
        from ${listingLikes}
        where ${listingLikes.listingId} = ${propertyListings.id}
      )`,
      likedByViewer: viewerUserId
        ? sql<boolean>`exists (
            select 1
            from ${listingLikes}
            where ${listingLikes.listingId} = ${propertyListings.id}
              and ${listingLikes.userId} = ${viewerUserId}
          )`
        : sql<boolean>`false`,
      listingType: propertyListings.listingType,
      location: propertyListings.location,
      mandateEndDate: propertyListings.mandateEndDate,
      mandateStartDate: propertyListings.mandateStartDate,
      mandateType: propertyListings.mandateType,
      media: propertyListings.media,
      priceLabel: propertyListings.priceLabel,
      propertyType: propertyListings.propertyType,
      saveCount: sql<number>`(
        select count(*)::int
        from ${listingSaves}
        where ${listingSaves.listingId} = ${propertyListings.id}
      )`,
      savedByViewer: viewerUserId
        ? sql<boolean>`exists (
            select 1
            from ${listingSaves}
            where ${listingSaves.listingId} = ${propertyListings.id}
              and ${listingSaves.userId} = ${viewerUserId}
          )`
        : sql<boolean>`false`,
      status: propertyListings.status,
      title: propertyListings.title,
      updatedAt: propertyListings.updatedAt,
      userId: propertyListings.userId,
    })
    .from(listingSaves)
    .innerJoin(propertyListings, eq(propertyListings.id, listingSaves.listingId))
    .where(eq(listingSaves.userId, userId))
    .orderBy(desc(listingSaves.createdAt));

  const agencyBrands = await getEffectiveAgencyBrandsForUsers(
    rows.map((listing) => listing.userId),
  );

  return rows.map((listing) => {
    const details = listingDetails(listing.details);
    const unavailable = listing.status !== "published";
    const isListingOwner = listing.userId === viewerUserId;
    const addressVisibility =
      typeof details.addressVisibility === "string" ? details.addressVisibility : "area";
    const city = typeof details.city === "string" ? details.city : "";
    const country = typeof details.country === "string" ? details.country : "";
    const province =
      (typeof details.province === "string" ? details.province : "") ||
      (typeof details.state === "string" ? details.state : "") ||
      (typeof details.region === "string" ? details.region : "");
    const suburb = typeof details.suburb === "string" ? details.suburb : "";
    const displayLocation = publicListingLocation({
      addressVisibility,
      city,
      country,
      isOwner: isListingOwner,
      location: listing.location,
      province,
      suburb,
    });

    return {
      askingPriceCents: listing.askingPriceCents,
      agencyBrand: agencyBrands.get(listing.userId) || null,
      bathrooms: listingNumber(details.bathrooms),
      bedrooms: listingNumber(details.bedrooms),
      buyerIncentive:
        typeof details.buyerIncentive === "string" ? details.buyerIncentive : "",
      coverImageUrl: listingCoverImageUrl(listing.coverImageUrl, listing.media),
      erfSize: listingNumber(details.erfSize),
      features: listingStringArray(listing.features).slice(0, 10),
      floorSize: listingNumber(details.floorSize),
      garages: listingNumber(details.garages),
      grossLettableArea: listingNumber(details.grossLettableArea),
      href: buildListingPath({
        bedrooms: listingNumber(details.bedrooms),
        city,
        country,
        id: listing.id,
        listingType: listing.listingType,
        location: displayLocation,
        propertyType: listing.propertyType,
        province,
        suburb,
        title: listing.title,
      }),
      id: listing.id,
      imageUrls: listingMediaUrls(listing.media, "image"),
      landSizeHectares: listingNumber(details.landSizeHectares),
      listingType: listing.listingType,
      likedByViewer: listing.likedByViewer,
      likeCount: listing.likeCount,
      likeCountLabel: formatCompactCount(listing.likeCount),
      location: displayLocation,
      mandateEndDate: details.mandateVisibility === "hide" ? "" : listing.mandateEndDate?.toISOString().slice(0, 10) || "",
      mandateStartDate: details.mandateVisibility === "hide" ? "" : listing.mandateStartDate?.toISOString().slice(0, 10) || "",
      mandateType: details.mandateVisibility === "hide" ? null : listing.mandateType,
      loadingBays: listingNumber(details.loadingBays),
      parking: listingNumber(details.parking),
      priceLabel: listing.priceLabel,
      previousAskingPriceCents: details.previousPriceVisibility === "hide" ? 0 : listingNumber(details.previousAskingPriceCents),
      propertyCategory:
        typeof details.propertyCategory === "string" ? details.propertyCategory : null,
      propertyType: listing.propertyType,
      savedByViewer: listing.savedByViewer,
      saveCount: listing.saveCount,
      saveCountLabel: formatCompactCount(listing.saveCount),
      status: listing.status,
      statusLabel: undefined,
      title: listing.title,
      unavailable,
      unavailableLabel:
        unavailable
          ? listingUnavailableLabel(listing.status)
          : "",
      videoUrls: listingMediaUrls(listing.media, "video"),
    };
  });
}

async function getProfileSocialStats(userId: string) {
  const [
    [{ count: publishedReels }],
    [{ count: visibleListings }],
    [{ count: followers }],
    [{ count: following }],
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reels)
      .where(and(eq(reels.userId, userId), eq(reels.status, "published"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(propertyListings)
      .where(
        and(
          eq(propertyListings.userId, userId),
          eq(propertyListings.status, "published"),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userFollows)
      .where(eq(userFollows.followingId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userFollows)
      .where(eq(userFollows.followerId, userId)),
  ]);

  const publishedReelCount = countNumber(publishedReels);
  const visibleListingCount = countNumber(visibleListings);

  return {
    followers: countNumber(followers),
    following: countNumber(following),
    posts: publishedReelCount + visibleListingCount,
  };
}

async function getProfileConnections(profileUserId: string, viewerUserId?: string | null) {
  const [followers, following] = await Promise.all([
    rawSql<ProfileConnectionRow[]>`
      SELECT
        u.id,
        u.name,
        u.username,
        u.avatar_url,
        u.bio,
        EXISTS (
          SELECT 1
          FROM user_follows vf
          WHERE vf.follower_id = ${viewerUserId || null}
            AND vf.following_id = u.id
        ) AS followed_by_viewer,
        u.id = ${viewerUserId || null} AS is_viewer
      FROM user_follows uf
      JOIN users u ON u.id = uf.follower_id
      WHERE uf.following_id = ${profileUserId}
        AND u.status = 'active'
        AND u.profile_visible = true
        AND u.username IS NOT NULL
      ORDER BY uf.created_at DESC
      LIMIT 250
    `,
    rawSql<ProfileConnectionRow[]>`
      SELECT
        u.id,
        u.name,
        u.username,
        u.avatar_url,
        u.bio,
        EXISTS (
          SELECT 1
          FROM user_follows vf
          WHERE vf.follower_id = ${viewerUserId || null}
            AND vf.following_id = u.id
        ) AS followed_by_viewer,
        u.id = ${viewerUserId || null} AS is_viewer
      FROM user_follows uf
      JOIN users u ON u.id = uf.following_id
      WHERE uf.follower_id = ${profileUserId}
        AND u.status = 'active'
        AND u.profile_visible = true
        AND u.username IS NOT NULL
      ORDER BY uf.created_at DESC
      LIMIT 250
    `,
  ]);

  const mapConnection = (connection: ProfileConnectionRow) => ({
    avatarUrl: toPublicMediaUrl(connection.avatar_url) || undefined,
    bio: connection.bio || undefined,
    id: connection.id,
    isFollowingByViewer: Boolean(connection.followed_by_viewer),
    isViewer: Boolean(connection.is_viewer),
    name: connection.name,
    username: connection.username || "",
  });

  return {
    followers: followers.filter((connection) => connection.username).map(mapConnection),
    following: following.filter((connection) => connection.username).map(mapConnection),
  };
}

export async function generateMetadata({
  params,
}: UserProfileRouteProps): Promise<Metadata> {
  const { username } = await params;
  const [profile, seoSettings] = await Promise.all([
    getUserProfile(username),
    getStoredSeoSettings(),
  ]);

  if (!profile?.username) {
    return {
      title: "Profile not found | Homzie",
      robots: {
        follow: false,
        index: false,
      },
    };
  }

  const profileUrl = absoluteUrl(`/users/${profile.username}`);
  const locationLabel = profileLocationLabel(profile);
  const profileTitle =
    `${profile.name}${locationLabel ? ` - Property Agent in ${locationLabel}` : " on Homzie"}`;
  const description =
    profile.bio ||
    `View ${profile.name}'s Homzie profile, listings, reels and agent details.`;
  const image = absoluteUrl(`/users/${profile.username}/opengraph-image`);
  const indexable =
    seoSettings.allowIndexing &&
    (!profile.isDemo || seoSettings.indexDemoContent);

  return {
    alternates: {
      canonical: profileUrl,
    },
    description,
    openGraph: {
      description,
      images: [{ url: image }],
      siteName: seoSettings.organizationName,
      title: formatSeoTitle(profileTitle, seoSettings),
      type: "profile",
      url: profileUrl,
    },
    robots: {
      follow: indexable,
      index: indexable,
    },
    title: formatSeoTitle(profileTitle, seoSettings),
    twitter: {
      card: "summary_large_image",
      description,
      images: [image],
      title: formatSeoTitle(profileTitle, seoSettings),
    },
  };
}

export default async function UserProfilePage({
  params,
  searchParams,
}: UserProfileRouteProps) {
  const searchParamsPromise: Promise<UserProfileSearchParams> =
    searchParams || Promise.resolve({});
  const [{ username }, query] = await Promise.all([
    params,
    searchParamsPromise,
  ]);

  if (query.agent) {
    redirect(`/users/${username}`);
  }

  const [profile, session] = await Promise.all([
    getUserProfile(username),
    getServerSession(authOptions),
  ]);

  if (!profile?.username) {
    notFound();
  }

  const isOwner = session?.user?.id === profile.id;
  const viewerUserId = session?.user?.id || null;
  const [
    agentAccess,
    profileAgencyBrands,
    viewer,
    viewerAgencyWorkspace,
    viewerFollowingProfile,
    profileReels,
    profileListings,
    agentStats,
    socialStats,
    connections,
  ] = await Promise.all([
    getAgentAccess(profile.id),
    getEffectiveAgencyBrandsForUsers([profile.id]),
    viewerUserId
      ? db
          .select({
            role: users.role,
            username: users.username,
            avatarUrl: users.avatarUrl,
          })
          .from(users)
          .where(eq(users.id, viewerUserId))
          .limit(1)
          .then(([user]) => user || null)
      : Promise.resolve(null),
    viewerUserId
      ? getPrimaryAgencyWorkspace(viewerUserId)
      : Promise.resolve(null),
    viewerUserId && !isOwner
      ? db
          .select({ followingId: userFollows.followingId })
          .from(userFollows)
          .where(
            and(
              eq(userFollows.followerId, viewerUserId),
              eq(userFollows.followingId, profile.id),
            ),
          )
          .limit(1)
          .then(([follow]) => Boolean(follow))
      : Promise.resolve(false),
    getProfileReels({
      isOwner,
      userId: profile.id,
    }),
    getProfileListings({
      isOwner,
      userId: profile.id,
      viewerUserId,
    }),
    getAgentPerformanceStats(profile.id),
    getProfileSocialStats(profile.id),
    getProfileConnections(profile.id, viewerUserId),
  ]);
  const hasAgentAccess = agentAccess.canViewBuyerIntent;
  const canViewSaved = isOwner || hasAgentAccess;
  const [savedReels, savedListings] = await Promise.all([
    getSavedReels({
      canViewSaved,
      userId: profile.id,
    }),
    getSavedListings({
      canViewSaved,
      userId: profile.id,
      viewerUserId,
    }),
  ]);

  const publicProfileUrl = absoluteUrl(`/users/${profile.username}`);
  const avatarImage = toPublicMediaUrl(profile.avatarUrl);
  const locationLabel = profileLocationLabel(profile);
  const canExposePublicPerformance = profile.publicPerformanceVisible || isOwner;
  const visibleAgentStats = canExposePublicPerformance
    ? agentStats
    : {
        avgDaysToSellLabel: "Private",
        completedMandates: 0,
        completedMandatesLabel: "Private",
        disputedCount: 0,
        expiredCount: 0,
        soldCount: 0,
        soldExternallyCount: 0,
        soldThisYear: 0,
        soldThisYearLabel: "Private",
        totalSoldValueThisYearCents: 0,
        totalSoldValueThisYearLabel: "Private",
        verifiedSales: 0,
        verifiedSalesLabel: "Private",
        withdrawnCount: 0,
        winRateLabel: "Private",
      };
  const profileJsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": `${publicProfileUrl}#agent`,
    address: profilePostalAddress(profile),
    description: profile.bio || undefined,
    email:
      profile.publicContactVisible && profile.contactEmail
        ? profile.contactEmail
        : undefined,
    image: avatarImage ? absoluteUrl(avatarImage) : undefined,
    name: profile.name,
    telephone:
      profile.publicContactVisible && profile.contactPhone
        ? profile.contactPhone
        : undefined,
    url: publicProfileUrl,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(profileJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <UserProfile
        profile={{
          id: profile.id,
          agencyBrand: profileAgencyBrands.get(profile.id) || undefined,
          name: profile.name,
          username: profile.username,
          avatarUrl: toPublicMediaUrl(profile.avatarUrl) || undefined,
          bio: profile.bio || undefined,
          location: locationLabel || undefined,
          followerCount: socialStats.followers,
          followingCount: socialStats.following,
          connections,
          postCount: socialStats.posts,
          contactEmail: profile.publicContactVisible
            ? profile.contactEmail || undefined
            : undefined,
          contactPhone: profile.publicContactVisible
            ? profile.contactPhone || undefined
            : undefined,
          whatsappNumber: profile.publicContactVisible
            ? profile.whatsappNumber || undefined
            : undefined,
          agentStats: visibleAgentStats,
          isOwner,
          isFollowing: viewerFollowingProfile,
          hasActiveSubscription: hasAgentAccess,
          publicPerformanceVisible: profile.publicPerformanceVisible,
          initialTab:
            query.tab === "listings" || query.tab === "saved"
              ? query.tab
              : undefined,
          archiveFeedback: query.listingArchived
            ? archiveFeedbackMessage(query.archiveStatus)
            : undefined,
          listings: profileListings,
          reels: profileReels,
          savedListings,
          savedReels,
          viewerRole: viewer?.role || undefined,
          viewerHasAgencyWorkspace: Boolean(viewerAgencyWorkspace),
          viewerSignedIn: Boolean(viewerUserId),
          viewerUsername: viewer?.username || undefined,
          viewerAvatarUrl:
            toPublicMediaUrl(viewer?.avatarUrl) ||
            toPublicMediaUrl(session?.user?.image) ||
            undefined,
        }}
      />
    </>
  );
}
