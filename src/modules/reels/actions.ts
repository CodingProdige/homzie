"use server";

import { and, asc, eq, ilike, inArray, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { db } from "@/db";
import {
  propertyListings,
  reelCommentDislikes,
  reelCommentLikes,
  reelComments,
  reelFeedback,
  reelListingClicks,
  reelLikes,
  reelReshares,
  reelSaves,
  reelWatchEvents,
  reelWatchSessions,
  reels,
  userFollows,
  users,
} from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import { authOptions } from "@/modules/auth/config";
import {
  createUserEvent,
  createUserEventOnce,
} from "@/modules/events/server";
import {
  getHashtagSuggestions,
  recordReelHashtagUsage,
} from "@/modules/hashtags/server";
import {
  createReelRenderJob,
  setReelRenderState,
} from "@/modules/reels/server/render-job-state";
import { enqueueReelRenderJob } from "@/modules/reels/server/render-queue";
import { renderPayloadSchema } from "@/modules/reels/server/render-schema";

const reelWatchProgressSchema = z.object({
  completed: z.boolean().optional(),
  durationSeconds: z.number().finite().min(0).max(3600).optional(),
  eventType: z.enum([
    "view",
    "progress",
    "complete",
    "impression",
    "hover",
    "click",
    "share",
    "follow",
  ]),
  progressSeconds: z.number().finite().min(0).max(3600).optional(),
  reelId: z.string().uuid(),
  source: z.string().trim().min(1).max(64).optional(),
  viewerSessionId: z.string().trim().min(8).max(128),
  watchSeconds: z.number().finite().min(0).max(300).optional(),
});

const reelIdSchema = z.string().uuid();
const commentIdSchema = z.string().uuid();
const reelListingLinkSchema = z.object({
  listingId: z.string().uuid().nullable(),
  reelId: z.string().uuid(),
});
const reelListingClickSchema = z.object({
  listingId: z.string().uuid(),
  reelId: z.string().uuid(),
  source: z.string().trim().min(1).max(64).optional(),
  viewerSessionId: z.string().trim().min(8).max(128),
});
const reelFeedbackSchema = z.object({
  feedbackType: z.enum(["not_interested", "dismiss_home_popup", "fast_skip"]),
  reelId: z.string().uuid(),
  source: z.string().trim().min(1).max(64).optional(),
  viewerSessionId: z.string().trim().min(8).max(128),
});
const reelCommentSchema = z.object({
  body: z.string().trim().max(500),
  mediaUrl: z
    .string()
    .refine(
      (value) => value.startsWith("data:image/") || z.string().url().safeParse(value).success,
      "Use a valid image or GIF.",
    )
    .optional()
    .nullable(),
  parentId: z.string().uuid().optional().nullable(),
  reelId: z.string().uuid(),
});
const editReelCommentSchema = z.object({
  body: z.string().trim().max(500),
  commentId: z.string().uuid(),
  mediaUrl: z
    .string()
    .refine(
      (value) => value.startsWith("data:image/") || z.string().url().safeParse(value).success,
      "Use a valid image or GIF.",
    )
    .optional()
    .nullable(),
});
const reelCoverFrameSchema = z
  .object({
    clipId: z.string().trim().min(1).max(160),
    src: z.string().refine(
      (value) => value.startsWith("data:image/") || z.string().url().safeParse(value).success,
      "Use a valid cover image.",
    ),
    time: z.number().finite().min(0).max(3600),
  })
  .nullable();
const reelPostOptionsSchema = z.object({
  aiGenerated: z.boolean(),
  allowComments: z.boolean(),
  allowReuse: z.boolean(),
  autoCheckSound: z.boolean(),
});
const publishedReelDetailsSchema = z.object({
  caption: z.string().trim().max(1000),
  coverFrame: reelCoverFrameSchema,
  location: z.string().trim().max(180).optional(),
  options: reelPostOptionsSchema,
  privacy: z.string().trim().max(80),
  reelId: z.string().uuid(),
});

function formatCompactCount(value: number) {
  if (value < 1000) {
    return String(value);
  }

  const compactValue = value / 1000;

  return `${Number.isInteger(compactValue) ? compactValue.toFixed(0) : compactValue.toFixed(1)}K`;
}

function viewMilestoneForCount(count: number) {
  if ([10, 25, 50, 100, 250, 500].includes(count)) return count;
  if (count >= 1000 && count % 1000 === 0) return count;

  return null;
}

function reelTitle(value: { caption: string | null; listingReference: string | null }) {
  const title = value.listingReference || value.caption?.trim();

  return title ? title.slice(0, 80) : "your reel";
}

async function requireUserId() {
  const session = await getServerSession(authOptions);

  return session?.user?.id || null;
}

export async function getReelHashtagSuggestions(query: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return [];
  }

  return await getHashtagSuggestions(query);
}

