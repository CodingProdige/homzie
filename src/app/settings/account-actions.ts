"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  agentProfiles,
  propertyListings,
  reels,
  subscriptions,
  users,
} from "@/db/schema";
import { authOptions } from "@/modules/auth/config";

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: string };

function deletedEmail(userId: string, timestamp: number) {
  return `deleted+${userId}-${timestamp}@deleted.homzie.local`;
}

export async function softDeleteCurrentAccount(): Promise<DeleteAccountResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { ok: false, error: "Sign in again to delete your account." };
  }

  const [currentUser] = await db
    .select({
      id: users.id,
      status: users.status,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!currentUser || currentUser.status !== "active") {
    return { ok: false, error: "We could not find an active account to delete." };
  }

  const now = new Date();
  const placeholderEmail = deletedEmail(currentUser.id, now.getTime());

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        avatarUrl: null,
        bio: null,
        contactEmail: null,
        contactPhone: null,
        deletedAt: now,
        email: placeholderEmail,
        emailVerified: false,
        location: null,
        locationPlaceId: null,
        name: "Deleted account",
        passwordHash: null,
        publicContactVisible: false,
        profileVisible: false,
        role: "user",
        searchVisible: false,
        status: "disabled",
        updatedAt: now,
        username: null,
        whatsappNumber: null,
      })
      .where(eq(users.id, currentUser.id));

    await tx
      .update(agentProfiles)
      .set({
        bio: null,
        displayName: "Deleted account",
        headline: null,
        location: null,
        status: "suspended",
        updatedAt: now,
      })
      .where(eq(agentProfiles.userId, currentUser.id));

    await tx
      .update(propertyListings)
      .set({
        archivedAt: now,
        status: "archived",
        updatedAt: now,
      })
      .where(
        and(eq(propertyListings.userId, currentUser.id), eq(propertyListings.status, "published")),
      );

    await tx
      .update(reels)
      .set({
        status: "draft",
        updatedAt: now,
      })
      .where(and(eq(reels.userId, currentUser.id), eq(reels.status, "published")));

    await tx
      .update(subscriptions)
      .set({
        cancelledAt: now,
        status: "cancelled",
        updatedAt: now,
      })
      .where(eq(subscriptions.userId, currentUser.id));
  });

  revalidatePath("/");
  revalidatePath("/agents");
  revalidatePath("/settings");

  if (currentUser.username) {
    revalidatePath(`/users/${currentUser.username}`);
    revalidatePath(`/users/${currentUser.username}/reels`);
    revalidatePath(`/users/${currentUser.username}/performance`);
  }

  return { ok: true };
}
