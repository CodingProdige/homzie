import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { desc, eq, and, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  reelComments,
  reelLikes,
  reelReshares,
  reelSaves,
  reels,
  propertyListings,
  userFollows,
  users,
} from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import { authOptions } from "@/modules/auth/config";
import { normalizeUsername } from "@/modules/auth/username";
import { ReelsFeed, type ReelFeedItem } from "@/modules/reels/components/reels-feed";

type UserReelsPageProps = {
  params: Promise<{
    username: string;
  }>;
};

function metadataObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function formatCompactCount(value: number) {
  if (value < 1000) {
    return String(value);
  }

  const compactValue = value / 1000;

  return `${Number.isInteger(compactValue) ? compactValue.toFixed(0) : compactValue.toFixed(1)}K`;
}

function reelVideoUrl(videoPath: string, editMetadata: unknown) {
  const metadata = metadataObject(editMetadata);
  const render = metadataObject(metadata.render);
  const renderedUrl = toPublicMediaUrl(render.mediaPath as string);

  return renderedUrl || toPublicMediaUrl(videoPath) || undefined;
}

function reelPosterUrl(editMetadata: unknown) {
  const metadata = metadataObject(editMetadata);
  const coverFrame = metadataObject(metadata.coverFrame);

  return typeof coverFrame.src === "string" && !coverFrame.src.startsWith("data:")
    ? coverFrame.src
    : undefined;
}

function reelLocation(editMetadata: unknown, listingReference: string | null) {
  const metadata = metadataObject(editMetadata);

  if (typeof metadata.location === "string" && metadata.location.trim()) {
    return metadata.location;
  }

  return listingReference || "Homzie";
}

