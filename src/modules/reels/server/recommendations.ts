import { and, desc, eq, notInArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  propertyListings,
  reelComments,
  reelFeedback,
  reelLikes,
  reelReshares,
  reelSaves,
  reels,
  reelWatchSessions,
  userFollows,
  users,
} from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import {
  locationMatchesCountry,
  type CountryPreference,
} from "@/modules/location/country-preference";
import type { ReelPreviewCardData } from "@/modules/reels/components/reel-preview-card";
import type { ReelFeedItem } from "@/modules/reels/components/reels-feed";

type RecommendedReelsOptions = {
  areas?: string[];
  countryPreference?: CountryPreference | null;
  limit?: number;
  preferredReelId?: string | null;
  viewerUserId?: string | null;
};

type RecommendedReelRow = {
  agentAvatarUrl: string | null;
  agentName: string;
  agentUsername: string | null;
  caption: string | null;
  commentCount: number | string;
  createdAt: Date | string;
  editMetadata: unknown;
  fastSkipCount: number | string | null;
  followingAgent: boolean | null;
  id: string;
  lastWatchedAt: Date | string | null;
  likeCount: number | string;
  listingAskingPriceCents: number | null;
  listingCoverImageUrl: string | null;
  listingId: string | null;
  listingLocation: string | null;
  listingPriceLabel: string | null;
  listingReference: string | null;
  listingStatus: string | null;
  listingTitle: string | null;
  maxProgressPercent: number | null;
  ownerId: string;
  recommendationReasons?: string[];
  reshareCount: number | string;
  saveCount: number | string;
  videoPath: string;
  viewerLiked: boolean | null;
  viewerReshared: boolean | null;
  viewerSaved: boolean | null;
  viewCount: number;
};

type ScoredReel = {
  reasons: string[];
  row: RecommendedReelRow;
  score: number;
};

function metadataObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: number | string | null | undefined) {
  return Number(value || 0);
}

