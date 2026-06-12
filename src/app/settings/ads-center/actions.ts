"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { adCampaigns, propertyListings, reels, users } from "@/db/schema";
import {
  recordAdCampaignLifecycleEvent,
  syncAdCampaignSpend,
} from "@/modules/ads/billing";
import { buildAdForecast, formatCurrencyFromCents } from "@/modules/ads/forecast";
import { getActiveAgentSubscription } from "@/modules/agents/queries";
import {
  adChannels,
  adPromotedTypes,
  type AdChannel,
} from "@/modules/ads/shared";
import { getStripe } from "@/modules/billing/stripe";
import {
  getGoogleDsaAutomationHealth,
  getGoogleDsaChannelAvailability,
  syncGoogleDsaCampaignState,
} from "@/modules/google-ads/dsa";
import { getStoredAdsSettings } from "@/modules/platform-settings/ads-settings";
import { getStoredGoogleAdsSettings } from "@/modules/platform-settings/google-ads-settings";
import { authOptions } from "@/modules/auth/config";
import { absoluteUrl } from "@/modules/site/url";
import { buildListingPath } from "@/modules/listings/seo";
import {
  absoluteAppUrl,
  notifyUser,
} from "@/modules/email/server";
import type { CreateAdCampaignState } from "./action-state";
import type { TargetAreaScope, TargetAreaSelection } from "./types";

const createAdCampaignSchema = z.object({
  channels: z.array(z.enum(adChannels)).min(1, "Choose at least one ad channel."),
  promotedType: z.enum(adPromotedTypes),
  listingId: z.string().uuid().optional().or(z.literal("")),
  reelId: z.string().uuid().optional().or(z.literal("")),
  targetAreasJson: z.string().trim().min(2),
  targetScope: z.enum(["custom", "global"] satisfies TargetAreaScope[]),
  targetSummaryLabel: z.string().trim().max(160).optional(),
  targetPopulationEstimate: z.coerce.number().int().min(0).optional(),
  targetActiveUsersEstimate: z.coerce.number().int().min(0).optional(),
  targetPublishedListingsEstimate: z.coerce.number().int().min(0).optional(),
  durationDays: z.coerce.number().int().min(1).max(90),
  totalBudgetRands: z.coerce.number().min(1),
});

function parseTargetAreas(targetAreasJson: string): TargetAreaSelection[] {
  const parsed = JSON.parse(targetAreasJson) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Choose at least one target area before publishing.");
  }

  return parsed
    .filter(
      (item): item is TargetAreaSelection =>
        Boolean(
          item &&
            typeof item === "object" &&
            "label" in item &&
            "placeId" in item &&
            typeof item.label === "string" &&
            typeof item.placeId === "string",
        ),
    )
    .map((item) => ({
      activeUsersEstimate: Math.max(0, Number(item.activeUsersEstimate || 0)),
      label: item.label.trim(),
      placeId: item.placeId.trim(),
      populationEstimate: Math.max(0, Number(item.populationEstimate || 0)),
      publishedListingsEstimate: Math.max(0, Number(item.publishedListingsEstimate || 0)),
    }))
    .filter((item) => item.label && item.placeId);
}

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

