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

function resolveAudienceCap({
  channel,
  promotedType,
  safeDuration,
  targetActiveUsersEstimate,
  targetPopulationEstimate,
}: {
  channel: AdChannel;
  promotedType: AdPromotedType;
  safeDuration: number;
  targetActiveUsersEstimate?: number;
  targetPopulationEstimate?: number;
}) {
  const activeUsers = Math.max(0, targetActiveUsersEstimate || 0);
  const population = Math.max(0, targetPopulationEstimate || 0);
  const durationCoverage = Math.min(1, 0.55 + safeDuration / 60);

  if (channel === "homzie" && activeUsers > 0) {
    const promotedTypeWeight =
      promotedType === "profile" ? 1 : promotedType === "listing" ? 0.92 : 0.78;

    return Math.max(
      1,
      Math.round(activeUsers * durationCoverage * promotedTypeWeight),
    );
  }

  if (channel === "google" && population > 0) {
    const populationCoverage = Math.min(0.35, 0.08 + safeDuration / 180);
    return Math.max(1, Math.round(population * populationCoverage));
  }

  return null;
}

export function buildAdForecast({
  channel,
  durationDays,
  objective,
  promotedType,
  settings,
  targetActiveUsersEstimate,
  targetPopulationEstimate,
  totalBudgetCents,
}: {
  channel: AdChannel;
  durationDays: number;
  objective: AdObjective;
  promotedType: AdPromotedType;
  settings: AdsSettings;
  targetActiveUsersEstimate?: number;
  targetPopulationEstimate?: number;
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

  const baseEstimatedImpressions = Math.max(
    0,
    Math.round((netMediaBudgetCents / averageCpmCents) * 1000),
  );
  const durationReachMultiplier = Math.min(1.2, 0.85 + safeDuration / 60);
  const baseEstimatedReach = Math.max(
    0,
    Math.round(
      baseEstimatedImpressions *
        (reachSharePercent / 100) *
        durationReachMultiplier,
    ),
  );
  const baseEstimatedClicks = Math.max(
    0,
    Math.round(baseEstimatedImpressions * (ctrPercent / 100)),
  );
  const baseEstimatedResults = Math.max(
    0,
    Math.round(baseEstimatedClicks * (outcomeRatePercent / 100)),
  );
  const audienceCap = resolveAudienceCap({
    channel,
    promotedType,
    safeDuration,
    targetActiveUsersEstimate,
    targetPopulationEstimate,
  });
  const audienceScale =
    audienceCap && baseEstimatedReach > audienceCap
      ? audienceCap / baseEstimatedReach
      : 1;
  const estimatedImpressions = Math.max(
    0,
    Math.round(baseEstimatedImpressions * audienceScale),
  );
  const estimatedReach = Math.max(
    0,
    Math.round(baseEstimatedReach * audienceScale),
  );
  const estimatedClicks = Math.max(
    0,
    Math.round(baseEstimatedClicks * audienceScale),
  );
  const estimatedResults = Math.max(
    0,
    Math.round(baseEstimatedResults * audienceScale),
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
