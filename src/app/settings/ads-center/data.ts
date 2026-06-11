import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { adCampaigns, propertyListings, reels, users } from "@/db/schema";
import { getActiveAgentSubscription } from "@/modules/agents/queries";
import {
  getUserAdBillingSummary,
  listUserAdInvoices,
} from "@/modules/ads/billing";
import { getStripe } from "@/modules/billing/stripe";
import { authOptions } from "@/modules/auth/config";
import { toPublicMediaUrl } from "@/media/paths";
import {
  getGoogleDsaAutomationHealth,
  getGoogleDsaChannelAvailability,
} from "@/modules/google-ads/dsa";
import { getStoredAdsSettings } from "@/modules/platform-settings/ads-settings";
import { getStoredGoogleAdsSettings } from "@/modules/platform-settings/google-ads-settings";
import type {
  AssetOption,
  CampaignSummary,
  TargetAreaScope,
  TargetAreaSelection,
} from "./types";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatPeriodDate(value: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
  }).format(value);
}

function formatCurrency(cents: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

async function requireAdsCenterUser(callbackUrl: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const [user] = await db
    .select({
      id: users.id,
      location: users.location,
      locationPlaceId: users.locationPlaceId,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.username) {
    redirect("/onboarding/username");
  }

  return { sessionUserId: session.user.id, user };
}

function toCampaignSummary(campaign: {
  channel: string;
  createdAt: Date;
  deliveredSpendCents: number;
  durationDays: number;
  estimatedClicks: number;
  estimatedReach: number;
  estimatedResults: number;
  googleSyncStatus: string;
  id: string;
  promotedType: string;
  billedSpendCents: number;
  status: string;
  targetActiveUsersEstimate: number;
  targetAreas: unknown;
  targetLocation: string | null;
  targetLocationPlaceId: string | null;
  targetPopulationEstimate: number;
  targetPublishedListingsEstimate: number;
  targetScope: string;
  totalBudgetCents: number;
}): CampaignSummary {
  const targetAreas = Array.isArray(campaign.targetAreas)
    ? (campaign.targetAreas as TargetAreaSelection[])
    : [];
  const targetAreaCount = targetAreas.length;
  const targetScope = (campaign.targetScope === "global"
    ? "global"
    : "custom") as TargetAreaScope;
  const targetLocation =
    campaign.targetLocation ||
    (targetScope === "global"
      ? "All countries and regions"
      : targetAreaCount > 1
        ? `${targetAreaCount} target areas`
        : targetAreas[0]?.label || null);
  const targetSummaryLabel = targetLocation;

  return {
    channel: campaign.channel,
    createdAtLabel: formatDate(campaign.createdAt),
    deliveredSpendCents: campaign.deliveredSpendCents,
    durationDays: campaign.durationDays,
    estimatedClicks: campaign.estimatedClicks,
    estimatedReach: campaign.estimatedReach,
    estimatedResults: campaign.estimatedResults,
    id: campaign.id,
    googleSyncStatus: campaign.googleSyncStatus,
    promotedLabel:
      campaign.promotedType === "profile"
        ? "Promoting your public profile"
        : campaign.promotedType === "listing"
          ? "Promoting one of your listings"
          : "Promoting one of your reels",
    billedSpendCents: campaign.billedSpendCents,
    outstandingSpendCents: Math.max(
      0,
      campaign.deliveredSpendCents - campaign.billedSpendCents,
    ),
    targetActiveUsersEstimate: campaign.targetActiveUsersEstimate,
    targetAreaCount,
    targetAreas,
    targetSummaryLabel: targetSummaryLabel ?? undefined,
    targetLocation,
    targetLocationPlaceId:
      targetScope === "global"
        ? "__global__"
        : campaign.targetLocationPlaceId || targetAreas[0]?.placeId || null,
    targetPopulationEstimate: campaign.targetPopulationEstimate,
    targetPublishedListingsEstimate: campaign.targetPublishedListingsEstimate,
    targetScope,
    status: campaign.status,
    totalBudgetCents: campaign.totalBudgetCents,
  };
}

export async function getAdsCenterPageData() {
  const { sessionUserId, user } = await requireAdsCenterUser("/settings/ads-center");

  const [
    savedAdsSettings,
    googleAdsSettings,
    googleAutomationHealth,
    listings,
    publishedReels,
    campaigns,
    activeSubscription,
  ] = await Promise.all([
    getStoredAdsSettings(),
    getStoredGoogleAdsSettings(),
    getGoogleDsaAutomationHealth(),
    db
      .select({
        coverImageUrl: propertyListings.coverImageUrl,
        id: propertyListings.id,
        location: propertyListings.location,
        priceLabel: propertyListings.priceLabel,
        status: propertyListings.status,
        title: propertyListings.title,
      })
      .from(propertyListings)
      .where(
        and(
          eq(propertyListings.userId, user.id),
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
      .where(and(eq(reels.userId, user.id), eq(reels.status, "published")))
      .orderBy(desc(reels.createdAt)),
    db
      .select({
        channel: adCampaigns.channel,
        createdAt: adCampaigns.createdAt,
        deliveredSpendCents: adCampaigns.deliveredSpendCents,
        durationDays: adCampaigns.durationDays,
        estimatedClicks: adCampaigns.estimatedClicks,
        estimatedReach: adCampaigns.estimatedReach,
        estimatedResults: adCampaigns.estimatedResults,
        id: adCampaigns.id,
        promotedType: adCampaigns.promotedType,
        billedSpendCents: adCampaigns.billedSpendCents,
        targetAreas: adCampaigns.targetAreas,
        targetActiveUsersEstimate: adCampaigns.targetActiveUsersEstimate,
        targetLocation: adCampaigns.targetLocation,
        targetLocationPlaceId: adCampaigns.targetLocationPlaceId,
        targetPopulationEstimate: adCampaigns.targetPopulationEstimate,
        targetPublishedListingsEstimate: adCampaigns.targetPublishedListingsEstimate,
        googleSyncStatus: adCampaigns.googleSyncStatus,
        status: adCampaigns.status,
        targetScope: adCampaigns.targetScope,
        totalBudgetCents: adCampaigns.totalBudgetCents,
      })
      .from(adCampaigns)
      .where(eq(adCampaigns.userId, sessionUserId))
      .orderBy(desc(adCampaigns.createdAt)),
    getActiveAgentSubscription(sessionUserId),
  ]);

  let hasPaymentMethod = false;
  let paymentMethodLabel: string | null = null;

  if (activeSubscription?.providerCustomerId) {
    try {
      const stripe = await getStripe();
      const paymentMethods = await stripe.paymentMethods.list({
        customer: activeSubscription.providerCustomerId,
        type: "card",
        limit: 20,
      });
      const defaultId =
        activeSubscription.providerReference
          ? (
              await stripe.subscriptions.retrieve(activeSubscription.providerReference, {
                expand: ["default_payment_method"],
              })
            ).default_payment_method
          : null;
      const normalizedDefaultId =
        defaultId && typeof defaultId !== "string"
          ? defaultId.id
          : typeof defaultId === "string"
            ? defaultId
            : null;
      const card =
        paymentMethods.data.find((paymentMethod) => paymentMethod.id === normalizedDefaultId) ||
        paymentMethods.data.find((paymentMethod) => Boolean(paymentMethod.card));

      hasPaymentMethod = Boolean(card?.card);

      if (card?.card) {
        paymentMethodLabel = `${card.card.brand.toUpperCase()} •••• ${card.card.last4}`;
      }
    } catch {
      hasPaymentMethod = false;
      paymentMethodLabel = null;
    }
  }

  const googleChannelStatus = getGoogleDsaChannelAvailability(googleAutomationHealth);

  return {
    billingStatus: {
      hasActiveSubscription: Boolean(activeSubscription),
      hasPaymentMethod,
      paymentMethodLabel,
    },
    campaigns: campaigns.map(toCampaignSummary),
    googleAutomationHealth,
    googleChannelStatus,
    listingOptions: listings
      .filter((listing) => Boolean(listing.title))
      .map(
        (listing): AssetOption => ({
          coverImageUrl: toPublicMediaUrl(listing.coverImageUrl),
          id: listing.id,
          label: `${listing.title}${listing.location ? ` (${listing.location})` : ""}`,
          location: listing.location,
          priceLabel: listing.priceLabel,
          status:
            listing.status.charAt(0).toUpperCase() + listing.status.slice(1),
          title: listing.title || "Untitled listing",
        }),
      ),
    reelOptions: publishedReels.map((reel, index) => ({
      id: reel.id,
      label:
        reel.caption?.trim() ||
        `Reel ${index + 1} - ${formatDate(reel.createdAt)}`,
    })),
    settings: {
      ...savedAdsSettings,
      allowGoogleAds: savedAdsSettings.allowGoogleAds && googleAdsSettings.enabled,
    },
    userLocation: user.location || "",
    userLocationPlaceId: user.locationPlaceId || "",
  };
}

export async function getAdsCampaignsPageData() {
  const { sessionUserId } = await requireAdsCenterUser("/settings/ads-center/campaigns");

  const [campaigns, billingSummary, invoices] = await Promise.all([
    db
      .select({
        channel: adCampaigns.channel,
        createdAt: adCampaigns.createdAt,
        deliveredSpendCents: adCampaigns.deliveredSpendCents,
        durationDays: adCampaigns.durationDays,
        estimatedClicks: adCampaigns.estimatedClicks,
        estimatedReach: adCampaigns.estimatedReach,
        estimatedResults: adCampaigns.estimatedResults,
        googleSyncStatus: adCampaigns.googleSyncStatus,
        id: adCampaigns.id,
        promotedType: adCampaigns.promotedType,
        billedSpendCents: adCampaigns.billedSpendCents,
        status: adCampaigns.status,
        targetAreas: adCampaigns.targetAreas,
        targetActiveUsersEstimate: adCampaigns.targetActiveUsersEstimate,
        targetLocation: adCampaigns.targetLocation,
        targetLocationPlaceId: adCampaigns.targetLocationPlaceId,
        targetPopulationEstimate: adCampaigns.targetPopulationEstimate,
        targetPublishedListingsEstimate: adCampaigns.targetPublishedListingsEstimate,
        targetScope: adCampaigns.targetScope,
        totalBudgetCents: adCampaigns.totalBudgetCents,
      })
      .from(adCampaigns)
      .where(eq(adCampaigns.userId, sessionUserId))
      .orderBy(desc(adCampaigns.createdAt)),
    getUserAdBillingSummary(sessionUserId),
    listUserAdInvoices(sessionUserId, 8),
  ]);

  return {
    billingSummary: {
      ...billingSummary,
      nextBillingDateLabel: billingSummary.nextBillingDate
        ? formatDate(billingSummary.nextBillingDate)
        : "No open billing period",
    },
    campaigns: campaigns.map(toCampaignSummary),
    invoices: invoices.map((invoice) => ({
      amount: formatCurrency(invoice.totalCents),
      date: formatDate(invoice.createdAt),
      description: `${formatPeriodDate(invoice.periodStart)} - ${formatPeriodDate(invoice.periodEnd)}`,
      downloadUrl: null,
      failureMessage: invoice.failureMessage,
      id: invoice.id,
      status: invoice.status,
    })),
  };
}
