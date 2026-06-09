"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { adCampaigns, propertyListings, reels, users } from "@/db/schema";
import { buildAdForecast } from "@/modules/ads/forecast";
import {
  adChannels,
  adObjectives,
  adPromotedTypes,
  type AdChannel,
} from "@/modules/ads/shared";
import { syncGoogleDsaCampaignState } from "@/modules/google-ads/dsa";
import { getStoredAdsSettings } from "@/modules/platform-settings/ads-settings";
import { getStoredGoogleAdsSettings } from "@/modules/platform-settings/google-ads-settings";
import { authOptions } from "@/modules/auth/config";
import { absoluteUrl } from "@/modules/site/url";

export type CreateAdCampaignState = {
  message: string;
  ok: boolean;
};

export const emptyCreateAdCampaignState: CreateAdCampaignState = {
  message: "",
  ok: false,
};

const createAdCampaignSchema = z.object({
  name: z.string().trim().min(3).max(80),
  channel: z.enum(adChannels),
  promotedType: z.enum(adPromotedTypes),
  objective: z.enum(adObjectives),
  listingId: z.string().uuid().optional().or(z.literal("")),
  reelId: z.string().uuid().optional().or(z.literal("")),
  targetLocation: z.string().trim().max(120).optional(),
  headline: z.string().trim().max(80).optional(),
  copy: z.string().trim().max(280).optional(),
  durationDays: z.coerce.number().int().min(1).max(90),
  totalBudgetRands: z.coerce.number().min(1),
  launchNow: z.boolean(),
});

async function requireSessionUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Sign in again to manage Ads Center.");
  }

  return session.user.id;
}

async function getCurrentUser(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error("We could not find your account.");
  }

  return user;
}

async function assertPromotedAssetOwnership({
  promotedType,
  listingId,
  reelId,
  userId,
}: {
  promotedType: "profile" | "listing" | "reel";
  listingId?: string;
  reelId?: string;
  userId: string;
}) {
  if (promotedType === "listing") {
    if (!listingId) {
      throw new Error("Choose the listing you want to promote.");
    }

    const [listing] = await db
      .select({ id: propertyListings.id })
      .from(propertyListings)
      .where(
        and(
          eq(propertyListings.id, listingId),
          eq(propertyListings.userId, userId),
          eq(propertyListings.status, "published"),
        ),
      )
      .limit(1);

    if (!listing) {
      throw new Error("That listing is not available to promote.");
    }
  }

  if (promotedType === "reel") {
    if (!reelId) {
      throw new Error("Choose the reel you want to promote.");
    }

    const [reel] = await db
      .select({ id: reels.id })
      .from(reels)
      .where(
        and(
          eq(reels.id, reelId),
          eq(reels.userId, userId),
          eq(reels.status, "published"),
        ),
      )
      .limit(1);

    if (!reel) {
      throw new Error("That reel is not available to promote.");
    }
  }
}

function buildPromotedUrl({
  listingId,
  promotedType,
  username,
}: {
  listingId?: string;
  promotedType: "profile" | "listing" | "reel";
  username: string;
}) {
  if (promotedType === "listing" && listingId) {
    return absoluteUrl(`/listings/${listingId}`);
  }

  if (promotedType === "profile") {
    return absoluteUrl(`/users/${username}`);
  }

  return null;
}

function isChannelEnabled({
  adsSettings,
  channel,
  googleAdsEnabled,
}: {
  adsSettings: Awaited<ReturnType<typeof getStoredAdsSettings>>;
  channel: AdChannel;
  googleAdsEnabled: boolean;
}) {
  return channel === "google"
    ? adsSettings.allowGoogleAds && googleAdsEnabled
    : adsSettings.allowHomzieAds;
}

