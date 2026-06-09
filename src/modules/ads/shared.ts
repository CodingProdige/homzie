export const adChannels = ["homzie", "google"] as const;
export type AdChannel = (typeof adChannels)[number];

export const adPromotedTypes = ["profile", "listing", "reel"] as const;
export type AdPromotedType = (typeof adPromotedTypes)[number];

export const adObjectives = [
  "awareness",
  "traffic",
  "lead_generation",
  "engagement",
] as const;
export type AdObjective = (typeof adObjectives)[number];

export type AdsSettings = {
  allowGoogleAds: boolean;
  allowHomzieAds: boolean;
  defaultMarginPercent: number;
  googleMarginPercent: number;
  homzieMarginPercent: number;
  minCampaignBudgetCents: number;
  maxCampaignBudgetCents: number;
  homzieAverageCpmCents: number;
  googleAverageCpmCents: number;
  homzieReachSharePercent: number;
  googleReachSharePercent: number;
  homzieCtrPercent: number;
  googleCtrPercent: number;
  profileVisitRatePercent: number;
  listingViewRatePercent: number;
  reelPlayRatePercent: number;
  leadRatePercent: number;
};

export const defaultAdsSettings: AdsSettings = {
  allowGoogleAds: true,
  allowHomzieAds: true,
  defaultMarginPercent: 18,
  googleMarginPercent: 15,
  homzieMarginPercent: 22,
  minCampaignBudgetCents: 50_000,
  maxCampaignBudgetCents: 500_000,
  homzieAverageCpmCents: 4_200,
  googleAverageCpmCents: 6_800,
  homzieReachSharePercent: 68,
  googleReachSharePercent: 74,
  homzieCtrPercent: 1.8,
  googleCtrPercent: 2.4,
  profileVisitRatePercent: 28,
  listingViewRatePercent: 24,
  reelPlayRatePercent: 36,
  leadRatePercent: 6,
};

export function getChannelMarginPercent(settings: AdsSettings, channel: AdChannel) {
  return channel === "google"
    ? settings.googleMarginPercent || settings.defaultMarginPercent
    : settings.homzieMarginPercent || settings.defaultMarginPercent;
}

export function getPrimaryOutcomeLabel(
  promotedType: AdPromotedType,
  objective: AdObjective,
) {
  if (objective === "lead_generation") {
    return "Estimated leads";
  }

  if (promotedType === "profile") return "Estimated profile visits";
  if (promotedType === "listing") return "Estimated listing views";
  return "Estimated reel plays";
}