export async function getReelMentionSuggestions(query: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return [];
  }

  const normalizedQuery = query.replace(/^@/, "").toLowerCase();
  const suggestions = await db
    .select({
      avatarUrl: users.avatarUrl,
      name: users.name,
      username: users.username,
    })
    .from(users)
    .where(
      normalizedQuery
        ? and(eq(users.status, "active"), ilike(users.username, `${normalizedQuery}%`))
        : and(eq(users.status, "active"), isNotNull(users.username)),
    )
    .limit(8);

  return suggestions
    .filter((user) => user.username)
    .map((user) => ({
      ...user,
      avatarUrl: toPublicMediaUrl(user.avatarUrl),
    }));
}

export async function trackReelWatchProgress(input: unknown) {
  const parsed = reelWatchProgressSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false as const };
  }

  const session = await getServerSession(authOptions);
  const durationSeconds = Math.round(parsed.data.durationSeconds || 0);
  const progressSeconds = Math.round(parsed.data.progressSeconds || 0);
  const progressPercent =
    durationSeconds > 0
      ? Math.min(100, Math.max(0, Math.round((progressSeconds / durationSeconds) * 100)))
      : 0;
  const completed =
    parsed.data.completed ||
    parsed.data.eventType === "complete" ||
    (durationSeconds > 0 && progressPercent >= 95);
  const watchSeconds = Math.round(parsed.data.watchSeconds || 0);
  const source = parsed.data.source || "feed";
  const isWatchEvent = ["view", "progress", "complete"].includes(
    parsed.data.eventType,
  );

  const [reel] = await db
    .select({
      caption: reels.caption,
      id: reels.id,
      listingReference: reels.listingReference,
      userId: reels.userId,
    })
    .from(reels)
    .where(and(eq(reels.id, parsed.data.reelId), eq(reels.status, "published")))
    .limit(1);

  if (!reel) {
    return { ok: false as const };
  }

  const [insertedSession] = isWatchEvent
    ? await db
        .insert(reelWatchSessions)
        .values({
          completed,
          durationSeconds,
          lastProgressSeconds: progressSeconds,
          maxProgressPercent: progressPercent,
          maxProgressSeconds: progressSeconds,
          reelId: parsed.data.reelId,
          source,
          totalWatchSeconds: watchSeconds,
          viewerSessionId: parsed.data.viewerSessionId,
          viewerUserId: session?.user?.id || null,
        })
        .onConflictDoNothing()
        .returning({ id: reelWatchSessions.id })
    : [];

  if (insertedSession) {
    await db
      .update(reels)
      .set({
        viewCount: sql`${reels.viewCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(reels.id, parsed.data.reelId));

    const [{ count }] = await db
      .select({ count: reels.viewCount })
      .from(reels)
      .where(eq(reels.id, parsed.data.reelId));
    const milestone = viewMilestoneForCount(count);

    if (milestone && reel.userId !== session?.user?.id) {
      await createUserEventOnce({
        actorUserId: session?.user?.id || null,
        dedupeKey: `reel:${reel.id}:views:${milestone}`,
        entityId: reel.id,
        entityType: "reel",
        eventType: "reel.views.milestone",
        metadata: { count: milestone, reelTitle: reelTitle(reel) },
        reelId: reel.id,
        userId: reel.userId,
      });
    }
  }

  if (isWatchEvent) {
    await db
      .update(reelWatchSessions)
      .set({
        completed: sql`${reelWatchSessions.completed} OR ${completed}`,
        durationSeconds: sql`GREATEST(${reelWatchSessions.durationSeconds}, ${durationSeconds})`,
        lastProgressSeconds: progressSeconds,
        lastWatchedAt: new Date(),
        maxProgressPercent: sql`GREATEST(${reelWatchSessions.maxProgressPercent}, ${progressPercent})`,
        maxProgressSeconds: sql`GREATEST(${reelWatchSessions.maxProgressSeconds}, ${progressSeconds})`,
        source,
        totalWatchSeconds: sql`${reelWatchSessions.totalWatchSeconds} + ${watchSeconds}`,
        updatedAt: new Date(),
        viewerUserId: session?.user?.id || null,
      })
      .where(
        and(
          eq(reelWatchSessions.reelId, parsed.data.reelId),
          eq(reelWatchSessions.viewerSessionId, parsed.data.viewerSessionId),
        ),
      );
  }

  await db.insert(reelWatchEvents).values({
    completed,
    durationSeconds,
    eventType: parsed.data.eventType,
    progressPercent,
    progressSeconds,
    reelId: parsed.data.reelId,
    source,
    viewerSessionId: parsed.data.viewerSessionId,
    viewerUserId: session?.user?.id || null,
    watchSeconds,
  });

  return { ok: true as const };
}

export async function recordReelFeedback(input: unknown) {
  const parsed = reelFeedbackSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false as const };
  }

  const session = await getServerSession(authOptions);
  const source = parsed.data.source || "feed";

  const [reel] = await db
    .select({ id: reels.id })
    .from(reels)
    .where(and(eq(reels.id, parsed.data.reelId), eq(reels.status, "published")))
    .limit(1);

  if (!reel) {
    return { ok: false as const };
  }

  await db
    .insert(reelFeedback)
    .values({
      feedbackType: parsed.data.feedbackType,
      reelId: parsed.data.reelId,
      source,
      viewerSessionId: parsed.data.viewerSessionId,
      viewerUserId: session?.user?.id || null,
    })
    .onConflictDoUpdate({
      target: [
        reelFeedback.reelId,
        reelFeedback.viewerSessionId,
        reelFeedback.feedbackType,
      ],
      set: {
        source,
        updatedAt: new Date(),
        viewerUserId: session?.user?.id || null,
      },
    });

  return { ok: true as const };
}

export async function toggleProfileFollow(targetUsername: string) {
  const userId = await requireUserId();

  if (!userId) {
    return { error: "Sign in to follow profiles.", ok: false as const };
  }

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, targetUsername), eq(users.status, "active")))
    .limit(1);

  if (!target) {
    return { error: "We could not find that profile.", ok: false as const };
  }

  if (target.id === userId) {
    return { error: "You cannot follow your own profile.", ok: false as const };
  }

  const [existing] = await db
    .select({ followerId: userFollows.followerId })
    .from(userFollows)
    .where(
      and(eq(userFollows.followerId, userId), eq(userFollows.followingId, target.id)),
    )
    .limit(1);

  if (existing) {
    await db
      .delete(userFollows)
      .where(
        and(
          eq(userFollows.followerId, userId),
          eq(userFollows.followingId, target.id),
        ),
      );

    return { following: false, ok: true as const };
  }

  await db.insert(userFollows).values({
    followerId: userId,
    followingId: target.id,
  });

  await createUserEvent({
    actorUserId: userId,
    entityId: target.id,
    entityType: "profile",
    eventType: "profile.followed",
    userId: target.id,
  });

  return { following: true, ok: true as const };
}

export async function toggleReelLike(reelId: string) {
  const parsed = reelIdSchema.safeParse(reelId);
  const userId = await requireUserId();

  if (!parsed.success || !userId) {
    return { error: "Sign in to like reels.", ok: false as const };
  }

  const [reel] = await db
    .select({
      caption: reels.caption,
      id: reels.id,
      listingReference: reels.listingReference,
      userId: reels.userId,
    })
    .from(reels)
    .where(and(eq(reels.id, parsed.data), eq(reels.status, "published")))
    .limit(1);

  if (!reel) {
    return { error: "We could not find that reel.", ok: false as const };
  }

  const [existing] = await db
    .select({ reelId: reelLikes.reelId })
    .from(reelLikes)
    .where(and(eq(reelLikes.reelId, parsed.data), eq(reelLikes.userId, userId)))
    .limit(1);

  if (existing) {
    await db
      .delete(reelLikes)
      .where(and(eq(reelLikes.reelId, parsed.data), eq(reelLikes.userId, userId)));
  } else {
    await db.insert(reelLikes).values({ reelId: parsed.data, userId });

    await createUserEvent({
      actorUserId: userId,
      entityId: reel.id,
      entityType: "reel",
      eventType: "reel.liked",
      metadata: { reelTitle: reelTitle(reel) },
      reelId: reel.id,
      userId: reel.userId,
    });
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reelLikes)
    .where(eq(reelLikes.reelId, parsed.data));

  return {
    count,
    countLabel: formatCompactCount(count),
    liked: !existing,
    ok: true as const,
  };
}

export async function toggleReelSave(reelId: string) {
  const parsed = reelIdSchema.safeParse(reelId);
  const userId = await requireUserId();

  if (!parsed.success || !userId) {
    return { error: "Sign in to save reels.", ok: false as const };
  }

  const [reel] = await db
    .select({
      caption: reels.caption,
      id: reels.id,
      listingReference: reels.listingReference,
      userId: reels.userId,
    })
    .from(reels)
    .where(and(eq(reels.id, parsed.data), eq(reels.status, "published")))
    .limit(1);

  if (!reel) {
    return { error: "We could not find that reel.", ok: false as const };
  }

  const [existing] = await db
    .select({ reelId: reelSaves.reelId })
    .from(reelSaves)
    .where(and(eq(reelSaves.reelId, parsed.data), eq(reelSaves.userId, userId)))
    .limit(1);

  if (existing) {
    await db
      .delete(reelSaves)
      .where(and(eq(reelSaves.reelId, parsed.data), eq(reelSaves.userId, userId)));
  } else {
    await db.insert(reelSaves).values({ reelId: parsed.data, userId });

    await createUserEvent({
      actorUserId: userId,
      entityId: reel.id,
      entityType: "reel",
      eventType: "reel.saved",
      metadata: { reelTitle: reelTitle(reel) },
      reelId: reel.id,
      userId: reel.userId,
    });
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reelSaves)
    .where(eq(reelSaves.reelId, parsed.data));

  return {
    count,
    countLabel: formatCompactCount(count),
    ok: true as const,
    saved: !existing,
  };
}

export async function toggleReelReshare(reelId: string) {
  const parsed = reelIdSchema.safeParse(reelId);
  const userId = await requireUserId();

  if (!parsed.success || !userId) {
    return { error: "Sign in to reshare reels.", ok: false as const };
  }

  const [reel] = await db
    .select({
      caption: reels.caption,
      id: reels.id,
      listingReference: reels.listingReference,
      userId: reels.userId,
    })
    .from(reels)
    .where(and(eq(reels.id, parsed.data), eq(reels.status, "published")))
    .limit(1);

  if (!reel) {
    return { error: "We could not find that reel.", ok: false as const };
  }

  if (reel.userId === userId) {
    return { error: "You cannot reshare your own reel.", ok: false as const };
  }

  const [existing] = await db
    .select({ reelId: reelReshares.reelId })
    .from(reelReshares)
    .where(and(eq(reelReshares.reelId, parsed.data), eq(reelReshares.userId, userId)))
    .limit(1);

  if (existing) {
    await db
      .delete(reelReshares)
      .where(
        and(eq(reelReshares.reelId, parsed.data), eq(reelReshares.userId, userId)),
      );
  } else {
    await db.insert(reelReshares).values({ reelId: parsed.data, userId });

    await createUserEvent({
      actorUserId: userId,
      entityId: reel.id,
      entityType: "reel",
      eventType: "reel.reshared",
      metadata: { reelTitle: reelTitle(reel) },
      reelId: reel.id,
      userId: reel.userId,
    });
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reelReshares)
    .where(eq(reelReshares.reelId, parsed.data));

  return {
    count,
    countLabel: formatCompactCount(count),
    ok: true as const,
    reshared: !existing,
  };
}

export async function getReelOwnerListings(reelId: string) {
  const parsed = reelIdSchema.safeParse(reelId);
  const userId = await requireUserId();

  if (!parsed.success || !userId) {
    return { error: "Sign in to link listings.", listings: [], ok: false as const };
  }

  const [reel] = await db
    .select({
      listingId: reels.listingId,
      userId: reels.userId,
    })
    .from(reels)
    .where(eq(reels.id, parsed.data))
    .limit(1);

  if (!reel || reel.userId !== userId) {
    return {
      error: "Only the reel owner can link a listing.",
      listings: [],
      ok: false as const,
    };
  }

  const listings = await db
    .select({
      coverImageUrl: propertyListings.coverImageUrl,
      id: propertyListings.id,
      location: propertyListings.location,
      priceCents: propertyListings.askingPriceCents,
      priceLabel: propertyListings.priceLabel,
      status: propertyListings.status,
      title: propertyListings.title,
    })
    .from(propertyListings)
    .where(eq(propertyListings.userId, userId))
    .orderBy(sql`${propertyListings.updatedAt} DESC`);

  return {
    linkedListingId: reel.listingId,
    listings: listings.map((listing) => ({
      ...listing,
      coverImageUrl: toPublicMediaUrl(listing.coverImageUrl),
    })),
    ok: true as const,
  };
}

export async function deleteReel(formData: FormData) {
  const parsed = reelIdSchema.safeParse(formData.get("reelId"));
  const userId = await requireUserId();

  if (!parsed.success || !userId) {
    redirect("/sign-in");
  }

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.username) {
    redirect("/onboarding/username");
  }

  const [reel] = await db
    .select({ id: reels.id })
    .from(reels)
    .where(and(eq(reels.id, parsed.data), eq(reels.userId, userId)))
    .limit(1);

  if (!reel) {
    throw new Error("Reel not found.");
  }

  await db.delete(reels).where(and(eq(reels.id, parsed.data), eq(reels.userId, userId)));

  redirect(`/users/${user.username}?tab=reels`);
}

export async function deleteReelById(reelId: string) {
  const parsed = reelIdSchema.safeParse(reelId);
  const userId = await requireUserId();

  if (!parsed.success || !userId) {
    return { error: "Sign in to delete this reel.", ok: false as const };
  }

  const [reel] = await db
    .select({
      id: reels.id,
      username: users.username,
    })
    .from(reels)
    .innerJoin(users, eq(users.id, reels.userId))
    .where(and(eq(reels.id, parsed.data), eq(reels.userId, userId)))
    .limit(1);

  if (!reel) {
    return { error: "We could not find that reel.", ok: false as const };
  }

  await db.delete(reels).where(and(eq(reels.id, parsed.data), eq(reels.userId, userId)));

  if (reel.username) {
    revalidatePath(`/users/${reel.username}`);
    revalidatePath(`/users/${reel.username}/reels`);
  }

  return { ok: true as const };
}

export async function linkReelListing(input: unknown) {
  const parsed = reelListingLinkSchema.safeParse(input);
  const userId = await requireUserId();

  if (!parsed.success || !userId) {
    return { error: "Sign in to link listings.", ok: false as const };
  }

  const [reel] = await db
    .select({
      id: reels.id,
      userId: reels.userId,
    })
    .from(reels)
    .where(eq(reels.id, parsed.data.reelId))
    .limit(1);

  if (!reel || reel.userId !== userId) {
    return { error: "Only the reel owner can link a listing.", ok: false as const };
  }

  if (!parsed.data.listingId) {
    await db
      .update(reels)
      .set({
        listingId: null,
        listingReference: null,
        updatedAt: new Date(),
      })
      .where(eq(reels.id, parsed.data.reelId));

    return {
      linkedListing: null,
      linkedListingId: null,
      listingReference: null,
      ok: true as const,
    };
  }

  const [listing] = await db
    .select({
      coverImageUrl: propertyListings.coverImageUrl,
      id: propertyListings.id,
      location: propertyListings.location,
      priceCents: propertyListings.askingPriceCents,
      priceLabel: propertyListings.priceLabel,
      status: propertyListings.status,
      title: propertyListings.title,
      userId: propertyListings.userId,
    })
    .from(propertyListings)
    .where(eq(propertyListings.id, parsed.data.listingId))
    .limit(1);

  if (!listing || listing.userId !== userId) {
    return {
      error: "You can only link one of your own listings.",
      ok: false as const,
    };
  }

  await db
    .update(reels)
    .set({
      listingId: listing.id,
      listingReference: listing.title,
      updatedAt: new Date(),
    })
    .where(eq(reels.id, parsed.data.reelId));

  return {
    linkedListingId: listing.id,
    linkedListing: {
      coverImageUrl: toPublicMediaUrl(listing.coverImageUrl),
      id: listing.id,
      location: listing.location,
      priceCents: listing.priceCents,
      priceLabel: listing.priceLabel,
      status: listing.status,
      title: listing.title,
    },
    listingReference: listing.title,
    ok: true as const,
  };
}

export async function updatePublishedReelDetails(input: unknown) {
  const parsed = publishedReelDetailsSchema.safeParse(input);
  const userId = await requireUserId();

  if (!parsed.success || !userId) {
    return { error: "Check your reel details.", ok: false as const };
  }

  const [reel] = await db
    .select({
      editMetadata: reels.editMetadata,
      id: reels.id,
      status: reels.status,
      userId: reels.userId,
    })
    .from(reels)
    .where(eq(reels.id, parsed.data.reelId))
    .limit(1);

  if (!reel || reel.userId !== userId) {
    return { error: "Reel not found.", ok: false as const };
  }

  if (reel.status !== "published") {
    return {
      error: "Only published reel details can be edited here.",
      ok: false as const,
    };
  }

  const metadata = metadataObject(reel.editMetadata);
  const hashtags = Array.from(parsed.data.caption.matchAll(/#([a-z0-9_]{2,40})/gi))
    .map((match) => `#${match[1].toLowerCase()}`)
    .join(" ");

  await db
    .update(reels)
    .set({
      caption: parsed.data.caption || null,
      coverTimeSeconds: Math.round(parsed.data.coverFrame?.time || 0),
      editMetadata: {
        ...metadata,
        coverFrame: parsed.data.coverFrame,
        location: parsed.data.location || null,
        options: parsed.data.options,
        privacy: parsed.data.privacy,
      },
      hashtags,
      listingReference: parsed.data.location || null,
      updatedAt: new Date(),
    })
    .where(and(eq(reels.id, parsed.data.reelId), eq(reels.userId, userId)));

  if (hashtags) {
    await recordReelHashtagUsage(parsed.data.reelId);
  }

  return { ok: true as const };
}

export async function trackReelListingClick(input: unknown) {
  const parsed = reelListingClickSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false as const };
  }

  const session = await getServerSession(authOptions);
  const source = parsed.data.source || "feed";
  const [linkedReel] = await db
    .select({
      id: reels.id,
      listingId: reels.listingId,
    })
    .from(reels)
    .where(
      and(
        eq(reels.id, parsed.data.reelId),
        eq(reels.status, "published"),
        eq(reels.listingId, parsed.data.listingId),
      ),
    )
    .limit(1);

  if (!linkedReel?.listingId) {
    return { ok: false as const };
  }

  await db.insert(reelListingClicks).values({
    listingId: parsed.data.listingId,
    reelId: parsed.data.reelId,
    source,
    viewerSessionId: parsed.data.viewerSessionId,
    viewerUserId: session?.user?.id || null,
  });

  return { ok: true as const };
}

