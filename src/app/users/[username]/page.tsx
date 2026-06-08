import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  listingLikes,
  listingSaves,
  propertyListings,
  reelReshares,
  reelSaves,
  reels,
  users,
} from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { normalizeUsername } from "@/modules/auth/username";
import { hasActiveAgentSubscription } from "@/modules/agents/queries";
import { getAgentPerformanceStats } from "@/modules/agents/performance";
import { UserProfilePage as UserProfile } from "@/modules/users/components/user-profile-page";
import { toPublicMediaUrl } from "@/media/paths";

type UserProfileRouteProps = {
  params: Promise<{
    username: string;
  }>;
  searchParams?: Promise<{
    agent?: string;
    listingArchived?: string;
    archiveStatus?: string;
    tab?: string;
  }>;
};

async function getUserProfile(usernameParam: string) {
  const username = normalizeUsername(usernameParam);

  if (!username) {
    return null;
  }

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      location: users.location,
      contactEmail: users.contactEmail,
      contactPhone: users.contactPhone,
      whatsappNumber: users.whatsappNumber,
      publicContactVisible: users.publicContactVisible,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  return user || null;
}

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

function listingMediaUrls(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return "";

      const path = (item as { path?: unknown }).path;

      return typeof path === "string" ? toPublicMediaUrl(path) : "";
    })
    .filter(isString);
}

