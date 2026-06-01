import { notFound } from "next/navigation";
import { desc, eq, and } from "drizzle-orm";

import { db } from "@/db";
import { reels, users } from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
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

  const rows = await db
    .select({
      caption: reels.caption,
      editMetadata: reels.editMetadata,
      id: reels.id,
      listingReference: reels.listingReference,
      videoPath: reels.videoPath,
      viewCount: reels.viewCount,
    })
    .from(reels)
    .where(and(eq(reels.userId, profile.id), eq(reels.status, "published")))
    .orderBy(desc(reels.createdAt));

  const feedReels: ReelFeedItem[] = rows.map((reel) => ({
    agentName: profile.name,
    agentUsername: profile.username || normalizedUsername,
    comments: "0",
    id: reel.id,
    likes: formatCompactCount(reel.viewCount),
    location: reelLocation(reel.editMetadata, reel.listingReference),
    posterUrl: reelPosterUrl(reel.editMetadata),
    shares: "0",
    title: reel.caption || "Homzie reel",
    videoUrl: reelVideoUrl(reel.videoPath, reel.editMetadata),
  }));

  return <ReelsFeed reels={feedReels} scope={normalizedUsername} />;
}