export async function getReelComments(reelId: string) {
  const parsed = reelIdSchema.safeParse(reelId);
  const userId = await requireUserId();

  if (!parsed.success) {
    return { comments: [], count: 0, ok: false as const };
  }

  const comments = await db
    .select({
      avatarUrl: users.avatarUrl,
      body: reelComments.body,
      createdAt: reelComments.createdAt,
      id: reelComments.id,
      mediaUrl: reelComments.mediaUrl,
      name: users.name,
      parentId: reelComments.parentId,
      username: users.username,
      userId: reelComments.userId,
    })
    .from(reelComments)
    .innerJoin(users, eq(users.id, reelComments.userId))
    .where(eq(reelComments.reelId, parsed.data))
    .orderBy(asc(reelComments.createdAt));

  const commentIds = comments.map((comment) => comment.id);
  const dislikesByComment = new Map<string, number>();
  const dislikedCommentIds = new Set<string>();
  const likesByComment = new Map<string, number>();
  const likedCommentIds = new Set<string>();

  if (commentIds.length) {
    const dislikeCounts = await db
      .select({
        commentId: reelCommentDislikes.commentId,
        count: sql<number>`count(*)::int`,
      })
      .from(reelCommentDislikes)
      .where(inArray(reelCommentDislikes.commentId, commentIds))
      .groupBy(reelCommentDislikes.commentId);
    const likeCounts = await db
      .select({
        commentId: reelCommentLikes.commentId,
        count: sql<number>`count(*)::int`,
      })
      .from(reelCommentLikes)
      .where(inArray(reelCommentLikes.commentId, commentIds))
      .groupBy(reelCommentLikes.commentId);

    dislikeCounts.forEach((row) => dislikesByComment.set(row.commentId, row.count));
    likeCounts.forEach((row) => likesByComment.set(row.commentId, row.count));

    if (userId) {
      const viewerDislikes = await db
        .select({ commentId: reelCommentDislikes.commentId })
        .from(reelCommentDislikes)
        .where(
          and(
            inArray(reelCommentDislikes.commentId, commentIds),
            eq(reelCommentDislikes.userId, userId),
          ),
        );
      const viewerLikes = await db
        .select({ commentId: reelCommentLikes.commentId })
        .from(reelCommentLikes)
        .where(
          and(
            inArray(reelCommentLikes.commentId, commentIds),
            eq(reelCommentLikes.userId, userId),
          ),
        );

      viewerDislikes.forEach((row) => dislikedCommentIds.add(row.commentId));
      viewerLikes.forEach((row) => likedCommentIds.add(row.commentId));
    }
  }

  return {
    comments: comments.map((comment) => ({
      ...comment,
      avatarUrl: toPublicMediaUrl(comment.avatarUrl),
      createdAtLabel: comment.createdAt.toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "numeric",
      }),
      dislikedByViewer: dislikedCommentIds.has(comment.id),
      dislikeCount: dislikesByComment.get(comment.id) || 0,
      dislikeCountLabel: formatCompactCount(dislikesByComment.get(comment.id) || 0),
      isOwnComment: comment.userId === userId,
      likedByViewer: likedCommentIds.has(comment.id),
      likeCount: likesByComment.get(comment.id) || 0,
      likeCountLabel: formatCompactCount(likesByComment.get(comment.id) || 0),
    })),
    count: comments.length,
    ok: true as const,
  };
}