export default async function UserReelsPage({ params }: UserReelsPageProps) {
  const { username } = await params;
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername) {
    notFound();
  }

  const [profile] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
    })
    .from(users)
    .where(eq(users.username, normalizedUsername))
    .limit(1);

  if (!profile?.username) {
    notFound();
  }

  const ownedRows = await db
    .select({
      agentAvatarUrl: users.avatarUrl,
      agentName: users.name,
      agentUsername: users.username,
      caption: reels.caption,
      createdAt: reels.createdAt,
      editMetadata: reels.editMetadata,
      id: reels.id,
      listingAskingPriceCents: propertyListings.askingPriceCents,
      listingCoverImageUrl: propertyListings.coverImageUrl,
      listingId: reels.listingId,
      listingLocation: propertyListings.location,
      listingPriceLabel: propertyListings.priceLabel,
      listingReference: reels.listingReference,
      listingStatus: propertyListings.status,
      listingTitle: propertyListings.title,
      ownerId: reels.userId,
      videoPath: reels.videoPath,
      viewCount: reels.viewCount,
    })
    .from(reels)
    .innerJoin(users, eq(users.id, reels.userId))
    .leftJoin(propertyListings, eq(propertyListings.id, reels.listingId))
    .where(and(eq(reels.userId, profile.id), eq(reels.status, "published")))
    .orderBy(desc(reels.createdAt));

  const resharedRows = await db
    .select({
      agentAvatarUrl: users.avatarUrl,
      agentName: users.name,
      agentUsername: users.username,
      caption: reels.caption,
      createdAt: reelReshares.createdAt,
      editMetadata: reels.editMetadata,
      id: reels.id,
      listingAskingPriceCents: propertyListings.askingPriceCents,
      listingCoverImageUrl: propertyListings.coverImageUrl,
      listingId: reels.listingId,
      listingLocation: propertyListings.location,
      listingPriceLabel: propertyListings.priceLabel,
      listingReference: reels.listingReference,
      listingStatus: propertyListings.status,
      listingTitle: propertyListings.title,
      ownerId: reels.userId,
      videoPath: reels.videoPath,
      viewCount: reels.viewCount,
    })
    .from(reelReshares)
    .innerJoin(reels, eq(reels.id, reelReshares.reelId))
    .innerJoin(users, eq(users.id, reels.userId))
    .leftJoin(propertyListings, eq(propertyListings.id, reels.listingId))
    .where(and(eq(reelReshares.userId, profile.id), eq(reels.status, "published")))
    .orderBy(desc(reelReshares.createdAt));

  const rows = [
    ...ownedRows.map((row) => ({
      ...row,
      resharedByName: undefined,
      resharedByUsername: undefined,
      sortDate: row.createdAt,
    })),
    ...resharedRows.map((row) => ({
      ...row,
      resharedByName: profile.name,
      resharedByUsername: profile.username || normalizedUsername,
      sortDate: row.createdAt,
    })),
  ].sort((first, second) => second.sortDate.getTime() - first.sortDate.getTime());

  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id || null;

  const feedReels: ReelFeedItem[] = await Promise.all(
    rows.map(async (reel) => {
      const [{ count: likeCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(reelLikes)
        .where(eq(reelLikes.reelId, reel.id));
      const [{ count: commentCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(reelComments)
        .where(eq(reelComments.reelId, reel.id));
      const [{ count: saveCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(reelSaves)
        .where(eq(reelSaves.reelId, reel.id));
      const [{ count: reshareCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(reelReshares)
        .where(eq(reelReshares.reelId, reel.id));
      const [viewerLike] = viewerId
        ? await db
            .select({ reelId: reelLikes.reelId })
            .from(reelLikes)
            .where(and(eq(reelLikes.reelId, reel.id), eq(reelLikes.userId, viewerId)))
            .limit(1)
        : [];
      const [viewerSave] = viewerId
        ? await db
            .select({ reelId: reelSaves.reelId })
            .from(reelSaves)
            .where(and(eq(reelSaves.reelId, reel.id), eq(reelSaves.userId, viewerId)))
            .limit(1)
        : [];
      const [viewerReshare] = viewerId
        ? await db
            .select({ reelId: reelReshares.reelId })
            .from(reelReshares)
            .where(
              and(eq(reelReshares.reelId, reel.id), eq(reelReshares.userId, viewerId)),
            )
            .limit(1)
        : [];
      const [followState] =
        viewerId && viewerId !== reel.ownerId
          ? await db
              .select({ followingId: userFollows.followingId })
              .from(userFollows)
              .where(
                and(
                  eq(userFollows.followerId, viewerId),
                  eq(userFollows.followingId, reel.ownerId),
                ),
              )
              .limit(1)
          : [];

      return {
        agentName: reel.agentName,
        agentAvatarUrl: toPublicMediaUrl(reel.agentAvatarUrl),
        agentUsername: reel.agentUsername || "homzie",
        commentCount,
        comments: formatCompactCount(commentCount),
        followingAgent: Boolean(followState),
        id: reel.id,
        isOwnAgent: viewerId === reel.ownerId,
        likeCount,
        likedByViewer: Boolean(viewerLike),
        linkedListingId: reel.listingId,
        linkedListing: reel.listingId
          ? {
              coverImageUrl: toPublicMediaUrl(reel.listingCoverImageUrl),
              id: reel.listingId,
              location: reel.listingLocation,
              priceCents: reel.listingAskingPriceCents,
              priceLabel: reel.listingPriceLabel,
              status: reel.listingStatus || "published",
              title: reel.listingTitle || reel.listingReference || "Linked listing",
            }
          : null,
        likes: formatCompactCount(likeCount),
        location: reelLocation(reel.editMetadata, reel.listingReference),
        posterUrl: reelPosterUrl(reel.editMetadata),
        price: reel.listingPriceLabel || undefined,
        priceZarCents: reel.listingAskingPriceCents,
        resharedByName: reel.resharedByName,
        resharedByUsername: reel.resharedByUsername,
        resharedByViewer: Boolean(viewerReshare),
        reshareCount,
        reshares: formatCompactCount(reshareCount),
        savedByViewer: Boolean(viewerSave),
        saveCount,
        saves: formatCompactCount(saveCount),
        shareCount: 0,
        shares: "0",
        title: reel.caption || "Homzie reel",
        videoUrl: reelVideoUrl(reel.videoPath, reel.editMetadata),
      };
    }),
  );

  return <ReelsFeed reels={feedReels} scope={normalizedUsername} />;
}
