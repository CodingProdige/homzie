"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";

export type PrivacySettingsState = {
  message: string;
  ok: boolean;
};

const privacySettingsSchema = z.object({
  profileVisible: z.boolean(),
  publicContactVisible: z.boolean(),
  publicPerformanceVisible: z.boolean(),
  searchVisible: z.boolean(),
});

export async function updatePrivacySettings(
  _previousState: PrivacySettingsState,
  formData: FormData,
): Promise<PrivacySettingsState> {
  void _previousState;

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { ok: false, message: "Sign in again to update your privacy settings." };
  }

  const parsed = privacySettingsSchema.safeParse({
    profileVisible: formData.get("profileVisible") === "on",
    publicContactVisible: formData.get("publicContactVisible") === "on",
    publicPerformanceVisible: formData.get("publicPerformanceVisible") === "on",
    searchVisible: formData.get("searchVisible") === "on",
  });

  if (!parsed.success) {
    return { ok: false, message: "We could not save those privacy settings." };
  }

  const [currentUser] = await db
    .select({
      id: users.id,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!currentUser) {
    return { ok: false, message: "We could not find your account." };
  }

  await db
    .update(users)
    .set({
      profileVisible: parsed.data.profileVisible,
      publicContactVisible: parsed.data.publicContactVisible,
      publicPerformanceVisible: parsed.data.publicPerformanceVisible,
      searchVisible: parsed.data.searchVisible,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  revalidatePath("/settings");
  revalidatePath("/settings/privacy");
  revalidatePath("/settings/profile-settings");
  revalidatePath("/listings");

  if (currentUser.username) {
    revalidatePath(`/users/${currentUser.username}`);
    revalidatePath(`/users/${currentUser.username}/reels`);
    revalidatePath(`/users/${currentUser.username}/performance`);
  }

  return { ok: true, message: "Privacy settings updated." };
}