function dateMs(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatCompactCount(value: number) {
  if (value < 1000) return String(value);

  const compactValue = value / 1000;

  return `${Number.isInteger(compactValue) ? compactValue.toFixed(0) : compactValue.toFixed(1)}K`;
}

function formatDuration(value: unknown) {
  const seconds = Math.max(0, Math.round(Number(value) || 0));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
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

function reelLocationText(row: RecommendedReelRow) {
  return [
    stringValue(metadataObject(row.editMetadata).location),
    row.listingLocation,
    row.listingReference,
  ]
    .filter(Boolean)
    .join(", ");
}

function scoreReel({
  areas,
  countryPreference,
  preferredReelId,
  row,
}: {
  areas: string[];
  countryPreference?: CountryPreference | null;
  preferredReelId?: string | null;
  row: RecommendedReelRow;
}): ScoredReel {
  const reasons: string[] = [];
  let score = 0;
  const locationText = reelLocationText(row);
  const normalizedLocationText = locationText.toLowerCase();

  if (preferredReelId && row.id === preferredReelId) {
    score += 40;
    reasons.push("preferred");
  }

  if (countryPreference && locationMatchesCountry(locationText, countryPreference)) {
    score += 20;
    reasons.push("country match");
  }

  if (
    areas.length &&
    areas.some((area) => normalizedLocationText.includes(area.toLowerCase()))
  ) {
    score += 20;
    reasons.push("area match");
  }

  if (row.followingAgent) {
    score += 15;
    reasons.push("followed agent");
  }

  const createdAtMs = dateMs(row.createdAt) || Date.now();
  const ageHours = Math.max(0, Date.now() - createdAtMs) / 3_600_000;

  if (ageHours <= 72) {
    score += 10;
    reasons.push("fresh");
  } else if (ageHours <= 336) {
    score += 5;
    reasons.push("recent");
  }

  if (row.listingId) {
    score += 8;
    reasons.push("linked listing");
  }

  const engagementScore = Math.min(
    12,
    numberValue(row.likeCount) * 2 +
      numberValue(row.saveCount) * 3 +
      numberValue(row.reshareCount) * 3 +
      numberValue(row.commentCount),
  );

  if (engagementScore > 0) {
    score += engagementScore;
    reasons.push("engagement");
  }

  if (row.lastWatchedAt) {
    const lastWatchedAtMs = dateMs(row.lastWatchedAt);

    if (lastWatchedAtMs) {
      const watchedAgeHours =
        Math.max(0, Date.now() - lastWatchedAtMs) / 3_600_000;

      if (watchedAgeHours <= 24) {
        score -= 30;
        reasons.push("watched recently");
      } else if (watchedAgeHours <= 168) {
        score -= 12;
        reasons.push("watched this week");
      }
    }
  }

  if (numberValue(row.fastSkipCount) > 0) {
    score -= 60;
    reasons.push("fast skipped");
  }

  if (typeof row.maxProgressPercent === "number" && row.maxProgressPercent >= 95) {
    score -= 18;
    reasons.push("completed");
  }

  return { reasons, row, score };
}

function mapFeedItem({
  row,
  viewerUserId,
}: {
  row: RecommendedReelRow;
  viewerUserId?: string | null;
}): ReelFeedItem {
  const likeCount = numberValue(row.likeCount);
  const commentCount = numberValue(row.commentCount);
  const saveCount = numberValue(row.saveCount);
  const reshareCount = numberValue(row.reshareCount);

  return {
    agentName: row.agentName,
    agentAvatarUrl: toPublicMediaUrl(row.agentAvatarUrl),
    agentUsername: row.agentUsername || "homzie",
    commentCount,
    comments: formatCompactCount(commentCount),
    followingAgent: Boolean(row.followingAgent),
    id: row.id,
    isOwnAgent: viewerUserId === row.ownerId,
    likeCount,
    likedByViewer: Boolean(row.viewerLiked),
    linkedListingId: row.listingId,
    linkedListing: row.listingId
      ? {
          coverImageUrl: toPublicMediaUrl(row.listingCoverImageUrl),
          id: row.listingId,
          location: row.listingLocation,
          priceCents: row.listingAskingPriceCents,
          priceLabel: row.listingPriceLabel,
          status: row.listingStatus || "published",
          title: row.listingTitle || row.listingReference || "Linked listing",
        }
      : null,
    likes: formatCompactCount(likeCount),
    location: reelLocation(row.editMetadata, row.listingReference),
    posterUrl: reelPosterUrl(row.editMetadata),
    price: row.listingPriceLabel || undefined,
    priceZarCents: row.listingAskingPriceCents,
    recommendationReasons:
      process.env.NODE_ENV === "development" ? row.recommendationReasons : undefined,
    resharedByViewer: Boolean(row.viewerReshared),
    reshareCount,
    reshares: formatCompactCount(reshareCount),
    savedByViewer: Boolean(row.viewerSaved),
    saveCount,
    saves: formatCompactCount(saveCount),
    shareCount: 0,
    shares: "0",
    title: row.caption || "Homzie reel",
    videoUrl: reelVideoUrl(row.videoPath, row.editMetadata),
  };
}

function mapPreviewItem(row: RecommendedReelRow): ReelPreviewCardData {
  const metadata = metadataObject(row.editMetadata);
  const coverFrame = metadataObject(metadata.coverFrame);
  const render = metadataObject(metadata.render);
  const coverUrl =
    stringValue(coverFrame.src) ||
    toPublicMediaUrl(render.mediaPath as string) ||
    null;

  return {
    coverUrl,
    durationLabel: formatDuration(metadata.totalDuration),
    href: `/reels?reel=${encodeURIComponent(row.id)}`,
    id: row.id,
    status: "published",
    title: row.caption || "Homzie reel",
    username: row.agentUsername || "homzie",
    viewCountLabel: `${formatCompactCount(row.viewCount)} views`,
  };
}

async function getHiddenFeedbackReelIds(viewerUserId?: string | null) {
  if (!viewerUserId) return [];

  const rows = await db
    .select({ reelId: reelFeedback.reelId })
    .from(reelFeedback)
    .where(
      and(
        eq(reelFeedback.viewerUserId, viewerUserId),
        eq(reelFeedback.feedbackType, "not_interested"),
      ),
    )
    .limit(500);

  return rows.map((row) => row.reelId);
}

async function getCandidateRows({
  limit,
  viewerUserId,
}: Required<Pick<RecommendedReelsOptions, "limit">> &
  Pick<RecommendedReelsOptions, "viewerUserId">) {
  const hiddenFeedbackReelIds = await getHiddenFeedbackReelIds(viewerUserId);
  const candidateLimit = Math.max(limit * 4, 32);

  return db
    .select({
      agentAvatarUrl: users.avatarUrl,
      agentName: users.name,
      agentUsername: users.username,
      caption: reels.caption,
      commentCount: sql<number>`coalesce((select count(*)::int from ${reelComments} where ${reelComments.reelId} = ${reels.id}), 0)`,
      createdAt: reels.createdAt,
      editMetadata: reels.editMetadata,
      fastSkipCount: viewerUserId
        ? sql<number>`coalesce((select count(*)::int from ${reelFeedback} where ${reelFeedback.reelId} = ${reels.id} and ${reelFeedback.viewerUserId} = ${viewerUserId} and ${reelFeedback.feedbackType} = 'fast_skip'), 0)`
        : sql<number>`0`,
      followingAgent: viewerUserId
        ? sql<boolean>`exists(select 1 from ${userFollows} where ${userFollows.followerId} = ${viewerUserId} and ${userFollows.followingId} = ${reels.userId})`
        : sql<boolean>`false`,
      id: reels.id,
      lastWatchedAt: viewerUserId
        ? sql<Date | null>`(select max(${reelWatchSessions.lastWatchedAt}) from ${reelWatchSessions} where ${reelWatchSessions.reelId} = ${reels.id} and ${reelWatchSessions.viewerUserId} = ${viewerUserId})`
        : sql<Date | null>`null`,
      likeCount: sql<number>`coalesce((select count(*)::int from ${reelLikes} where ${reelLikes.reelId} = ${reels.id}), 0)`,
      listingAskingPriceCents: propertyListings.askingPriceCents,
      listingCoverImageUrl: propertyListings.coverImageUrl,
      listingId: reels.listingId,
      listingLocation: propertyListings.location,
      listingPriceLabel: propertyListings.priceLabel,
      listingReference: reels.listingReference,
      listingStatus: propertyListings.status,
      listingTitle: propertyListings.title,
      maxProgressPercent: viewerUserId
        ? sql<number | null>`(select max(${reelWatchSessions.maxProgressPercent}) from ${reelWatchSessions} where ${reelWatchSessions.reelId} = ${reels.id} and ${reelWatchSessions.viewerUserId} = ${viewerUserId})`
        : sql<number | null>`null`,
      ownerId: reels.userId,
      reshareCount: sql<number>`coalesce((select count(*)::int from ${reelReshares} where ${reelReshares.reelId} = ${reels.id}), 0)`,
      saveCount: sql<number>`coalesce((select count(*)::int from ${reelSaves} where ${reelSaves.reelId} = ${reels.id}), 0)`,
      videoPath: reels.videoPath,
      viewCount: reels.viewCount,
      viewerLiked: viewerUserId
        ? sql<boolean>`exists(select 1 from ${reelLikes} where ${reelLikes.reelId} = ${reels.id} and ${reelLikes.userId} = ${viewerUserId})`
        : sql<boolean>`false`,
      viewerReshared: viewerUserId
        ? sql<boolean>`exists(select 1 from ${reelReshares} where ${reelReshares.reelId} = ${reels.id} and ${reelReshares.userId} = ${viewerUserId})`
        : sql<boolean>`false`,
      viewerSaved: viewerUserId
        ? sql<boolean>`exists(select 1 from ${reelSaves} where ${reelSaves.reelId} = ${reels.id} and ${reelSaves.userId} = ${viewerUserId})`
        : sql<boolean>`false`,
    })
    .from(reels)
    .innerJoin(users, eq(users.id, reels.userId))
    .leftJoin(propertyListings, eq(propertyListings.id, reels.listingId))
    .where(
      and(
        eq(reels.status, "published"),
        hiddenFeedbackReelIds.length
          ? notInArray(reels.id, hiddenFeedbackReelIds)
          : undefined,
      ),
    )
    .orderBy(desc(reels.createdAt))
    .limit(candidateLimit);
}

export async function getRecommendedReels({
  areas = [],
  countryPreference,
  limit = 24,
  preferredReelId,
  viewerUserId,
}: RecommendedReelsOptions) {
  const rows = (await getCandidateRows({
    limit,
    viewerUserId,
  })) as RecommendedReelRow[];
  const scoredRows = rows
    .map((row) =>
      scoreReel({
        areas,
        countryPreference,
        preferredReelId,
        row,
      }),
    )
    .toSorted((first, second) => {
      if (second.score !== first.score) return second.score - first.score;

      return (
        (dateMs(second.row.createdAt) || 0) - (dateMs(first.row.createdAt) || 0)
      );
    })
    .slice(0, limit)
    .map(({ reasons, row }) =>
      mapFeedItem({
        row: {
          ...row,
          recommendationReasons: reasons,
        } as RecommendedReelRow & { recommendationReasons?: string[] },
        viewerUserId,
      }),
    );

  return scoredRows;
}

export async function getRecommendedReelPreviews({
  areas = [],
  countryPreference,
  limit = 12,
  preferredReelId,
  viewerUserId,
}: RecommendedReelsOptions) {
  const rows = (await getCandidateRows({
    limit,
    viewerUserId,
  })) as RecommendedReelRow[];

  return rows
    .map((row) =>
      scoreReel({
        areas,
        countryPreference,
        preferredReelId,
        row,
      }),
    )
    .toSorted((first, second) => {
      if (second.score !== first.score) return second.score - first.score;

      return (
        (dateMs(second.row.createdAt) || 0) - (dateMs(first.row.createdAt) || 0)
      );
    })
    .slice(0, limit)
    .map(({ row }) => mapPreviewItem(row));
}
