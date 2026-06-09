import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { platformSettings } from "@/db/schema";

export type GoogleAdsSettings = {
  enabled: boolean;
  automationEnabled: boolean;
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  customerId: string;
  loginCustomerId: string;
  dsaCampaignId: string;
  siteDomain: string;
  languageCode: string;
  pageFeedLabel: string;
  pageFeedToken: string;
  descriptionLine1: string;
  descriptionLine2: string;
};

const googleAdsSettingsKey = "google_ads";

export const defaultGoogleAdsSettings: GoogleAdsSettings = {
  enabled: false,
  automationEnabled: false,
  developerToken: "",
  clientId: "",
  clientSecret: "",
  refreshToken: "",
  customerId: "",
  loginCustomerId: "",
  dsaCampaignId: "",
  siteDomain: "homzie.co.za",
  languageCode: "en",
  pageFeedLabel: "homzie-promoted-listings",
  pageFeedToken: "",
  descriptionLine1: "Discover verified Homzie property listings.",
  descriptionLine2: "Explore homes, pricing and local property insights.",
};

const settingsSchema = z.object({
  enabled: z.boolean().catch(defaultGoogleAdsSettings.enabled),
  automationEnabled: z.boolean().catch(defaultGoogleAdsSettings.automationEnabled),
  developerToken: z.string().catch(""),
  clientId: z.string().catch(""),
  clientSecret: z.string().catch(""),
  refreshToken: z.string().catch(""),
  customerId: z.string().catch(""),
  loginCustomerId: z.string().catch(""),
  dsaCampaignId: z.string().catch(""),
  siteDomain: z.string().catch(defaultGoogleAdsSettings.siteDomain),
  languageCode: z.string().catch(defaultGoogleAdsSettings.languageCode),
  pageFeedLabel: z.string().catch(defaultGoogleAdsSettings.pageFeedLabel),
  pageFeedToken: z.string().catch(""),
  descriptionLine1: z.string().catch(defaultGoogleAdsSettings.descriptionLine1),
  descriptionLine2: z.string().catch(defaultGoogleAdsSettings.descriptionLine2),
});

function clean(value: string) {
  return value.trim();
}

export function normalizeGoogleAdsSettings(value: unknown): GoogleAdsSettings {
  const parsed = settingsSchema.parse(value || defaultGoogleAdsSettings);

  return {
    enabled: parsed.enabled,
    automationEnabled: parsed.automationEnabled,
    developerToken: clean(parsed.developerToken),
    clientId: clean(parsed.clientId),
    clientSecret: clean(parsed.clientSecret),
    refreshToken: clean(parsed.refreshToken),
    customerId: clean(parsed.customerId).replaceAll("-", ""),
    loginCustomerId: clean(parsed.loginCustomerId).replaceAll("-", ""),
    dsaCampaignId: clean(parsed.dsaCampaignId),
    siteDomain: clean(parsed.siteDomain).replace(/^https?:\/\//, "").replace(/\/$/, ""),
    languageCode: clean(parsed.languageCode || "en") || "en",
    pageFeedLabel: clean(parsed.pageFeedLabel || defaultGoogleAdsSettings.pageFeedLabel),
    pageFeedToken: clean(parsed.pageFeedToken),
    descriptionLine1: clean(parsed.descriptionLine1).slice(0, 90),
    descriptionLine2: clean(parsed.descriptionLine2).slice(0, 90),
  };
}

export async function getStoredGoogleAdsSettings() {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, googleAdsSettingsKey))
    .limit(1);

  return row ? normalizeGoogleAdsSettings(row.value) : defaultGoogleAdsSettings;
}

export async function saveStoredGoogleAdsSettings(settings: GoogleAdsSettings) {
  const normalized = normalizeGoogleAdsSettings(settings);

  await db
    .insert(platformSettings)
    .values({
      key: googleAdsSettingsKey,
      value: normalized,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: {
        value: normalized,
        updatedAt: new Date(),
      },
    });

  return normalized;
}

export function hasGoogleAdsApiCredentials(settings: GoogleAdsSettings) {
  return Boolean(
    settings.developerToken &&
      settings.clientId &&
      settings.clientSecret &&
      settings.refreshToken &&
      settings.customerId &&
      settings.dsaCampaignId,
  );
}
