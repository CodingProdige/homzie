import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import { authOptions } from "@/modules/auth/config";
import { ProfileSettingsForm } from "./profile-settings-form";

function initialsFromName(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "H"
  );
}

export default async function ProfileSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [profile] = await db
    .select({
      name: users.name,
      username: users.username,
      email: users.email,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      location: users.location,
      locationPlaceId: users.locationPlaceId,
      contactEmail: users.contactEmail,
      contactPhone: users.contactPhone,
      whatsappNumber: users.whatsappNumber,
      publicContactVisible: users.publicContactVisible,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!profile?.username) {
    redirect("/onboarding/username");
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1180px] overflow-x-clip bg-background px-4 pb-10 text-foreground sm:px-6 lg:px-10">
      <ProfileSettingsForm
        initialProfile={{
          avatarUrl: toPublicMediaUrl(profile.avatarUrl),
          bio: profile.bio || "",
          contactEmail: profile.contactEmail || profile.email || "",
          contactPhone: profile.contactPhone || "",
          initials: initialsFromName(profile.name),
          location: profile.location || "",
          locationPlaceId: profile.locationPlaceId || "",
          name: profile.name,
          publicContactVisible: profile.publicContactVisible,
          username: profile.username,
          whatsappNumber: profile.whatsappNumber || "",
        }}
      />
    </main>
  );
}
