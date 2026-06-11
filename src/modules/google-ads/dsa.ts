import "server-only";

import { and, count, desc, eq, inArray } from "drizzle-orm";

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

type GoogleSearchStreamResult = {
  campaign?: {
    id?: string | number;
  };
  metrics?: {
    clicks?: string | number;
    costMicros?: string | number;
    cost_micros?: string | number;
    impressions?: string | number;
  };
  segments?: {
    date?: string;
  };
};

type GoogleSearchStreamChunk = {
  results?: GoogleSearchStreamResult[];
};

const GOOGLE_ADS_API_VERSION = "v24";

export type GoogleDsaAutomationHealth = {
  activeGoogleListings: number;
  automationEnabled: boolean;
  credentialsComplete: boolean;
  dsaCampaignIdConfigured: boolean;
  feedConfigured: boolean;
  googlePromotionEnabled: boolean;
  lastError: string;
  lastSyncAt: Date | null;
  lastSyncStatus: string;
  loginCustomerIdConfigured: boolean;
  tokenStateLabel: string;
  totalGoogleCampaigns: number;
};

export type GoogleDsaChannelAvailability = {
  available: boolean;
  blockedReason: string | null;
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
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${settings.customerId}/campaigns:mutate`,
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
    const compactBody = body
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    throw new Error(
      `Google campaign status update failed: ${compactBody || response.statusText}`,
    );
  }
}

function coerceMetricNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export type GoogleDsaDailyMetric = {
  amountCents: number;
  clicks: number;
  externalReference: string;
  impressions: number;
  metricDate: string;
};

export async function getGoogleDsaDailyMetrics({
  endDate,
  startDate,
}: {
  endDate: string;
  startDate: string;
}) {
  const { accessToken, settings } = await getGoogleAdsAccessToken();
  const query = [
    "SELECT",
    "  campaign.id,",
    "  segments.date,",
    "  metrics.impressions,",
    "  metrics.clicks,",
    "  metrics.cost_micros",
    "FROM campaign",
    `WHERE campaign.id = ${settings.dsaCampaignId}`,
    `  AND segments.date BETWEEN '${startDate}' AND '${endDate}'`,
    "ORDER BY segments.date",
  ].join(" ");

  const response = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${settings.customerId}/googleAds:searchStream`,
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
      body: JSON.stringify({ query }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  const chunks = (await response.json()) as GoogleSearchStreamChunk[];
  const rows = chunks.flatMap((chunk) => chunk.results || []);

  return rows
    .map((row) => {
      const metricDate = row.segments?.date;

      if (!metricDate) {
        return null;
      }

      const impressions = coerceMetricNumber(row.metrics?.impressions);
      const clicks = coerceMetricNumber(row.metrics?.clicks);
      const costMicros = coerceMetricNumber(
        row.metrics?.costMicros ?? row.metrics?.cost_micros,
      );

      return {
        amountCents: Math.max(0, Math.round(costMicros / 10000)),
        clicks,
        externalReference: String(row.campaign?.id || settings.dsaCampaignId),
        impressions,
        metricDate,
      } satisfies GoogleDsaDailyMetric;
    })
    .filter((row): row is GoogleDsaDailyMetric => Boolean(row));
}

export async function getGoogleDsaAutomationHealth(): Promise<GoogleDsaAutomationHealth> {
  const settings = await getStoredGoogleAdsSettings();

  const [activeSummary, totalSummary, latestGoogleCampaign] = await Promise.all([
    db
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
      ),
    db
      .select({ total: count() })
      .from(adCampaigns)
      .where(and(eq(adCampaigns.channel, "google"), eq(adCampaigns.promotedType, "listing"))),
    db
      .select({
        googleSyncError: adCampaigns.googleSyncError,
        googleLastSyncedAt: adCampaigns.googleLastSyncedAt,
        googleSyncStatus: adCampaigns.googleSyncStatus,
      })
      .from(adCampaigns)
      .where(and(eq(adCampaigns.channel, "google"), eq(adCampaigns.promotedType, "listing")))
      .orderBy(desc(adCampaigns.googleLastSyncedAt), desc(adCampaigns.updatedAt))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  return {
    activeGoogleListings: Number(activeSummary[0]?.total || 0),
    automationEnabled: settings.automationEnabled,
    credentialsComplete: hasGoogleAdsApiCredentials(settings),
    dsaCampaignIdConfigured: Boolean(settings.dsaCampaignId),
    feedConfigured: Boolean(settings.pageFeedToken),
    googlePromotionEnabled: settings.enabled,
    lastError: latestGoogleCampaign?.googleSyncError || "",
    lastSyncAt: latestGoogleCampaign?.googleLastSyncedAt ?? null,
    lastSyncStatus: latestGoogleCampaign?.googleSyncStatus || "not_started",
    loginCustomerIdConfigured: Boolean(settings.loginCustomerId),
    tokenStateLabel: settings.automationEnabled
      ? "Google-managed access level"
      : "Not checked yet",
    totalGoogleCampaigns: Number(totalSummary[0]?.total || 0),
  };
}

export function getGoogleDsaChannelAvailability(
  health: GoogleDsaAutomationHealth,
): GoogleDsaChannelAvailability {
  if (!health.googlePromotionEnabled) {
    return {
      available: false,
      blockedReason: "Google delivery is currently disabled in Homzie admin settings.",
    };
  }

  if (!health.automationEnabled) {
    return {
      available: false,
      blockedReason: "Google delivery is unavailable while Homzie automation is turned off.",
    };
  }

  if (!health.credentialsComplete) {
    return {
      available: false,
      blockedReason: "Google delivery is unavailable until Homzie's Google Ads credentials are complete.",
    };
  }

  if (health.lastSyncStatus === "sync_error" && health.lastError) {
    if (health.lastError.includes("DEVELOPER_TOKEN_NOT_APPROVED")) {
      return {
        available: false,
        blockedReason:
          "Google delivery is temporarily unavailable while Homzie's Google Ads API token is still waiting on Basic Access approval.",
      };
    }

    if (health.lastError.includes("DEVELOPER_TOKEN_INVALID")) {
      return {
        available: false,
        blockedReason:
          "Google delivery is temporarily unavailable because Homzie's Google Ads developer token is not being accepted.",
      };
    }

    if (health.lastError.includes("invalid_grant")) {
      return {
        available: false,
        blockedReason:
          "Google delivery is temporarily unavailable because Homzie's Google OAuth session needs attention.",
      };
    }

    return {
      available: false,
      blockedReason:
        "Google delivery is temporarily unavailable while Homzie resolves a Google Ads sync issue.",
    };
  }

  return {
    available: true,
    blockedReason: null,
  };
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
