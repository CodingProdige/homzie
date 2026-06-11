"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { db } from "@/db";
import { userNotificationPreferences } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { emailNotificationEventKeys } from "@/modules/email/events";

export type NotificationPreferencesState = {
  message: string;
  ok: boolean;
};

export const emptyNotificationPreferencesState: NotificationPreferencesState = {
  message: "",
  ok: false,
};

function isChecked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export async function updateNotificationPreferences(
  _previousState: NotificationPreferencesState = emptyNotificationPreferencesState,
  formData: FormData,
): Promise<NotificationPreferencesState> {
  void _previousState;

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { ok: false, message: "Sign in again to update notifications." };
  }

  const values = {
    callsEnabled: isChecked(formData, "callsEnabled"),
    emailEnabled: isChecked(formData, "emailEnabled"),
    emailEventPreferences: Object.fromEntries(
      emailNotificationEventKeys.map((key) => [
        key,
        isChecked(formData, `emailEvent:${key}`),
      ]),
    ),
    listingActivityEnabled: isChecked(formData, "listingActivityEnabled"),
    marketingEnabled: isChecked(formData, "marketingEnabled"),
    messagesEnabled: isChecked(formData, "messagesEnabled"),
    offersEnabled: isChecked(formData, "offersEnabled"),
    profileActivityEnabled: isChecked(formData, "profileActivityEnabled"),
    pushEnabled: isChecked(formData, "pushEnabled"),
    reelActivityEnabled: isChecked(formData, "reelActivityEnabled"),
    updatedAt: new Date(),
  };

  await db
    .insert(userNotificationPreferences)
    .values({
      ...values,
      userId: session.user.id,
    })
    .onConflictDoUpdate({
      target: userNotificationPreferences.userId,
      set: values,
    });

  revalidatePath("/settings/notifications");

  return { ok: true, message: "Notification settings saved." };
}