export async function createAdCampaign(
  _previousState: CreateAdCampaignState,
  formData: FormData,
): Promise<CreateAdCampaignState> {
  try {
    const userId = await requireSessionUser();
    const user = await getCurrentUser(userId);
    const [settings, googleAdsSettings] = await Promise.all([
      getStoredAdsSettings(),
      getStoredGoogleAdsSettings(),
    ]);
    const parsed = createAdCampaignSchema.safeParse({
      name: formData.get("name"),
      channel: formData.get("channel"),
      promotedType: formData.get("promotedType"),
      objective: formData.get("objective"),
      listingId: formData.get("listingId") || "",
      reelId: formData.get("reelId") || "",
      targetLocation: formData.get("targetLocation") || "",
      headline: formData.get("headline") || "",
      copy: formData.get("copy") || "",
      durationDays: formData.get("durationDays"),
      totalBudgetRands: formData.get("totalBudgetRands"),
      launchNow: formData.get("launchNow") === "on",
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message || "Check your campaign details.",
      };
    }

    if (!user.username) {
      return { ok: false, message: "Finish setting up your profile before creating ads." };
    }

    if (
      !isChannelEnabled({
        adsSettings: settings,
        channel: parsed.data.channel,
        googleAdsEnabled: googleAdsSettings.enabled,
      })
    ) {
      return {
        ok: false,
        message: "That ad channel is not available right now.",
      };
    }

    if (parsed.data.channel === "google" && parsed.data.promotedType !== "listing") {
      return {
        ok: false,
        message: "Google promotion currently supports published listings only.",
      };
    }

    await assertPromotedAssetOwnership({
      promotedType: parsed.data.promotedType,
      listingId: parsed.data.listingId || undefined,
      reelId: parsed.data.reelId || undefined,
      userId,
    });

    const totalBudgetCents = Math.max(
      settings.minCampaignBudgetCents,
      Math.min(
        Math.round(parsed.data.totalBudgetRands * 100),
        settings.maxCampaignBudgetCents,
      ),
    );
    const forecast = buildAdForecast({
      channel: parsed.data.channel,
      durationDays: parsed.data.durationDays,
      objective: parsed.data.objective,
      promotedType: parsed.data.promotedType,
      settings,
      totalBudgetCents,
    });
    const shouldLaunch = parsed.data.launchNow;
    const now = new Date();
    const promotedUrl = buildPromotedUrl({
      listingId: parsed.data.listingId || undefined,
      promotedType: parsed.data.promotedType,
      username: user.username,
    });

    const [campaign] = await db
      .insert(adCampaigns)
      .values({
      userId,
      name: parsed.data.name,
      channel: parsed.data.channel,
      promotedType: parsed.data.promotedType,
      objective: parsed.data.objective,
      listingId:
        parsed.data.promotedType === "listing" ? parsed.data.listingId || null : null,
      reelId: parsed.data.promotedType === "reel" ? parsed.data.reelId || null : null,
      targetLocation: parsed.data.targetLocation || null,
      headline: parsed.data.headline || null,
      copy: parsed.data.copy || null,
      durationDays: parsed.data.durationDays,
      totalBudgetCents,
      netMediaBudgetCents: forecast.netMediaBudgetCents,
      platformMarginBasisPoints: Math.round(forecast.marginPercent * 100),
      estimatedReach: forecast.estimatedReach,
      estimatedImpressions: forecast.estimatedImpressions,
      estimatedClicks: forecast.estimatedClicks,
      estimatedResults: forecast.estimatedResults,
      promotedUrl,
      googleSyncStatus:
        parsed.data.channel === "google"
          ? shouldLaunch
            ? "feed_active"
            : "not_in_feed"
          : "not_applicable",
      status: shouldLaunch ? "ready" : "draft",
      launchedAt: shouldLaunch ? now : null,
      updatedAt: now,
    })
      .returning({
        id: adCampaigns.id,
        channel: adCampaigns.channel,
        promotedType: adCampaigns.promotedType,
      });

    if (campaign?.channel === "google" && campaign.promotedType === "listing") {
      try {
        await syncGoogleDsaCampaignState();
      } catch (error) {
        return {
          ok: shouldLaunch ? false : true,
          message:
            shouldLaunch
              ? error instanceof Error
                ? error.message
                : "Google listing sync failed."
              : "Campaign saved as a draft.",
        };
      }
    }

    revalidatePath("/settings/ads-center");

    return {
      ok: true,
      message: shouldLaunch ? "Campaign marked ready." : "Campaign saved as a draft.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not create your campaign.",
    };
  }
}

export async function updateAdCampaignStatus(
  campaignId: string,
  nextStatus: "ready" | "paused",
) {
  const userId = await requireSessionUser();
  const [campaign] = await db
    .select({
      channel: adCampaigns.channel,
      id: adCampaigns.id,
      promotedType: adCampaigns.promotedType,
    })
    .from(adCampaigns)
    .where(and(eq(adCampaigns.id, campaignId), eq(adCampaigns.userId, userId)))
    .orderBy(desc(adCampaigns.createdAt))
    .limit(1);

  if (!campaign) {
    throw new Error("We could not find that campaign.");
  }

  await db
    .update(adCampaigns)
    .set({
      status: nextStatus,
      launchedAt: nextStatus === "ready" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(adCampaigns.id, campaign.id));

  if (campaign.channel === "google" && campaign.promotedType === "listing") {
    await syncGoogleDsaCampaignState();
  }

  revalidatePath("/settings/ads-center");

  return {
    ok: true,
    message: nextStatus === "ready" ? "Campaign marked ready." : "Campaign paused.",
  };
}
