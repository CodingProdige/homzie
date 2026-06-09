import {
  type AdChannel,
  type AdObjective,
  type AdPromotedType,
  type AdsSettings,
  getChannelMarginPercent,
} from "@/modules/ads/shared";

export type AdForecast = {
  estimatedClicks: number;
  estimatedImpressions: number;
  estimatedReach: number;
  estimatedResults: number;
  marginPercent: number;
  netMediaBudgetCents: number;
};

function outcomeRateForPromotedType(
  settings: AdsSettings,
  promotedType: AdPromotedType,
  objective: AdObjective,
) {
  if (objective === "lead_generation") {
    return settings.leadRatePercent;
  }

  if (promotedType === "profile") return settings.profileVisitRatePercent;
  if (promotedType === "listing") return settings.listingViewRatePercent;
  return settings.reelPlayRatePercent;
}

export function buildAdForecast({
  channel,
  durationDays,
  objective,
  promotedType,
  settings,
  totalBudgetCents,
}: {
  channel: AdChannel;
  durationDays: number;
  objective: AdObjective;
  promotedType: AdPromotedType;
  settings: AdsSettings;
  totalBudgetCents: number;
}): AdForecast {
  const safeBudget = Math.max(
    settings.minCampaignBudgetCents,
    Math.min(totalBudgetCents, settings.maxCampaignBudgetCents),
  );
  const safeDuration = Math.max(1, Math.min(durationDays, 90));
  const marginPercent = getChannelMarginPercent(settings, channel);
  const netMediaBudgetCents = Math.max(
    0,
    Math.round(safeBudget * (1 - marginPercent / 100)),
  );

  const averageCpmCents =
    channel === "google"
      ? settings.googleAverageCpmCents
      : settings.homzieAverageCpmCents;
  const reachSharePercent =
    channel === "google"
      ? settings.googleReachSharePercent
      : settings.homzieReachSharePercent;
  const ctrPercent =
    channel === "google" ? settings.googleCtrPercent : settings.homzieCtrPercent;
  const outcomeRatePercent = outcomeRateForPromotedType(
    settings,
    promotedType,
    objective,
  );

  const estimatedImpressions = Math.max(
    0,
    Math.round((netMediaBudgetCents / averageCpmCents) * 1000),
  );
  const durationReachMultiplier = Math.min(1.2, 0.85 + safeDuration / 60);
  const estimatedReach = Math.max(
    0,
    Math.round(estimatedImpressions * (reachSharePercent / 100) * durationReachMultiplier),
  );
  const estimatedClicks = Math.max(
    0,
    Math.round(estimatedImpressions * (ctrPercent / 100)),
  );
  const estimatedResults = Math.max(
    0,
    Math.round(estimatedClicks * (outcomeRatePercent / 100)),
  );

  return {
    estimatedClicks,
    estimatedImpressions,
    estimatedReach,
    estimatedResults,
    marginPercent,
    netMediaBudgetCents,
  };
}

export function formatCurrencyFromCents(value: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

export function averageDailyBudget(totalBudgetCents: number, durationDays: number) {
  return Math.round(totalBudgetCents / Math.max(durationDays, 1));
}
