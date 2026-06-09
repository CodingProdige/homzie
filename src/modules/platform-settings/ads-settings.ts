import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import {
  defaultAdsSettings,
  getChannelMarginPercent,
  getPrimaryOutcomeLabel,
  type AdsSettings,
} from "@/modules/ads/shared";

const adsSettingsKey = "ads";

const adsSettingsSchema = z.object({
  allowGoogleAds: z.boolean().catch(defaultAdsSettings.allowGoogleAds),
  allowHomzieAds: z.boolean().catch(defaultAdsSettings.allowHomzieAds),
  defaultMarginPercent: z.number().finite().catch(defaultAdsSettings.defaultMarginPercent),
  googleMarginPercent: z.number().finite().catch(defaultAdsSettings.googleMarginPercent),
  homzieMarginPercent: z.number().finite().catch(defaultAdsSettings.homzieMarginPercent),
  minCampaignBudgetCents: z
    .number()
    .int()
    .nonnegative()
    .catch(defaultAdsSettings.minCampaignBudgetCents),
  maxCampaignBudgetCents: z
    .number()
    .int()
    .positive()
    .catch(defaultAdsSettings.maxCampaignBudgetCents),
  homzieAverageCpmCents: z
    .number()
    .int()
    .positive()
    .catch(defaultAdsSettings.homzieAverageCpmCents),
  googleAverageCpmCents: z
    .number()
    .int()
    .positive()
    .catch(defaultAdsSettings.googleAverageCpmCents),
  homzieReachSharePercent: z
    .number()
    .finite()
    .catch(defaultAdsSettings.homzieReachSharePercent),
  googleReachSharePercent: z
    .number()
    .finite()
    .catch(defaultAdsSettings.googleReachSharePercent),
  homzieCtrPercent: z.number().finite().catch(defaultAdsSettings.homzieCtrPercent),
  googleCtrPercent: z.number().finite().catch(defaultAdsSettings.googleCtrPercent),
  profileVisitRatePercent: z
    .number()
    .finite()
    .catch(defaultAdsSettings.profileVisitRatePercent),
  listingViewRatePercent: z
    .number()
    .finite()
    .catch(defaultAdsSettings.listingViewRatePercent),
  reelPlayRatePercent: z
    .number()
    .finite()
    .catch(defaultAdsSettings.reelPlayRatePercent),
  leadRatePercent: z.number().finite().catch(defaultAdsSettings.leadRatePercent),
});

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeAdsSettings(value: unknown): AdsSettings {
  const parsed = adsSettingsSchema.parse(value || defaultAdsSettings);

  return {
    allowGoogleAds: parsed.allowGoogleAds,
    allowHomzieAds: parsed.allowHomzieAds,
    defaultMarginPercent: clamp(parsed.defaultMarginPercent, 0, 95),
    googleMarginPercent: clamp(parsed.googleMarginPercent, 0, 95),
    homzieMarginPercent: clamp(parsed.homzieMarginPercent, 0, 95),
    minCampaignBudgetCents: clamp(parsed.minCampaignBudgetCents, 10_000, 10_000_000),
    maxCampaignBudgetCents: clamp(
      Math.max(parsed.maxCampaignBudgetCents, parsed.minCampaignBudgetCents),
      20_000,
      20_000_000,
    ),
    homzieAverageCpmCents: clamp(parsed.homzieAverageCpmCents, 500, 500_000),
    googleAverageCpmCents: clamp(parsed.googleAverageCpmCents, 500, 500_000),
    homzieReachSharePercent: clamp(parsed.homzieReachSharePercent, 1, 100),
    googleReachSharePercent: clamp(parsed.googleReachSharePercent, 1, 100),
    homzieCtrPercent: clamp(parsed.homzieCtrPercent, 0.1, 100),
    googleCtrPercent: clamp(parsed.googleCtrPercent, 0.1, 100),
    profileVisitRatePercent: clamp(parsed.profileVisitRatePercent, 0.1, 100),
    listingViewRatePercent: clamp(parsed.listingViewRatePercent, 0.1, 100),
    reelPlayRatePercent: clamp(parsed.reelPlayRatePercent, 0.1, 100),
    leadRatePercent: clamp(parsed.leadRatePercent, 0.1, 100),
  };
}

export async function getStoredAdsSettings() {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, adsSettingsKey))
    .limit(1);

  return row ? normalizeAdsSettings(row.value) : defaultAdsSettings;
}

export async function saveStoredAdsSettings(settings: AdsSettings) {
  const normalized = normalizeAdsSettings(settings);

  await db
    .insert(platformSettings)
    .values({
      key: adsSettingsKey,
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

export { getChannelMarginPercent, getPrimaryOutcomeLabel };