function listingUnavailableLabel(status: string) {
  if (status === "sold" || status === "sold_externally") return "Sold";
  if (status === "archived") return "Archived";
  if (status === "draft") return "Draft";
  if (status === "withdrawn") return "Withdrawn";
  if (status === "expired") return "Expired";

  return status === "published" ? "" : "No longer available";
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
  const coverUrl =
    typeof coverFrame.src === "string"
      ? coverFrame.src
      : toPublicMediaUrl(metadataObject(metadata.render).mediaPath as string);

  return {
    caption: reel.caption,
    coverUrl,
    durationLabel: formatDuration(metadata.totalDuration),
    editHref: `/reels/${reel.id}/edit`,
    id: reel.id,
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

  return rows.map((listing) => {
    const details = listingDetails(listing.details);
    const unavailable = listing.status !== "published";

    return {
      askingPriceCents: listing.askingPriceCents,
      bathrooms: listingNumber(details.bathrooms),
      bedrooms: listingNumber(details.bedrooms),
      buyerIncentive:
        typeof details.buyerIncentive === "string" ? details.buyerIncentive : "",
      coverImageUrl: toPublicMediaUrl(listing.coverImageUrl),
      erfSize: listingNumber(details.erfSize),
      features: listingStringArray(listing.features).slice(0, 10),
      floorSize: listingNumber(details.floorSize),
      garages: listingNumber(details.garages),
      id: listing.id,
      imageUrls: listingMediaUrls(listing.media),
      listingType: listing.listingType,
      likedByViewer: listing.likedByViewer,
      likeCount: listing.likeCount,
      likeCountLabel: formatCompactCount(listing.likeCount),
      location: listing.location,
      mandateEndDate: listing.mandateEndDate?.toISOString().slice(0, 10) || "",
      mandateStartDate: listing.mandateStartDate?.toISOString().slice(0, 10) || "",
      mandateType: listing.mandateType,
      parking: listingNumber(details.parking),
      priceLabel: listing.priceLabel,
      previousAskingPriceCents: listingNumber(details.previousAskingPriceCents),
      propertyType: listing.propertyType,
      savedByViewer: listing.savedByViewer,
      saveCount: listing.saveCount,
      saveCountLabel: formatCompactCount(listing.saveCount),
      status: listing.status,
      title: listing.title,
      unavailable,
      unavailableLabel: unavailable ? listingUnavailableLabel(listing.status) : "",
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
    })
    .from(listingSaves)
    .innerJoin(propertyListings, eq(propertyListings.id, listingSaves.listingId))
    .where(eq(listingSaves.userId, userId))
    .orderBy(desc(listingSaves.createdAt));

  return rows.map((listing) => {
    const details = listingDetails(listing.details);

    return {
      askingPriceCents: listing.askingPriceCents,
      bathrooms: listingNumber(details.bathrooms),
      bedrooms: listingNumber(details.bedrooms),
      buyerIncentive:
        typeof details.buyerIncentive === "string" ? details.buyerIncentive : "",
      coverImageUrl: toPublicMediaUrl(listing.coverImageUrl),
      erfSize: listingNumber(details.erfSize),
      features: listingStringArray(listing.features).slice(0, 10),
      floorSize: listingNumber(details.floorSize),
      garages: listingNumber(details.garages),
      id: listing.id,
      imageUrls: listingMediaUrls(listing.media),
      listingType: listing.listingType,
      likedByViewer: listing.likedByViewer,
      likeCount: listing.likeCount,
      likeCountLabel: formatCompactCount(listing.likeCount),
      location: listing.location,
      mandateEndDate: listing.mandateEndDate?.toISOString().slice(0, 10) || "",
      mandateStartDate: listing.mandateStartDate?.toISOString().slice(0, 10) || "",
      mandateType: listing.mandateType,
      parking: listingNumber(details.parking),
      priceLabel: listing.priceLabel,
      previousAskingPriceCents: listingNumber(details.previousAskingPriceCents),
      propertyType: listing.propertyType,
      savedByViewer: listing.savedByViewer,
      saveCount: listing.saveCount,
      saveCountLabel: formatCompactCount(listing.saveCount),
      status: listing.status,
      title: listing.title,
      unavailable: listing.status !== "published",
      unavailableLabel: listingUnavailableLabel(listing.status),
    };
  });
}

export async function generateMetadata({
  params,
}: UserProfileRouteProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await getUserProfile(username);

  if (!profile?.username) {
    return {
      title: "Profile not found | Homzie",
    };
  }

  return {
    title: `${profile.name} (@${profile.username}) | Homzie`,
    description: `View ${profile.name}'s Homzie profile.`,
  };
}

export default async function UserProfilePage({
  params,
  searchParams,
}: UserProfileRouteProps) {
  const { username } = await params;
  const query = searchParams ? await searchParams : {};

  if (query.agent) {
    redirect(`/users/${username}`);
  }

  const profile = await getUserProfile(username);

  if (!profile?.username) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  const isOwner = session?.user?.id === profile.id;
  const hasSubscription = await hasActiveAgentSubscription(profile.id);
  const canViewSaved = isOwner || hasSubscription;
  const viewer = session?.user?.id
    ? await db
        .select({
          role: users.role,
          username: users.username,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1)
        .then(([user]) => user || null)
    : null;
  const profileReels = await getProfileReels({
    isOwner,
    userId: profile.id,
  });
  const savedReels = await getSavedReels({
    canViewSaved,
    userId: profile.id,
  });
  const savedListings = await getSavedListings({
    canViewSaved,
    userId: profile.id,
    viewerUserId: session?.user?.id,
  });
  const profileListings = await getProfileListings({
    isOwner,
    userId: profile.id,
    viewerUserId: session?.user?.id,
  });
  const agentStats = await getAgentPerformanceStats(profile.id);

  return (
    <UserProfile
      profile={{
        name: profile.name,
        username: profile.username,
        avatarUrl: toPublicMediaUrl(profile.avatarUrl) || undefined,
        bio: profile.bio || undefined,
        location: profile.location || undefined,
        contactEmail: profile.publicContactVisible
          ? profile.contactEmail || undefined
          : undefined,
        contactPhone: profile.publicContactVisible
          ? profile.contactPhone || undefined
          : undefined,
        whatsappNumber: profile.publicContactVisible
          ? profile.whatsappNumber || undefined
          : undefined,
        agentStats,
        isOwner,
        hasActiveSubscription: hasSubscription,
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
        viewerUsername: viewer?.username || undefined,
        viewerAvatarUrl:
          toPublicMediaUrl(viewer?.avatarUrl) ||
          toPublicMediaUrl(session?.user?.image) ||
          undefined,
      }}
    />
  );
}
