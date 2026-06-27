"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import {
  profileRoleValues,
  type ProfileRole,
} from "@/modules/users/profile-role";

const profileRoleSchema = z.enum(profileRoleValues);

export async function updateProfileRoleAction(value: ProfileRole) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { ok: false as const, message: "Sign in again to update your profile." };
  }

  const parsed = profileRoleSchema.safeParse(value);

  if (!parsed.success) {
    return { ok: false as const, message: "Choose a valid profile identity." };
  }

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.username) {
    return { ok: false as const, message: "We could not find your profile." };
  }

  await db
    .update(users)
    .set({
      profileRole: parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  revalidatePath("/");
  revalidatePath("/agents");
  revalidatePath("/settings/profile-settings");
  revalidatePath(`/users/${user.username}`);

  return { ok: true as const, profileRole: parsed.data };
}
