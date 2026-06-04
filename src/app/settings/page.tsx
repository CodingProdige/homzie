import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import { authOptions } from "@/modules/auth/config";
import { SettingsMobileScreen } from "./settings-mobile-screen";

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

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [user] = await db
    .select({
      name: users.name,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.username) {
    redirect("/onboarding/username");
  }

  const initials = initialsFromName(user.name);
  const avatarUrl = toPublicMediaUrl(user.avatarUrl);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SettingsMobileScreen
        avatarUrl={avatarUrl}
        initials={initials}
        name={user.name}
        username={user.username}
      />
    </div>
  );
}
