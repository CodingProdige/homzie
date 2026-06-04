import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { and, desc, eq, sql } from "drizzle-orm";

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
import {
  countryPreferenceCookie,
  locationMatchesCountry,
  parseCountryPreference,
} from "@/modules/location/country-preference";
import { ReelsFeed, type ReelFeedItem } from "@/modules/reels/components/reels-feed";

type ReelsPageProps = {
  searchParams?: Promise<{
    reel?: string;
  }>;
};

function metadataObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function formatCompactCount(value: number) {
  if (value < 1000) return String(value);

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

export default async function ReelsPage({ searchParams }: ReelsPageProps) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id || null;
  const query = searchParams ? await searchParams : {};
  const preferredReelId =
    typeof query.reel === "string" && query.reel.trim() ? query.reel.trim() : null;
  const cookieStore = await cookies();
  const countryPreference = parseCountryPreference(
    cookieStore.get(countryPreferenceCookie)?.value,
  );
  const rows = await db
    .select({
      agentName: users.name,
      agentUsername: users.username,
      caption: reels.caption,
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
    })
    .from(reels)
    .innerJoin(users, eq(users.id, reels.userId))
    .leftJoin(propertyListings, eq(propertyListings.id, reels.listingId))
    .where(eq(reels.status, "published"))
    .orderBy(desc(reels.createdAt))
    .limit(24);

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

  const rankedFeedReels = countryPreference
    ? feedReels.toSorted((first, second) => {
        const firstMatches = locationMatchesCountry(
          [first.location, first.linkedListing?.location].filter(Boolean).join(", "),
          countryPreference,
        );
        const secondMatches = locationMatchesCountry(
          [second.location, second.linkedListing?.location].filter(Boolean).join(", "),
          countryPreference,
        );

        if (firstMatches === secondMatches) return 0;

        return firstMatches ? -1 : 1;
      })
    : feedReels;

  return (
    <ReelsFeed
      preferredReelId={preferredReelId}
      reels={rankedFeedReels}
      scope="global"
    />
  );
}
