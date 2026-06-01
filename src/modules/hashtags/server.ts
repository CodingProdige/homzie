import { and, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/db";
import { hashtagStats, hashtagUsages, reels } from "@/db/schema";

const hashtagPattern = /#([a-z0-9_]{2,40})/gi;

export function extractHashtags(...values: Array<string | null | undefined>) {
  const tags = new Set<string>();

  for (const value of values) {
    for (const match of value?.matchAll(hashtagPattern) || []) {
      tags.add(match[1].toLowerCase());
    }
  }

  return Array.from(tags);
}

async function incrementHashtagStats({
  sourceType,
  tags,
}: {
  sourceType: "listing" | "reel";
  tags: string[];
}) {
  if (!tags.length) return;

  await db
    .insert(hashtagStats)
    .values(
      tags.map((tag) => ({
        listingCount: sourceType === "listing" ? 1 : 0,
        reelCount: sourceType === "reel" ? 1 : 0,
        tag,
        usageCount: 1,
      })),
    )
    .onConflictDoUpdate({
      target: hashtagStats.tag,
      set: {
        listingCount:
          sourceType === "listing"
            ? sql`${hashtagStats.listingCount} + 1`
            : hashtagStats.listingCount,
        reelCount:
          sourceType === "reel"
            ? sql`${hashtagStats.reelCount} + 1`
            : hashtagStats.reelCount,
        updatedAt: new Date(),
        usageCount: sql`${hashtagStats.usageCount} + 1`,
      },
    });
}

export async function recordHashtagUsage({
  sourceId,
  sourceType,
  tags,
  userId,
}: {
  sourceId: string;
  sourceType: "listing" | "reel";
  tags: string[];
  userId: string;
}) {
  const uniqueTags = Array.from(new Set(tags.map((tag) => tag.toLowerCase())));

  if (!uniqueTags.length) return;

  const insertedUsages = await db
    .insert(hashtagUsages)
    .values(
      uniqueTags.map((tag) => ({
        sourceId,
        sourceType,
        tag,
        userId,
      })),
    )
    .onConflictDoNothing()
    .returning({ tag: hashtagUsages.tag });

  await incrementHashtagStats({
    sourceType,
    tags: insertedUsages.map((usage) => usage.tag),
  });
}

export async function recordReelHashtagUsage(reelId: string) {
  const [reel] = await db
    .select({
      caption: reels.caption,
      hashtags: reels.hashtags,
      id: reels.id,
      status: reels.status,
      userId: reels.userId,
    })
    .from(reels)
    .where(and(eq(reels.id, reelId), eq(reels.status, "published")))
    .limit(1);

  if (!reel) return;

  await recordHashtagUsage({
    sourceId: reel.id,
    sourceType: "reel",
    tags: extractHashtags(reel.caption, reel.hashtags),
    userId: reel.userId,
  });
}

export async function getHashtagSuggestions(query: string) {
  const normalizedQuery = query.replace(/^#/, "").toLowerCase();

  return await db
    .select({
      count: hashtagStats.usageCount,
      listingCount: hashtagStats.listingCount,
      reelCount: hashtagStats.reelCount,
      tag: hashtagStats.tag,
    })
    .from(hashtagStats)
    .where(
      normalizedQuery ? ilike(hashtagStats.tag, `${normalizedQuery}%`) : undefined,
    )
    .orderBy(sql`${hashtagStats.usageCount} DESC`, hashtagStats.tag)
    .limit(8);
}