export async function createReelComment(input: unknown) {
  const parsed = reelCommentSchema.safeParse(input);
  const userId = await requireUserId();

  if (!parsed.success || !userId) {
    return { error: "Sign in to comment.", ok: false as const };
  }

  if (!parsed.data.body && !parsed.data.mediaUrl) {
    return { error: "Add a comment or attach media.", ok: false as const };
  }

  const [reel] = await db
    .select({ id: reels.id })
    .from(reels)
    .where(and(eq(reels.id, parsed.data.reelId), eq(reels.status, "published")))
    .limit(1);

  if (!reel) {
    return { error: "We could not find that reel.", ok: false as const };
  }

  if (parsed.data.parentId) {
    const [parent] = await db
      .select({ id: reelComments.id })
      .from(reelComments)
      .where(
        and(
          eq(reelComments.id, parsed.data.parentId),
          eq(reelComments.reelId, parsed.data.reelId),
        ),
      )
      .limit(1);

    if (!parent) {
      return { error: "We could not find that comment.", ok: false as const };
    }
  }

  await db.insert(reelComments).values({
    body: parsed.data.body,
    mediaUrl: parsed.data.mediaUrl || null,
    parentId: parsed.data.parentId || null,
    reelId: parsed.data.reelId,
    userId,
  });

  return await getReelComments(parsed.data.reelId);
}

