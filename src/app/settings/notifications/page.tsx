import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { userNotificationPreferences } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import {
  NotificationsForm,
  type NotificationPreferencesFormValues,
} from "./notifications-form";

const defaultPreferences: NotificationPreferencesFormValues = {
  callsEnabled: true,
  emailEnabled: false,
  listingActivityEnabled: true,
  marketingEnabled: false,
  messagesEnabled: true,
  offersEnabled: true,
  profileActivityEnabled: true,
  pushEnabled: true,
  reelActivityEnabled: true,
};

export default async function NotificationSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/settings/notifications");
  }

  const [savedPreferences] = await db
    .select()
    .from(userNotificationPreferences)
    .where(eq(userNotificationPreferences.userId, session.user.id))
    .limit(1);

  const preferences: NotificationPreferencesFormValues = savedPreferences
    ? {
        callsEnabled: savedPreferences.callsEnabled,
        emailEnabled: savedPreferences.emailEnabled,
        listingActivityEnabled: savedPreferences.listingActivityEnabled,
        marketingEnabled: savedPreferences.marketingEnabled,
        messagesEnabled: savedPreferences.messagesEnabled,
        offersEnabled: savedPreferences.offersEnabled,
        profileActivityEnabled: savedPreferences.profileActivityEnabled,
        pushEnabled: savedPreferences.pushEnabled,
        reelActivityEnabled: savedPreferences.reelActivityEnabled,
      }
    : defaultPreferences;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1180px] overflow-x-clip bg-background px-4 pb-10 text-foreground sm:px-6 lg:px-10">
      <NotificationsForm preferences={preferences} />
    </main>
  );
}