async function buildPromotedUrl({
  listingId,
  promotedType,
  username,
}: {
  listingId?: string;
  promotedType: "profile" | "listing" | "reel";
  username: string;
}) {
  if (promotedType === "listing" && listingId) {
    const [listing] = await db
      .select({
        details: propertyListings.details,
        id: propertyListings.id,
        listingType: propertyListings.listingType,
        location: propertyListings.location,
        propertyType: propertyListings.propertyType,
        title: propertyListings.title,
      })
      .from(propertyListings)
      .where(eq(propertyListings.id, listingId))
      .limit(1);

    if (!listing) return null;

    const details =
      listing.details && typeof listing.details === "object" && !Array.isArray(listing.details)
        ? (listing.details as Record<string, unknown>)
        : {};

    return absoluteUrl(
      buildListingPath({
        bedrooms: details.bedrooms as number | string | null,
        city: typeof details.city === "string" ? details.city : "",
        country: typeof details.country === "string" ? details.country : "",
        id: listing.id,
        listingType: listing.listingType,
        location: listing.location,
        propertyType: listing.propertyType,
        province:
          (typeof details.province === "string" ? details.province : "") ||
          (typeof details.state === "string" ? details.state : "") ||
          (typeof details.region === "string" ? details.region : ""),
        suburb: typeof details.suburb === "string" ? details.suburb : "",
        title: listing.title,
      }),
    );
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

async function assertBillingReadiness(userId: string) {
  const subscription = await getActiveAgentSubscription(userId);

  if (!subscription?.providerCustomerId) {
    throw new Error("You need an active subscription before you can publish ads.");
  }

  const stripe = await getStripe();
  const paymentMethods = await stripe.paymentMethods.list({
    customer: subscription.providerCustomerId,
    type: "card",
    limit: 20,
  });

  if (!paymentMethods.data.some((paymentMethod) => Boolean(paymentMethod.card))) {
    throw new Error("Add a payment method in Billing before publishing ads.");
  }
}

function buildGeneratedCampaignName(promotedType: "profile" | "listing" | "reel") {
  const dateLabel = new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());

  if (promotedType === "listing") {
    return `Listing promotion - ${dateLabel}`;
  }

  if (promotedType === "reel") {
    return `Reel promotion - ${dateLabel}`;
  }

  return `Profile promotion - ${dateLabel}`;
}

async function notifyCampaignPublished({
  budgetCents,
  channels,
  issue,
  name,
  userId,
}: {
  budgetCents: number;
  channels: string[];
  issue?: string;
  name: string;
  userId: string;
}) {
  await notifyUser({
    eventKey: issue ? "ads.campaign_needs_attention" : "ads.campaign_published",
    preferenceCategory: "marketing",
    templateKey: issue ? "ads.campaign_needs_attention" : "ads.campaign_published",
    userId,
    variables: {
      app: {
        name: "Homzie",
        url: absoluteAppUrl("/"),
      },
      campaign: {
        budget: formatCurrencyFromCents(budgetCents),
        channels: channels
          .map((channel) => (channel === "google" ? "Google" : "Homzie"))
          .join(" and "),
        issue: issue || "",
        name,
      },
      campaignsUrl: absoluteAppUrl("/settings/ads-center/campaigns"),
    },
  });
}

function splitBudget(totalBudgetCents: number, channelsCount: number, index: number) {
  const base = Math.floor(totalBudgetCents / channelsCount);
  const remainder = totalBudgetCents % channelsCount;

  return base + (index < remainder ? 1 : 0);
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
      channels: formData
        .getAll("channels")
        .map((value) => String(value))
        .filter((value): value is AdChannel =>
          (adChannels as readonly string[]).includes(value),
        ),
      promotedType: formData.get("promotedType"),
      listingId: formData.get("listingId") || "",
      reelId: formData.get("reelId") || "",
      targetAreasJson: formData.get("targetAreasJson") || "[]",
      targetScope: formData.get("targetScope") || "custom",
      targetSummaryLabel: formData.get("targetSummaryLabel") || "",
      targetPopulationEstimate: formData.get("targetPopulationEstimate") || 0,
      targetActiveUsersEstimate: formData.get("targetActiveUsersEstimate") || 0,
      targetPublishedListingsEstimate:
        formData.get("targetPublishedListingsEstimate") || 0,
      durationDays: formData.get("durationDays"),
      totalBudgetRands: formData.get("totalBudgetRands"),
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

    const targetAreas = parseTargetAreas(parsed.data.targetAreasJson);

    if (!targetAreas.length) {
      return {
        ok: false,
        message: "Choose at least one target area before publishing.",
      };
    }

    if (
      parsed.data.targetScope === "global" &&
      !targetAreas.some((area) => area.placeId === "__global__")
    ) {
      return {
        ok: false,
        message: "Global targeting needs the all countries and regions option selected.",
      };
    }

    await assertBillingReadiness(userId);

    const uniqueChannels = [...new Set(parsed.data.channels)];

    if (
      uniqueChannels.some(
        (channel) =>
          !isChannelEnabled({
            adsSettings: settings,
            channel,
            googleAdsEnabled: googleAdsSettings.enabled,
          }),
      )
    ) {
      return {
        ok: false,
        message: "One or more selected ad channels are not available right now.",
      };
    }

    if (uniqueChannels.includes("google") && parsed.data.promotedType !== "listing") {
      return {
        ok: false,
        message: "Google promotion currently supports published listings only.",
      };
    }

    if (uniqueChannels.includes("google")) {
      const googleChannelStatus = getGoogleDsaChannelAvailability(
        await getGoogleDsaAutomationHealth(),
      );

      if (!googleChannelStatus.available) {
        return {
          ok: false,
          message:
            googleChannelStatus.blockedReason ||
            "Google delivery is not available right now.",
        };
      }
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
    const now = new Date();
    const promotedUrl = await buildPromotedUrl({
      listingId: parsed.data.listingId || undefined,
      promotedType: parsed.data.promotedType,
      username: user.username,
    });
    const generatedName = buildGeneratedCampaignName(parsed.data.promotedType);
    const targetLocation =
      parsed.data.targetSummaryLabel?.trim() ||
      (parsed.data.targetScope === "global"
        ? "All countries and regions"
        : targetAreas.length > 1
          ? `${targetAreas.length} target areas`
          : targetAreas[0]?.label ||
            null);
    const targetLocationPlaceId =
      parsed.data.targetScope === "global"
        ? "__global__"
        : targetAreas[0]?.placeId || null;

    const insertedCampaigns = await db
      .insert(adCampaigns)
      .values(
        uniqueChannels.map((channel, index) => {
          const channelBudgetCents = splitBudget(totalBudgetCents, uniqueChannels.length, index);
          const forecast = buildAdForecast({
            channel,
            durationDays: parsed.data.durationDays,
            objective: "traffic",
            promotedType: parsed.data.promotedType,
            settings,
            targetActiveUsersEstimate: parsed.data.targetActiveUsersEstimate || 0,
            targetPopulationEstimate: parsed.data.targetPopulationEstimate || 0,
            totalBudgetCents: channelBudgetCents,
          });

          return {
            userId,
            name: generatedName,
            channel,
            promotedType: parsed.data.promotedType,
            objective: "traffic" as const,
            listingId:
              parsed.data.promotedType === "listing" ? parsed.data.listingId || null : null,
            reelId: parsed.data.promotedType === "reel" ? parsed.data.reelId || null : null,
            targetAreas,
            targetScope: parsed.data.targetScope,
            targetLocation,
            targetLocationPlaceId,
            targetPopulationEstimate: parsed.data.targetPopulationEstimate || 0,
            targetActiveUsersEstimate: parsed.data.targetActiveUsersEstimate || 0,
            targetPublishedListingsEstimate:
              parsed.data.targetPublishedListingsEstimate || 0,
            headline: null,
            copy: null,
            durationDays: parsed.data.durationDays,
            totalBudgetCents: channelBudgetCents,
            netMediaBudgetCents: forecast.netMediaBudgetCents,
            platformMarginBasisPoints: Math.round(forecast.marginPercent * 100),
            estimatedReach: forecast.estimatedReach,
            estimatedImpressions: forecast.estimatedImpressions,
            estimatedClicks: forecast.estimatedClicks,
            estimatedResults: forecast.estimatedResults,
            promotedUrl,
            googleSyncStatus: channel === "google" ? "feed_active" : "not_applicable",
            status: "ready" as const,
            launchedAt: now,
            updatedAt: now,
          };
        }),
      )
      .returning({
        id: adCampaigns.id,
        channel: adCampaigns.channel,
        promotedType: adCampaigns.promotedType,
      });

    const needsGoogleSync = insertedCampaigns.some(
      (campaign) => campaign.channel === "google" && campaign.promotedType === "listing",
    );

    if (needsGoogleSync) {
      try {
        await syncGoogleDsaCampaignState();
      } catch (error) {
        const issue =
          error instanceof Error
            ? `Google feed sync needs attention: ${error.message}`
            : "Google feed sync needs attention.";
        await notifyCampaignPublished({
          budgetCents: totalBudgetCents,
          channels: uniqueChannels,
          issue,
          name: generatedName,
          userId,
        }).catch((emailError) => {
          console.error("[email] campaign attention failed", emailError);
        });
        return {
          ok: true,
          message:
            error instanceof Error
              ? `Campaign published, but Google feed sync needs attention: ${error.message}`
              : "Campaign published, but Google feed sync needs attention.",
        };
      }
    }

    revalidatePath("/settings/ads-center");
    revalidatePath("/settings/ads-center/campaigns");

    await notifyCampaignPublished({
      budgetCents: totalBudgetCents,
      channels: uniqueChannels,
      name: generatedName,
      userId,
    }).catch((error) => {
      console.error("[email] campaign published failed", error);
    });

    return {
      ok: true,
      message:
        uniqueChannels.length > 1
          ? "Campaign published across your selected channels."
          : "Campaign published.",
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
      launchedAt: adCampaigns.launchedAt,
      promotedType: adCampaigns.promotedType,
    })
    .from(adCampaigns)
    .where(and(eq(adCampaigns.id, campaignId), eq(adCampaigns.userId, userId)))
    .orderBy(desc(adCampaigns.createdAt))
    .limit(1);

  if (!campaign) {
    throw new Error("We could not find that campaign.");
  }

  const now = new Date();

  if (nextStatus === "paused") {
    await syncAdCampaignSpend(campaign.id);

    await db
      .update(adCampaigns)
      .set({ pausedAt: now, status: "paused", updatedAt: now })
      .where(eq(adCampaigns.id, campaign.id));

    await recordAdCampaignLifecycleEvent(campaign.id, "pause");
  } else {
    await db
      .update(adCampaigns)
      .set({
        launchedAt: campaign.launchedAt || now,
        resumedAt: now,
        status: "ready",
        updatedAt: now,
      })
      .where(eq(adCampaigns.id, campaign.id));

    await recordAdCampaignLifecycleEvent(campaign.id, "resume");
  }

  if (campaign.channel === "google" && campaign.promotedType === "listing") {
    await syncGoogleDsaCampaignState();
  }

  revalidatePath("/settings/ads-center");
  revalidatePath("/settings/ads-center/campaigns");

  return {
    ok: true,
    message: nextStatus === "ready" ? "Campaign resumed." : "Campaign paused.",
  };
}
