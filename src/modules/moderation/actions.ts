"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  moderationCases,
  propertyListings,
  reels,
  users,
} from "@/db/schema";
import { authOptions } from "@/modules/auth/config";

const uuidSchema = z.string().uuid();

const createModerationCaseSchema = z.object({
  details: z.string().trim().max(1200).optional(),
  reason: z.string().trim().min(3).max(120),
  targetId: z.string().trim().min(1).max(160),
  targetType: z.enum(["listing", "profile", "reel"]),
});

export async function requireActiveUserId() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Sign in to submit a report.");
  }

  const [user] = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user || user.status !== "active") {
    throw new Error("Only active accounts can submit reports.");
  }

  return user.id;
}

async function targetForReport(targetType: "listing" | "profile" | "reel", targetId: string) {
  if (targetType === "listing") {
    const parsedId = uuidSchema.safeParse(targetId);

    if (!parsedId.success) throw new Error("Listing report target is invalid.");

    const [listing] = await db
      .select({
        id: propertyListings.id,
        status: propertyListings.status,
        targetUserId: propertyListings.userId,
      })
      .from(propertyListings)
      .where(eq(propertyListings.id, parsedId.data))
      .limit(1);

    if (!listing) throw new Error("Listing could not be found.");

    return {
      listingId: listing.id,
      targetUserId: listing.targetUserId,
    };
  }

  if (targetType === "reel") {
    const parsedId = uuidSchema.safeParse(targetId);

    if (!parsedId.success) throw new Error("Reel report target is invalid.");

    const [reel] = await db
      .select({
        id: reels.id,
        status: reels.status,
        targetUserId: reels.userId,
      })
      .from(reels)
      .where(eq(reels.id, parsedId.data))
      .limit(1);

    if (!reel) throw new Error("Reel could not be found.");

    return {
      reelId: reel.id,
      targetUserId: reel.targetUserId,
    };
  }

  const [profile] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.username, targetId.replace(/^@/, "")),
        eq(users.profileVisible, true),
      ),
    )
    .limit(1);

  if (!profile) throw new Error("Profile could not be found.");

  return {
    targetUserId: profile.id,
  };
}

export async function createModerationCaseAction(
  input: z.input<typeof createModerationCaseSchema>,
) {
  const reporterUserId = await requireActiveUserId();
  const parsed = createModerationCaseSchema.parse(input);
  const target = await targetForReport(parsed.targetType, parsed.targetId);

  if (target.targetUserId === reporterUserId) {
    throw new Error("You cannot report your own content.");
  }

  await db.insert(moderationCases).values({
    caseType: "report",
    details: parsed.details || null,
    listingId: "listingId" in target ? target.listingId : null,
    priority: "normal",
    reason: parsed.reason,
    reelId: "reelId" in target ? target.reelId : null,
    reporterUserId,
    status: "open",
    targetType: parsed.targetType,
    targetUserId: target.targetUserId,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/moderation");

  return { ok: true as const };
}
