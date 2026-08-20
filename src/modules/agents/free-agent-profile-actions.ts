"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { agentProfiles, users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { isAgencyProfileRole } from "@/modules/users/profile-role";

/**
 * Activates the free publishing layer for an individual agent. This intentionally
 * does not grant paid buyer-intent access or create a Stripe subscription.
 */
export async function activateFreeAgentProfile() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/register?callbackUrl=/for-agents");
  }

  const [user] = await db
    .select({
      id: users.id,
      location: users.location,
      locationCity: users.locationCity,
      locationCountry: users.locationCountry,
      locationPlaceData: users.locationPlaceData,
      locationPlaceId: users.locationPlaceId,
      locationProvince: users.locationProvince,
      locationSuburb: users.locationSuburb,
      name: users.name,
      profileRole: users.profileRole,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.username) {
    redirect("/onboarding/username?callbackUrl=/for-agents");
  }

  if (isAgencyProfileRole(user.profileRole)) {
    redirect("/for-agents?notice=agency-profile");
  }

  const [existingProfile] = await db
    .select({ status: agentProfiles.status })
    .from(agentProfiles)
    .where(eq(agentProfiles.userId, user.id))
    .limit(1);

  if (existingProfile?.status === "suspended") {
    redirect("/for-agents?notice=profile-suspended");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        profileRole: "property_agent",
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await tx
      .insert(agentProfiles)
      .values({
        userId: user.id,
        displayName: user.name,
        headline: "Real estate agent",
        location: user.location,
        locationCity: user.locationCity,
        locationCountry: user.locationCountry,
        locationPlaceData: user.locationPlaceData,
        locationPlaceId: user.locationPlaceId,
        locationProvince: user.locationProvince,
        locationSuburb: user.locationSuburb,
        status: "active",
      })
      .onConflictDoUpdate({
        target: agentProfiles.userId,
        set: {
          status: "active",
          updatedAt: new Date(),
        },
        where: ne(agentProfiles.status, "suspended"),
      });
  });

  revalidatePath("/");
  revalidatePath("/agents");
  revalidatePath("/for-agents");
  revalidatePath(`/users/${user.username}`);

  redirect("/settings/profile-settings?agentProfile=free");
}
