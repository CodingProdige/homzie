import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { PrivacyForm, type PrivacyFormValues } from "./privacy-form";

export default async function PrivacySettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/settings/privacy");
  }

  const [profile] = await db
    .select({
      profileVisible: users.profileVisible,
      publicContactVisible: users.publicContactVisible,
      searchVisible: users.searchVisible,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!profile?.username) {
    redirect("/onboarding/username");
  }

  const preferences: PrivacyFormValues = {
    profileVisible: profile.profileVisible,
    publicContactVisible: profile.publicContactVisible,
    searchVisible: profile.searchVisible,
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1180px] overflow-x-clip bg-background px-4 pb-10 text-foreground sm:px-6 lg:px-10">
      <PrivacyForm preferences={preferences} />
    </main>
  );
}