export async function deleteReelComment(commentId: string) {
  const parsed = commentIdSchema.safeParse(commentId);
  const userId = await requireUserId();

  if (!parsed.success || !userId) {
    return { error: "Sign in to delete comments.", ok: false as const };
  }

  const [comment] = await db
    .select({
      id: reelComments.id,
      reelId: reelComments.reelId,
      userId: reelComments.userId,
    })
    .from(reelComments)
    .where(eq(reelComments.id, parsed.data))
    .limit(1);

  if (!comment) {
    return { error: "We could not find that comment.", ok: false as const };
  }

  if (comment.userId !== userId) {
    return { error: "You can only delete your own comments.", ok: false as const };
  }

  await db.delete(reelComments).where(eq(reelComments.id, parsed.data));

  return await getReelComments(comment.reelId);
}

export async function editReelComment(input: unknown) {
  const parsed = editReelCommentSchema.safeParse(input);
  const userId = await requireUserId();

  if (!parsed.success || !userId) {
    return { error: "Sign in to edit comments.", ok: false as const };
  }

  if (!parsed.data.body && !parsed.data.mediaUrl) {
    return { error: "Add a comment or attach media.", ok: false as const };
  }

  const [comment] = await db
    .select({
      id: reelComments.id,
      reelId: reelComments.reelId,
      userId: reelComments.userId,
    })
    .from(reelComments)
    .where(eq(reelComments.id, parsed.data.commentId))
    .limit(1);

  if (!comment) {
    return { error: "We could not find that comment.", ok: false as const };
  }

  if (comment.userId !== userId) {
    return { error: "You can only edit your own comments.", ok: false as const };
  }

  await db
    .update(reelComments)
    .set({
      body: parsed.data.body,
      mediaUrl: parsed.data.mediaUrl || null,
      updatedAt: new Date(),
    })
    .where(eq(reelComments.id, parsed.data.commentId));

  return await getReelComments(comment.reelId);
}

