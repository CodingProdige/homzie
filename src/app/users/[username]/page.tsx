import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { propertyListings, reelReshares, reelSaves, reels, users } from "@/db/schema";
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
}: {
  isOwner: boolean;
  userId: string;
}) {
  const rows = await db
    .select({
      askingPriceCents: propertyListings.askingPriceCents,
      coverImageUrl: propertyListings.coverImageUrl,
      details: propertyListings.details,
      features: propertyListings.features,
      id: propertyListings.id,
      listingType: propertyListings.listingType,
      location: propertyListings.location,
      priceLabel: propertyListings.priceLabel,
      propertyType: propertyListings.propertyType,
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

    return {
      askingPriceCents: listing.askingPriceCents,
      bathrooms: listingNumber(details.bathrooms),
      bedrooms: listingNumber(details.bedrooms),
      coverImageUrl: toPublicMediaUrl(listing.coverImageUrl),
      erfSize: listingNumber(details.erfSize),
      features: listingStringArray(listing.features).slice(0, 5),
      floorSize: listingNumber(details.floorSize),
      id: listing.id,
      listingType: listing.listingType,
      location: listing.location,
      priceLabel: listing.priceLabel,
      propertyType: listing.propertyType,
      status: listing.status,
      title: listing.title,
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
        .select({ username: users.username, avatarUrl: users.avatarUrl })
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
  const profileListings = await getProfileListings({
    isOwner,
    userId: profile.id,
  });
  const agentStats = await getAgentPerformanceStats(profile.id);

  return (
    <UserProfile
      profile={{
        name: profile.name,
        username: profile.username,
        avatarUrl: toPublicMediaUrl(profile.avatarUrl) || undefined,
        agentStats,
        isOwner,
        hasActiveSubscription: hasSubscription,
        initialTab: query.tab === "listings" ? "listings" : undefined,
        listings: profileListings,
        reels: profileReels,
        savedReels,
        viewerUsername: viewer?.username || undefined,
        viewerAvatarUrl:
          toPublicMediaUrl(viewer?.avatarUrl) ||
          toPublicMediaUrl(session?.user?.image) ||
          undefined,
      }}
    />
  );
}
