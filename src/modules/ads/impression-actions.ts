"use server";

import { sql, eq } from "drizzle-orm";

import { db } from "@/db";
import { adCampaignDeliveryDaily, adCampaigns } from "@/db/schema";

export async function recordAdImpression(campaignId: string) {
  const [campaign] = await db
    .select({ userId: adCampaigns.userId })
    .from(adCampaigns)
    .where(eq(adCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) return;

  const today = new Date().toISOString().slice(0, 10);

  await db
    .insert(adCampaignDeliveryDaily)
    .values({
      userId: campaign.userId,
      campaignId,
      channel: "homzie",
      metricDate: today,
      impressions: 1,
      source: "homzie_live",
    })
    .onConflictDoUpdate({
      target: [
        adCampaignDeliveryDaily.campaignId,
        adCampaignDeliveryDaily.metricDate,
        adCampaignDeliveryDaily.source,
      ],
      set: {
        impressions: sql`${adCampaignDeliveryDaily.impressions} + 1`,
        updatedAt: new Date(),
      },
    });
}
