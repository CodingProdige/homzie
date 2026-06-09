import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { adCampaigns, propertyListings, reels, users } from "@/db/schema";
import { getStoredAdsSettings } from "@/modules/platform-settings/ads-settings";
import { getStoredGoogleAdsSettings } from "@/modules/platform-settings/google-ads-settings";
import { authOptions } from "@/modules/auth/config";
import { AdsCenterClient } from "./ads-center-client";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function AdsCenterPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/settings/ads-center");
  }

  const [user] = await db
    .select({
      id: users.id,
      location: users.location,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.username) {
    redirect("/onboarding/username");
  }

  const [savedAdsSettings, googleAdsSettings, listings, publishedReels, campaigns] = await Promise.all([
    getStoredAdsSettings(),
    getStoredGoogleAdsSettings(),
    db
      .select({
        id: propertyListings.id,
        location: propertyListings.location,
        title: propertyListings.title,
      })
      .from(propertyListings)
      .where(
        and(
          eq(propertyListings.userId, session.user.id),
          eq(propertyListings.status, "published"),
        ),
      )
      .orderBy(desc(propertyListings.listedAt)),
    db
      .select({
        caption: reels.caption,
        createdAt: reels.createdAt,
        id: reels.id,
      })
      .from(reels)
      .where(and(eq(reels.userId, session.user.id), eq(reels.status, "published")))
      .orderBy(desc(reels.createdAt)),
    db
      .select({
        channel: adCampaigns.channel,
        createdAt: adCampaigns.createdAt,
        durationDays: adCampaigns.durationDays,
        estimatedClicks: adCampaigns.estimatedClicks,
        estimatedReach: adCampaigns.estimatedReach,
        estimatedResults: adCampaigns.estimatedResults,
        id: adCampaigns.id,
        name: adCampaigns.name,
        objective: adCampaigns.objective,
        promotedType: adCampaigns.promotedType,
        googleSyncStatus: adCampaigns.googleSyncStatus,
        status: adCampaigns.status,
        totalBudgetCents: adCampaigns.totalBudgetCents,
      })
      .from(adCampaigns)
      .where(eq(adCampaigns.userId, session.user.id))
      .orderBy(desc(adCampaigns.createdAt)),
  ]);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1180px] overflow-x-clip bg-background px-4 pb-10 text-foreground sm:px-6 lg:px-10">
      <AdsCenterClient
        settings={{
          ...savedAdsSettings,
          allowGoogleAds: savedAdsSettings.allowGoogleAds && googleAdsSettings.enabled,
        }}
        userLocation={user.location || ""}
        listingOptions={listings
          .filter((listing) => Boolean(listing.title))
          .map((listing) => ({
            id: listing.id,
            label: `${listing.title}${listing.location ? ` - ${listing.location}` : ""}`,
          }))}
        reelOptions={publishedReels.map((reel, index) => ({
          id: reel.id,
          label:
            reel.caption?.trim() ||
            `Reel ${index + 1} - ${formatDate(reel.createdAt)}`,
        }))}
        campaigns={campaigns.map((campaign) => ({
          channel: campaign.channel,
          createdAtLabel: formatDate(campaign.createdAt),
          durationDays: campaign.durationDays,
          estimatedClicks: campaign.estimatedClicks,
          estimatedReach: campaign.estimatedReach,
          estimatedResults: campaign.estimatedResults,
          id: campaign.id,
          name: campaign.name,
          googleSyncStatus: campaign.googleSyncStatus,
          objective: campaign.objective,
          promotedLabel:
            campaign.promotedType === "profile"
              ? "Promoting your public profile"
              : campaign.promotedType === "listing"
                ? "Promoting one of your listings"
                : "Promoting one of your reels",
          status: campaign.status,
          totalBudgetCents: campaign.totalBudgetCents,
        }))}
      />
    </main>
  );
}