export async function toggleReelCommentLike(commentId: string) {
  const parsed = commentIdSchema.safeParse(commentId);
  const userId = await requireUserId();

  if (!parsed.success || !userId) {
    return { error: "Sign in to like comments.", ok: false as const };
  }

  const [existing] = await db
    .select({ commentId: reelCommentLikes.commentId })
    .from(reelCommentLikes)
    .where(
      and(eq(reelCommentLikes.commentId, parsed.data), eq(reelCommentLikes.userId, userId)),
    )
    .limit(1);

  if (existing) {
    await db
      .delete(reelCommentLikes)
      .where(
        and(
          eq(reelCommentLikes.commentId, parsed.data),
          eq(reelCommentLikes.userId, userId),
        ),
      );
  } else {
    await db
      .delete(reelCommentDislikes)
      .where(
        and(
          eq(reelCommentDislikes.commentId, parsed.data),
          eq(reelCommentDislikes.userId, userId),
        ),
      );
    await db.insert(reelCommentLikes).values({
      commentId: parsed.data,
      userId,
    });
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reelCommentLikes)
    .where(eq(reelCommentLikes.commentId, parsed.data));
  const [{ count: dislikeCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reelCommentDislikes)
    .where(eq(reelCommentDislikes.commentId, parsed.data));

  return {
    dislikeCount,
    dislikeCountLabel: formatCompactCount(dislikeCount),
    disliked: false,
    count,
    countLabel: formatCompactCount(count),
    liked: !existing,
    ok: true as const,
  };
}

export async function toggleReelCommentDislike(commentId: string) {
  const parsed = commentIdSchema.safeParse(commentId);
  const userId = await requireUserId();

  if (!parsed.success || !userId) {
    return { error: "Sign in to dislike comments.", ok: false as const };
  }

  const [existing] = await db
    .select({ commentId: reelCommentDislikes.commentId })
    .from(reelCommentDislikes)
    .where(
      and(
        eq(reelCommentDislikes.commentId, parsed.data),
        eq(reelCommentDislikes.userId, userId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .delete(reelCommentDislikes)
      .where(
        and(
          eq(reelCommentDislikes.commentId, parsed.data),
          eq(reelCommentDislikes.userId, userId),
        ),
      );
  } else {
    await db
      .delete(reelCommentLikes)
      .where(
        and(
          eq(reelCommentLikes.commentId, parsed.data),
          eq(reelCommentLikes.userId, userId),
        ),
      );
    await db.insert(reelCommentDislikes).values({
      commentId: parsed.data,
      userId,
    });
  }

  const [{ count: likeCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reelCommentLikes)
    .where(eq(reelCommentLikes.commentId, parsed.data));
  const [{ count: dislikeCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reelCommentDislikes)
    .where(eq(reelCommentDislikes.commentId, parsed.data));

  return {
    dislikeCount,
    dislikeCountLabel: formatCompactCount(dislikeCount),
    disliked: !existing,
    likeCount,
    likeCountLabel: formatCompactCount(likeCount),
    liked: false,
    ok: true as const,
  };
}

function metadataObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function getRenderTargetStatus(
  render: Record<string, unknown>,
): "draft" | "published" {
  return render.targetStatus === "draft" || render.targetStatus === "published"
    ? render.targetStatus
    : "published";
}

export async function retryReelRender(reelId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { error: "Sign in to retry this reel.", ok: false as const };
  }

  const [reel] = await db
    .select({
      editMetadata: reels.editMetadata,
      id: reels.id,
      status: reels.status,
    })
    .from(reels)
    .where(and(eq(reels.id, reelId), eq(reels.userId, session.user.id)))
    .limit(1);

  if (!reel) {
    return { error: "We could not find that reel.", ok: false as const };
  }

  const metadata = metadataObject(reel.editMetadata);
  const render = metadataObject(metadata.render);
  const parsedPayload = renderPayloadSchema.safeParse(metadata.renderPayload);

  if (!parsedPayload.success) {
    return {
      error: "This reel is missing the saved render details needed to retry.",
      ok: false as const,
    };
  }

  const targetStatus = getRenderTargetStatus(render);
  const baseMetadata = {
    ...metadata,
    renderPayload: parsedPayload.data,
  };
  const job = createReelRenderJob({
    baseMetadata,
    payload: parsedPayload.data,
    reelId: reel.id,
    targetStatus,
  });

  await setReelRenderState({
    baseMetadata,
    reelId: reel.id,
    render: {
      jobId: job.id,
      progress: 5,
      status: "queued",
    },
    targetStatus,
    values: { status: "processing" },
  });

  try {
    await enqueueReelRenderJob(job);
  } catch (error) {
    await setReelRenderState({
      baseMetadata,
      reelId: reel.id,
      render: {
        error:
          error instanceof Error
            ? error.message
            : "Could not queue this reel for processing.",
        jobId: job.id,
        progress: 100,
        status: "failed",
      },
      targetStatus,
      values: { status: "failed" },
    });

    return {
      error: "We could not restart processing right now. Please try again.",
      ok: false as const,
    };
  }

  return {
    ok: true as const,
    progress: 5,
    reelId: reel.id,
    targetStatus,
  };
}
