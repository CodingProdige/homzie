import "server-only";

import { and, count, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { adCampaigns, propertyListings } from "@/db/schema";
import {
  getStoredGoogleAdsSettings,
  hasGoogleAdsApiCredentials,
} from "@/modules/platform-settings/google-ads-settings";

type GoogleOAuthTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

async function getGoogleAdsAccessToken() {
  const settings = await getStoredGoogleAdsSettings();

  if (!settings.enabled || !settings.automationEnabled) {
    throw new Error("Google Ads automation is disabled.");
  }

  if (!hasGoogleAdsApiCredentials(settings)) {
    throw new Error("Google Ads credentials are incomplete.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      grant_type: "refresh_token",
      refresh_token: settings.refreshToken,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google token refresh failed: ${body || response.statusText}`);
  }

  const json = (await response.json()) as GoogleOAuthTokenResponse;

  if (!json.access_token) {
    throw new Error("Google token refresh returned no access token.");
  }

  return {
    accessToken: json.access_token,
    settings,
  };
}

async function setGoogleDsaCampaignStatus(status: "ENABLED" | "PAUSED") {
  const { accessToken, settings } = await getGoogleAdsAccessToken();

  const response = await fetch(
    `https://googleads.googleapis.com/v19/customers/${settings.customerId}/campaigns:mutate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "developer-token": settings.developerToken,
        ...(settings.loginCustomerId
          ? { "login-customer-id": settings.loginCustomerId }
          : {}),
      },
      body: JSON.stringify({
        operations: [
          {
            update: {
              resourceName: `customers/${settings.customerId}/campaigns/${settings.dsaCampaignId}`,
              status,
            },
            updateMask: "status",
          },
        ],
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google campaign status update failed: ${body || response.statusText}`);
  }
}

export async function syncGoogleDsaCampaignState() {
  const settings = await getStoredGoogleAdsSettings();

  const [summary] = await db
    .select({ total: count() })
    .from(adCampaigns)
    .innerJoin(propertyListings, eq(propertyListings.id, adCampaigns.listingId))
    .where(
      and(
        eq(adCampaigns.channel, "google"),
        eq(adCampaigns.promotedType, "listing"),
        eq(propertyListings.status, "published"),
        inArray(adCampaigns.status, ["ready", "live"]),
      ),
    );

  const activeGoogleListings = Number(summary?.total || 0);
  const nextSyncStatus = activeGoogleListings > 0 ? "feed_active" : "campaign_paused";
  const now = new Date();

  await db
    .update(adCampaigns)
    .set({
      googleSyncError: null,
      googleSyncStatus: nextSyncStatus,
      googleLastSyncedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(adCampaigns.channel, "google"),
        eq(adCampaigns.promotedType, "listing"),
        inArray(adCampaigns.status, ["ready", "live"]),
      ),
    );

  await db
    .update(adCampaigns)
    .set({
      googleSyncError: null,
      googleSyncStatus: "not_in_feed",
      googleLastSyncedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(adCampaigns.channel, "google"),
        eq(adCampaigns.promotedType, "listing"),
        inArray(adCampaigns.status, ["draft", "paused"]),
      ),
    );

  if (!settings.enabled || !settings.automationEnabled) {
    return {
      activeGoogleListings,
      ok: true,
      state: activeGoogleListings > 0 ? "feed_active" : "awaiting_manual_pause",
    };
  }

  try {
    await setGoogleDsaCampaignStatus(activeGoogleListings > 0 ? "ENABLED" : "PAUSED");

    return {
      activeGoogleListings,
      ok: true,
      state: activeGoogleListings > 0 ? "campaign_enabled" : "campaign_paused",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Google campaign sync failed.";

    await db
      .update(adCampaigns)
      .set({
        googleSyncError: message,
        googleSyncStatus: "sync_error",
        googleLastSyncedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(adCampaigns.channel, "google"),
          eq(adCampaigns.promotedType, "listing"),
          inArray(adCampaigns.status, ["ready", "live", "paused"]),
        ),
      );

    throw error;
  }
}
