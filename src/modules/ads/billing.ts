import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  adCampaignDeliveryDaily,
  adCampaigns,
  adInvoices,
  adSpendLedger,
  listingActionEvents,
  propertyListings,
  listingViewEvents,
  profileViewEvents,
  reelListingClicks,
  reelWatchSessions,
  subscriptions,
  userFollows,
  users,
} from "@/db/schema";
import { getStripe } from "@/modules/billing/stripe";
import { getGoogleDsaDailyMetrics } from "@/modules/google-ads/dsa";
import { getStoredAdsSettings } from "@/modules/platform-settings/ads-settings";

const ACTIVE_CAMPAIGN_STATUSES = ["ready", "live"] as const;
const BILLABLE_CAMPAIGN_STATUSES = ["ready", "live", "paused"] as const;
const BILLABLE_ENTRY_TYPES = ["spend", "adjustment"] as const;

type BillingWindow = {
  periodEnd: Date;
  periodStart: Date;
};

type DailyDelivery = {
  clicks: number;
  externalReference: string | null;
  impressions: number;
  metadata?: Record<string, unknown>;
  metricDate: string;
  results: number;
};

type BillableCampaignSnapshot = {
  billedSpendCents: number;
  channel: string;
  deliveredSpendCents: number;
  durationDays: number;
  id: string;
  launchedAt: Date | null;
  listingId: string | null;
  netMediaBudgetCents: number;
  pausedAt: Date | null;
  promotedType: string;
  reelId: string | null;
  resumedAt: Date | null;
  status: string;
  totalBudgetCents: number;
  userId: string;
};

function addMonths(value: Date, months: number) {
  const next = new Date(value);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getBillingWindow(anchor: Date, occurredAt: Date): BillingWindow {
  let periodStart = new Date(anchor);
  let periodEnd = addMonths(periodStart, 1);

  while (occurredAt >= periodEnd) {
    periodStart = periodEnd;
    periodEnd = addMonths(periodStart, 1);
  }

  return { periodStart, periodEnd };
}

async function ensureAdsBillingAnchor(userId: string) {
  const [user] = await db
    .select({
      adsBillingAnchorAt: users.adsBillingAnchorAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error("We could not find your account.");
  }

  if (user.adsBillingAnchorAt) {
    return new Date(user.adsBillingAnchorAt);
  }

  const [subscription] = await db
    .select({
      currentPeriodStart: subscriptions.currentPeriodStart,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  const anchor =
    subscription?.currentPeriodStart ||
    subscription?.createdAt ||
    user.createdAt ||
    new Date();

  await db
    .update(users)
    .set({
      adsBillingAnchorAt: anchor,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return new Date(anchor);
}

function getCampaignCapDate(campaign: {
  durationDays: number;
  launchedAt: Date | null;
}) {
  if (!campaign.launchedAt) {
    return null;
  }

  return new Date(
    new Date(campaign.launchedAt).getTime() +
      Math.max(campaign.durationDays, 1) * 24 * 60 * 60 * 1000,
  );
}

function startOfDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function toMetricDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function metricDateToUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function mergeDailyRows(rows: DailyDelivery[]) {
  const merged = new Map<string, DailyDelivery>();

  for (const row of rows) {
    const existing = merged.get(row.metricDate);

    if (existing) {
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      existing.results += row.results;
      existing.metadata = {
        ...(existing.metadata || {}),
        ...(row.metadata || {}),
      };
      continue;
    }

    merged.set(row.metricDate, {
      clicks: row.clicks,
      externalReference: row.externalReference,
      impressions: row.impressions,
      metadata: row.metadata,
      metricDate: row.metricDate,
      results: row.results,
    });
  }

  return [...merged.values()].sort((first, second) =>
    first.metricDate.localeCompare(second.metricDate),
  );
}

function distributeInteger(
  total: number,
  weights: number[],
) {
  if (total <= 0 || !weights.length) {
    return new Array(weights.length).fill(0);
  }

  const normalizedWeights = weights.map((weight) => Math.max(weight, 0));
  const weightTotal = normalizedWeights.reduce((sum, weight) => sum + weight, 0);
  const effectiveWeights =
    weightTotal > 0
      ? normalizedWeights
      : new Array(weights.length).fill(1);
  const effectiveWeightTotal = effectiveWeights.reduce((sum, weight) => sum + weight, 0);

  const allocations = effectiveWeights.map((weight, index) => {
    const raw = (total * weight) / effectiveWeightTotal;
    return {
      fraction: raw - Math.floor(raw),
      index,
      value: Math.floor(raw),
    };
  });

  let remaining = total - allocations.reduce((sum, allocation) => sum + allocation.value, 0);

  allocations
    .slice()
    .sort((first, second) => second.fraction - first.fraction)
    .forEach((allocation) => {
      if (remaining <= 0) {
        return;
      }

      allocations[allocation.index]!.value += 1;
      remaining -= 1;
    });

  return allocations
    .sort((first, second) => first.index - second.index)
    .map((allocation) => allocation.value);
}

function isCampaignDeliveringOnMetricDate(
  campaign: Pick<
    BillableCampaignSnapshot,
    "durationDays" | "launchedAt" | "pausedAt" | "resumedAt"
  >,
  metricDate: string,
) {
  if (!campaign.launchedAt) {
    return false;
  }

  const metricDay = metricDateToUtcDate(metricDate);
  const launchDay = startOfDay(new Date(campaign.launchedAt));

  if (metricDay < launchDay) {
    return false;
  }

  const capDate = getCampaignCapDate(campaign);
  if (capDate && metricDay >= startOfDay(capDate)) {
    return false;
  }

  if (campaign.pausedAt) {
    const pausedDay = startOfDay(new Date(campaign.pausedAt));

    if (!campaign.resumedAt) {
      return metricDay < pausedDay;
    }

    const resumedDay = startOfDay(new Date(campaign.resumedAt));
    if (resumedDay > pausedDay && metricDay >= pausedDay && metricDay < resumedDay) {
      return false;
    }
  }

  return true;
}

async function updateCampaignBilledSpendFromLedger(
  tx: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0],
  campaignIds: string[],
) {
  if (!campaignIds.length) {
    return;
  }

  const totals = await tx
    .select({
      campaignId: adSpendLedger.campaignId,
      total: sql<number>`coalesce(sum(${adSpendLedger.amountCents}), 0)`,
    })
    .from(adSpendLedger)
    .where(
      and(
        inArray(adSpendLedger.campaignId, campaignIds),
        inArray(adSpendLedger.entryType, BILLABLE_ENTRY_TYPES as unknown as string[]),
        sql`${adSpendLedger.invoiceId} is not null`,
      ),
    )
    .groupBy(adSpendLedger.campaignId);

  const totalByCampaignId = new Map(
    totals.map((row) => [row.campaignId, row.total || 0]),
  );

  await Promise.all(
    campaignIds.map((campaignId) =>
      tx
        .update(adCampaigns)
        .set({
          billedSpendCents: totalByCampaignId.get(campaignId) || 0,
          updatedAt: new Date(),
        })
        .where(eq(adCampaigns.id, campaignId)),
    ),
  );
}

async function recordCampaignSpendDelta(
  tx: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0],
  campaign: BillableCampaignSnapshot,
  deliveredSpendCents: number,
  occurredAt: Date,
  metadata: Record<string, unknown>,
) {
  const [ledgerTotals] = await tx
    .select({
      total: sql<number>`coalesce(sum(${adSpendLedger.amountCents}), 0)`,
    })
    .from(adSpendLedger)
    .where(
      and(
        eq(adSpendLedger.campaignId, campaign.id),
        inArray(adSpendLedger.entryType, BILLABLE_ENTRY_TYPES as unknown as string[]),
      ),
    );

  const existingSpendTotal = ledgerTotals?.total || 0;
  const delta = deliveredSpendCents - existingSpendTotal;

  if (!delta) {
    return;
  }

  const billingAnchor = await ensureAdsBillingAnchor(campaign.userId);
  const window = getBillingWindow(billingAnchor, occurredAt);

  await tx.insert(adSpendLedger).values({
    amountCents: delta,
    billingPeriodEnd: window.periodEnd,
    billingPeriodStart: window.periodStart,
    campaignId: campaign.id,
    channel: campaign.channel,
    createdAt: occurredAt,
    description:
      delta > 0 ? "Delivered ad spend" : "Ad spend adjustment",
    entryType: delta > 0 ? "spend" : "adjustment",
    metadata,
    occurredAt,
    userId: campaign.userId,
  });
}

async function syncGoogleSharedCampaignSpend() {
  const campaigns = await db
    .select({
      billedSpendCents: adCampaigns.billedSpendCents,
      channel: adCampaigns.channel,
      deliveredSpendCents: adCampaigns.deliveredSpendCents,
      durationDays: adCampaigns.durationDays,
      id: adCampaigns.id,
      launchedAt: adCampaigns.launchedAt,
      listingId: adCampaigns.listingId,
      netMediaBudgetCents: adCampaigns.netMediaBudgetCents,
      pausedAt: adCampaigns.pausedAt,
      promotedType: adCampaigns.promotedType,
      reelId: adCampaigns.reelId,
      resumedAt: adCampaigns.resumedAt,
      status: adCampaigns.status,
      totalBudgetCents: adCampaigns.totalBudgetCents,
      userId: adCampaigns.userId,
    })
    .from(adCampaigns)
    .innerJoin(propertyListings, eq(propertyListings.id, adCampaigns.listingId))
    .where(
      and(
        eq(adCampaigns.channel, "google"),
        eq(adCampaigns.promotedType, "listing"),
        eq(propertyListings.status, "published"),
        inArray(adCampaigns.status, BILLABLE_CAMPAIGN_STATUSES as unknown as string[]),
      ),
    );

  if (!campaigns.length) {
    return;
  }

  const launchedCampaigns = campaigns.filter((campaign) => campaign.launchedAt);

  if (!launchedCampaigns.length) {
    return;
  }

  const now = new Date();
  const startDate = launchedCampaigns
    .map((campaign) => new Date(campaign.launchedAt as Date))
    .sort((first, second) => first.getTime() - second.getTime())[0];

  if (!startDate) {
    return;
  }

  try {
    const googleRows = await getGoogleDsaDailyMetrics({
      endDate: toMetricDate(now),
      startDate: toMetricDate(startDate),
    });

    const deliveryByCampaign = new Map<string, (typeof adCampaignDeliveryDaily.$inferInsert)[]>();

    for (const row of googleRows) {
      const eligibleCampaigns = launchedCampaigns.filter((campaign) =>
        isCampaignDeliveringOnMetricDate(campaign, row.metricDate),
      );

      if (!eligibleCampaigns.length) {
        continue;
      }

      const weights = eligibleCampaigns.map((campaign) =>
        Math.max(
          1,
          Math.round(campaign.netMediaBudgetCents / Math.max(campaign.durationDays, 1)),
        ),
      );

      const impressionAllocations = distributeInteger(row.impressions, weights);
      const clickAllocations = distributeInteger(row.clicks, weights);
      const amountAllocations = distributeInteger(row.amountCents, weights);

      eligibleCampaigns.forEach((campaign, index) => {
        const impressions = impressionAllocations[index] || 0;
        const clicks = clickAllocations[index] || 0;
        const amountCents = amountAllocations[index] || 0;
        const entries = deliveryByCampaign.get(campaign.id) || [];

        entries.push({
          amountCents,
          campaignId: campaign.id,
          channel: "google",
          clicks,
          createdAt: now,
          externalReference: row.externalReference,
          impressions,
          metadata: {
            allocationMode: "shared_google_campaign_weighted",
            eligibleCampaignCount: eligibleCampaigns.length,
            sharedCampaignDate: row.metricDate,
          },
          metricDate: row.metricDate,
          results: clicks,
          source: "google_ads_sync",
          updatedAt: now,
          userId: campaign.userId,
        });

        deliveryByCampaign.set(campaign.id, entries);
      });
    }

    await db.transaction(async (tx) => {
      for (const campaign of launchedCampaigns) {
        const rows = deliveryByCampaign.get(campaign.id) || [];

        if (rows.length) {
          await tx
            .insert(adCampaignDeliveryDaily)
            .values(rows)
            .onConflictDoUpdate({
              target: [
                adCampaignDeliveryDaily.campaignId,
                adCampaignDeliveryDaily.metricDate,
                adCampaignDeliveryDaily.source,
              ],
              set: {
                amountCents: sql`excluded.amount_cents`,
                clicks: sql`excluded.clicks`,
                externalReference: sql`excluded.external_reference`,
                impressions: sql`excluded.impressions`,
                metadata: sql`excluded.metadata`,
                results: sql`excluded.results`,
                updatedAt: sql`now()`,
              },
            });
        }

        const deliveredSpendCents = rows.reduce(
          (total, row) => total + (row.amountCents ?? 0),
          0,
        );

        await recordCampaignSpendDelta(tx, campaign, deliveredSpendCents, now, {
          deliveredThrough: toMetricDate(now),
          deliveryMode: "google_reported",
          source: "google_ads_sync",
        });

        await tx
          .update(adCampaigns)
          .set({
            deliveredSpendCents,
            lastSpendSyncedAt: now,
            updatedAt: now,
          })
          .where(eq(adCampaigns.id, campaign.id));
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Google spend sync failed.";

    await db
      .update(adCampaigns)
      .set({
        googleLastSyncedAt: now,
        googleSyncError: message,
        googleSyncStatus: "sync_error",
        updatedAt: now,
      })
      .where(and(eq(adCampaigns.channel, "google"), eq(adCampaigns.promotedType, "listing")));
  }
}

async function getHomzieCampaignDeliveryRows(campaign: {
  id: string;
  launchedAt: Date | null;
  promotedType: string;
  listingId: string | null;
  reelId: string | null;
  userId: string;
}, endAt: Date) {
  if (!campaign.launchedAt) {
    return [] as DailyDelivery[];
  }

  const launchTime = new Date(campaign.launchedAt);
  const rangeStart = launchTime;
  const rangeEnd = endAt;

  if (rangeEnd <= rangeStart) {
    return [] as DailyDelivery[];
  }

  if (campaign.promotedType === "profile") {
    const metricDateExpr = sql<string>`date(${profileViewEvents.createdAt})::text`;
    const resultDateExpr = sql<string>`date(${userFollows.createdAt})::text`;

    const [viewRows, resultRows] = await Promise.all([
      db
        .select({
          impressions: sql<number>`count(*)::int`,
          metricDate: metricDateExpr,
        })
        .from(profileViewEvents)
        .where(
          and(
            eq(profileViewEvents.profileUserId, campaign.userId),
            gte(profileViewEvents.createdAt, rangeStart),
            lte(profileViewEvents.createdAt, rangeEnd),
          ),
        )
        .groupBy(metricDateExpr),
      db
        .select({
          metricDate: resultDateExpr,
          results: sql<number>`count(*)::int`,
        })
        .from(userFollows)
        .where(
          and(
            eq(userFollows.followingId, campaign.userId),
            gte(userFollows.createdAt, rangeStart),
            lte(userFollows.createdAt, rangeEnd),
          ),
        )
        .groupBy(resultDateExpr),
    ]);

    return mergeDailyRows([
      ...viewRows.map((row) => ({
        clicks: 0,
        externalReference: null,
        impressions: row.impressions,
        metricDate: row.metricDate,
        results: 0,
      })),
      ...resultRows.map((row) => ({
        clicks: 0,
        externalReference: null,
        impressions: 0,
        metricDate: row.metricDate,
        results: row.results,
      })),
    ]);
  }

  if (campaign.promotedType === "listing" && campaign.listingId) {
    const metricDateExpr = sql<string>`date(${listingViewEvents.createdAt})::text`;
    const actionDateExpr = sql<string>`date(${listingActionEvents.createdAt})::text`;

    const [viewRows, actionRows] = await Promise.all([
      db
        .select({
          impressions: sql<number>`count(*)::int`,
          metricDate: metricDateExpr,
        })
        .from(listingViewEvents)
        .where(
          and(
            eq(listingViewEvents.listingId, campaign.listingId),
            gte(listingViewEvents.createdAt, rangeStart),
            lte(listingViewEvents.createdAt, rangeEnd),
          ),
        )
        .groupBy(metricDateExpr),
      db
        .select({
          clicks: sql<number>`count(*)::int`,
          metricDate: actionDateExpr,
        })
        .from(listingActionEvents)
        .where(
          and(
            eq(listingActionEvents.listingId, campaign.listingId),
            gte(listingActionEvents.createdAt, rangeStart),
            lte(listingActionEvents.createdAt, rangeEnd),
          ),
        )
        .groupBy(actionDateExpr),
    ]);

    return mergeDailyRows([
      ...viewRows.map((row) => ({
        clicks: 0,
        externalReference: campaign.listingId,
        impressions: row.impressions,
        metricDate: row.metricDate,
        results: 0,
      })),
      ...actionRows.map((row) => ({
        clicks: row.clicks,
        externalReference: campaign.listingId,
        impressions: 0,
        metricDate: row.metricDate,
        results: row.clicks,
      })),
    ]);
  }

  if (campaign.promotedType === "reel" && campaign.reelId) {
    const metricDateExpr = sql<string>`date(${reelWatchSessions.createdAt})::text`;
    const clickDateExpr = sql<string>`date(${reelListingClicks.createdAt})::text`;

    const [watchRows, clickRows] = await Promise.all([
      db
        .select({
          impressions: sql<number>`count(*)::int`,
          metricDate: metricDateExpr,
        })
        .from(reelWatchSessions)
        .where(
          and(
            eq(reelWatchSessions.reelId, campaign.reelId),
            gte(reelWatchSessions.createdAt, rangeStart),
            lte(reelWatchSessions.createdAt, rangeEnd),
          ),
        )
        .groupBy(metricDateExpr),
      db
        .select({
          clicks: sql<number>`count(*)::int`,
          metricDate: clickDateExpr,
        })
        .from(reelListingClicks)
        .where(
          and(
            eq(reelListingClicks.reelId, campaign.reelId),
            gte(reelListingClicks.createdAt, rangeStart),
            lte(reelListingClicks.createdAt, rangeEnd),
          ),
        )
        .groupBy(clickDateExpr),
    ]);

    return mergeDailyRows([
      ...watchRows.map((row) => ({
        clicks: 0,
        externalReference: campaign.reelId,
        impressions: row.impressions,
        metricDate: row.metricDate,
        results: 0,
      })),
      ...clickRows.map((row) => ({
        clicks: row.clicks,
        externalReference: campaign.reelId,
        impressions: 0,
        metricDate: row.metricDate,
        results: row.clicks,
      })),
    ]);
  }

  return [];
}

export async function syncAdCampaignSpend(campaignId: string) {
  const [campaign] = await db
    .select({
      billedSpendCents: adCampaigns.billedSpendCents,
      channel: adCampaigns.channel,
      deliveredSpendCents: adCampaigns.deliveredSpendCents,
      durationDays: adCampaigns.durationDays,
      id: adCampaigns.id,
      launchedAt: adCampaigns.launchedAt,
      listingId: adCampaigns.listingId,
      netMediaBudgetCents: adCampaigns.netMediaBudgetCents,
      pausedAt: adCampaigns.pausedAt,
      promotedType: adCampaigns.promotedType,
      reelId: adCampaigns.reelId,
      resumedAt: adCampaigns.resumedAt,
      status: adCampaigns.status,
      totalBudgetCents: adCampaigns.totalBudgetCents,
      userId: adCampaigns.userId,
    })
    .from(adCampaigns)
    .where(eq(adCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  if (!campaign.launchedAt) {
    return { accruedCents: 0, campaign };
  }

  const now = new Date();
  const launchTime = new Date(campaign.launchedAt);
  const campaignCapDate = getCampaignCapDate(campaign);
  const cappedNow =
    campaignCapDate && campaignCapDate < now ? campaignCapDate : now;

  if (cappedNow <= launchTime) {
    return { accruedCents: 0, campaign };
  }

  if (campaign.channel === "google") {
    await syncGoogleSharedCampaignSpend();
    const [updatedCampaign] = await db
      .select({
        billedSpendCents: adCampaigns.billedSpendCents,
        channel: adCampaigns.channel,
        deliveredSpendCents: adCampaigns.deliveredSpendCents,
        durationDays: adCampaigns.durationDays,
        id: adCampaigns.id,
        launchedAt: adCampaigns.launchedAt,
        listingId: adCampaigns.listingId,
        netMediaBudgetCents: adCampaigns.netMediaBudgetCents,
        pausedAt: adCampaigns.pausedAt,
        promotedType: adCampaigns.promotedType,
        reelId: adCampaigns.reelId,
        resumedAt: adCampaigns.resumedAt,
        status: adCampaigns.status,
        totalBudgetCents: adCampaigns.totalBudgetCents,
        userId: adCampaigns.userId,
      })
      .from(adCampaigns)
      .where(eq(adCampaigns.id, campaignId))
      .limit(1);

    return { accruedCents: 0, campaign: updatedCampaign || campaign };
  }

  if (campaign.channel !== "homzie") {
    await db
      .update(adCampaigns)
      .set({
        lastSpendSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(adCampaigns.id, campaign.id));

    return { accruedCents: 0, campaign };
  }

  const settings = await getStoredAdsSettings();
  const cpmCents = Math.max(settings.homzieAverageCpmCents, 0);
  const deliveryRows = await getHomzieCampaignDeliveryRows(campaign, cappedNow);
  let remainingBudget = Math.max(campaign.totalBudgetCents, 0);

  const measuredRows = deliveryRows.map((row) => {
    const uncappedAmount = Math.max(
      0,
      Math.round((row.impressions / 1000) * cpmCents),
    );
    const amountCents = Math.min(remainingBudget, uncappedAmount);
    remainingBudget = Math.max(0, remainingBudget - amountCents);

    return {
      amountCents,
      campaignId: campaign.id,
      channel: campaign.channel,
      clicks: row.clicks,
      createdAt: now,
      externalReference: row.externalReference,
      impressions: row.impressions,
      metadata: {
        ...(row.metadata || {}),
        cpmCents,
        promotedType: campaign.promotedType,
      },
      metricDate: row.metricDate,
      results: row.results,
      source: "homzie_live" as const,
      updatedAt: now,
      userId: campaign.userId,
    };
  });

  const measuredDeliveredSpend = measuredRows.reduce(
    (total, row) => total + row.amountCents,
    0,
  );

  const [existingLedgerSpend] = await db
    .select({
      total: sql<number>`coalesce(sum(${adSpendLedger.amountCents}), 0)`,
    })
    .from(adSpendLedger)
    .where(
      and(
        eq(adSpendLedger.campaignId, campaign.id),
        inArray(adSpendLedger.entryType, BILLABLE_ENTRY_TYPES as unknown as string[]),
      ),
    );

  const existingSpendTotal = existingLedgerSpend?.total || 0;
  const deliveredSpendCents = Math.max(
    measuredDeliveredSpend,
    existingSpendTotal,
    campaign.deliveredSpendCents,
  );
  const delta = Math.max(0, deliveredSpendCents - existingSpendTotal);

  await db.transaction(async (tx) => {
    await tx
      .delete(adCampaignDeliveryDaily)
      .where(
        and(
          eq(adCampaignDeliveryDaily.campaignId, campaign.id),
          eq(adCampaignDeliveryDaily.source, "homzie_live"),
        ),
      );

    if (measuredRows.length) {
      await tx.insert(adCampaignDeliveryDaily).values(measuredRows);
    }

    if (delta > 0) {
      const billingAnchor = await ensureAdsBillingAnchor(campaign.userId);
      const window = getBillingWindow(billingAnchor, cappedNow);

      await tx.insert(adSpendLedger).values({
        amountCents: delta,
        billingPeriodEnd: window.periodEnd,
        billingPeriodStart: window.periodStart,
        campaignId: campaign.id,
        channel: campaign.channel,
        createdAt: now,
        description: "Delivered ad spend",
        entryType: "spend",
        metadata: {
          capDate: campaignCapDate?.toISOString() || null,
          cpmCents,
          deliveryMode: "measured",
          durationDays: campaign.durationDays,
          netMediaBudgetCents: campaign.netMediaBudgetCents,
          source: "homzie_live",
          syncedThrough: startOfDay(cappedNow).toISOString(),
        },
        occurredAt: cappedNow,
        userId: campaign.userId,
      });
    } else if (delta < 0) {
      const billingAnchor = await ensureAdsBillingAnchor(campaign.userId);
      const window = getBillingWindow(billingAnchor, cappedNow);

      await tx.insert(adSpendLedger).values({
        amountCents: delta,
        billingPeriodEnd: window.periodEnd,
        billingPeriodStart: window.periodStart,
        campaignId: campaign.id,
        channel: campaign.channel,
        createdAt: now,
        description: "Ad spend adjustment",
        entryType: "adjustment",
        metadata: {
          capDate: campaignCapDate?.toISOString() || null,
          cpmCents,
          deliveryMode: "measured",
          durationDays: campaign.durationDays,
          netMediaBudgetCents: campaign.netMediaBudgetCents,
          source: "homzie_live",
          syncedThrough: startOfDay(cappedNow).toISOString(),
        },
        occurredAt: cappedNow,
        userId: campaign.userId,
      });
    }

    await tx
      .update(adCampaigns)
      .set({
        deliveredSpendCents,
        lastSpendSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(adCampaigns.id, campaign.id));
  });

  return { accruedCents: delta, campaign };
}

export async function syncUserAdSpend(userId: string) {
  await syncGoogleSharedCampaignSpend();

  const campaigns = await db
    .select({ id: adCampaigns.id })
    .from(adCampaigns)
    .where(
      and(
        eq(adCampaigns.userId, userId),
        inArray(adCampaigns.status, BILLABLE_CAMPAIGN_STATUSES as unknown as string[]),
      ),
    );

  for (const campaign of campaigns) {
    await syncAdCampaignSpend(campaign.id);
  }
}

export async function recordAdCampaignLifecycleEvent(
  campaignId: string,
  eventType: "pause" | "resume",
) {
  const [campaign] = await db
    .select({
      channel: adCampaigns.channel,
      id: adCampaigns.id,
      userId: adCampaigns.userId,
    })
    .from(adCampaigns)
    .where(eq(adCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  const occurredAt = new Date();
  const billingAnchor = await ensureAdsBillingAnchor(campaign.userId);
  const window = getBillingWindow(billingAnchor, occurredAt);

  await db.insert(adSpendLedger).values({
    amountCents: 0,
    billingPeriodEnd: window.periodEnd,
    billingPeriodStart: window.periodStart,
    campaignId: campaign.id,
    channel: campaign.channel,
    createdAt: occurredAt,
    description: eventType === "pause" ? "Campaign paused" : "Campaign resumed",
    entryType: eventType,
    metadata: {},
    occurredAt,
    userId: campaign.userId,
  });
}

export async function settleAdInvoicesForUser(
  userId: string,
  options?: { syncSpend?: boolean },
) {
  if (options?.syncSpend) {
    await syncUserAdSpend(userId);
  }

  const uninvoicedRows = await db
    .select({
      amountCents: adSpendLedger.amountCents,
      billingPeriodEnd: adSpendLedger.billingPeriodEnd,
      billingPeriodStart: adSpendLedger.billingPeriodStart,
      id: adSpendLedger.id,
    })
    .from(adSpendLedger)
    .where(
      and(
        eq(adSpendLedger.userId, userId),
        isNull(adSpendLedger.invoiceId),
        inArray(adSpendLedger.entryType, BILLABLE_ENTRY_TYPES as unknown as string[]),
      ),
    )
    .orderBy(asc(adSpendLedger.occurredAt));

  if (!uninvoicedRows.length) {
    return;
  }

  const now = new Date();
  const grouped = new Map<
    string,
    {
      ids: string[];
      periodEnd: Date;
      periodStart: Date;
      subtotalCents: number;
    }
  >();

  for (const row of uninvoicedRows) {
    const key = `${row.billingPeriodStart.toISOString()}::${row.billingPeriodEnd.toISOString()}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.ids.push(row.id);
      existing.subtotalCents += row.amountCents;
      continue;
    }

    grouped.set(key, {
      ids: [row.id],
      periodEnd: row.billingPeriodEnd,
      periodStart: row.billingPeriodStart,
      subtotalCents: row.amountCents,
    });
  }

  for (const group of grouped.values()) {
    if (group.periodEnd > now || group.subtotalCents <= 0) {
      continue;
    }

    const [existingInvoice] = await db
      .select({ id: adInvoices.id })
      .from(adInvoices)
      .where(
        and(
          eq(adInvoices.userId, userId),
          eq(adInvoices.periodStart, group.periodStart),
          eq(adInvoices.periodEnd, group.periodEnd),
        ),
      )
      .limit(1);

    let invoiceId = existingInvoice?.id;

    if (!invoiceId) {
      const [createdInvoice] = await db
        .insert(adInvoices)
        .values({
          chargedAt: null,
          createdAt: now,
          creditsCents: 0,
          currency: "ZAR",
          periodEnd: group.periodEnd,
          periodStart: group.periodStart,
          status: "open",
          subtotalCents: group.subtotalCents,
          totalCents: group.subtotalCents,
          updatedAt: now,
          userId,
        })
        .returning({ id: adInvoices.id });

      invoiceId = createdInvoice?.id;
    } else {
      await db
        .update(adInvoices)
        .set({
          subtotalCents: group.subtotalCents,
          totalCents: group.subtotalCents,
          updatedAt: now,
        })
        .where(eq(adInvoices.id, invoiceId));
    }

    await db
      .update(adSpendLedger)
      .set({ invoiceId })
      .where(inArray(adSpendLedger.id, group.ids));
  }

  const billedCampaignRows = await db
    .selectDistinct({ campaignId: adSpendLedger.campaignId })
    .from(adSpendLedger)
    .where(eq(adSpendLedger.userId, userId));

  await updateCampaignBilledSpendFromLedger(
    db,
    billedCampaignRows.map((row) => row.campaignId),
  );
}

export type UserAdBillingSummary = {
  activeCampaignCount: number;
  deliveredSpendCents: number;
  nextBillingDate: Date | null;
  openInvoiceCount: number;
  openInvoiceTotalCents: number;
  paidInvoiceTotalCents: number;
  pausedCampaignCount: number;
  uninvoicedSpendCents: number;
};

export async function getUserAdBillingSummary(userId: string): Promise<UserAdBillingSummary> {
  await settleAdInvoicesForUser(userId);

  const [campaignCounts, deliveredSpend, uninvoicedSpend, invoiceTotals] = await Promise.all([
    db
      .select({
        activeCount: sql<number>`count(*) filter (where ${adCampaigns.status} in ('ready','live'))::int`,
        pausedCount: sql<number>`count(*) filter (where ${adCampaigns.status} = 'paused')::int`,
      })
      .from(adCampaigns)
      .where(eq(adCampaigns.userId, userId))
      .then((rows) => rows[0] || { activeCount: 0, pausedCount: 0 }),
    db
      .select({
        total: sql<number>`coalesce(sum(${adCampaigns.deliveredSpendCents}), 0)`,
      })
      .from(adCampaigns)
      .where(eq(adCampaigns.userId, userId))
      .then((rows) => rows[0]?.total || 0),
    db
      .select({
        total: sql<number>`coalesce(sum(${adSpendLedger.amountCents}), 0)`,
      })
      .from(adSpendLedger)
      .where(
        and(
          eq(adSpendLedger.userId, userId),
          isNull(adSpendLedger.invoiceId),
          inArray(adSpendLedger.entryType, BILLABLE_ENTRY_TYPES as unknown as string[]),
        ),
      )
      .then((rows) => rows[0]?.total || 0),
    db
      .select({
        nextBillingDate: sql<Date | null>`min(${adInvoices.periodEnd}) filter (where ${adInvoices.status} in ('open','past_due'))`,
        openCount: sql<number>`count(*) filter (where ${adInvoices.status} in ('open','past_due'))::int`,
        openTotal: sql<number>`coalesce(sum(${adInvoices.totalCents}) filter (where ${adInvoices.status} in ('open','past_due')), 0)`,
        paidTotal: sql<number>`coalesce(sum(${adInvoices.totalCents}) filter (where ${adInvoices.status} = 'paid'), 0)`,
      })
      .from(adInvoices)
      .where(eq(adInvoices.userId, userId))
      .then((rows) =>
        rows[0] || {
          nextBillingDate: null,
          openCount: 0,
          openTotal: 0,
          paidTotal: 0,
        },
      ),
  ]);

  return {
    activeCampaignCount: campaignCounts.activeCount || 0,
    deliveredSpendCents: deliveredSpend,
    nextBillingDate: invoiceTotals.nextBillingDate,
    openInvoiceCount: invoiceTotals.openCount || 0,
    openInvoiceTotalCents: invoiceTotals.openTotal || 0,
    paidInvoiceTotalCents: invoiceTotals.paidTotal || 0,
    pausedCampaignCount: campaignCounts.pausedCount || 0,
    uninvoicedSpendCents: uninvoicedSpend,
  };
}

export type UserAdBillingInvoice = {
  createdAt: Date;
  failureMessage: string | null;
  id: string;
  periodEnd: Date;
  periodStart: Date;
  status: string;
  totalCents: number;
};

export async function listUserAdInvoices(userId: string, limit = 12): Promise<UserAdBillingInvoice[]> {
  await settleAdInvoicesForUser(userId);

  return db
    .select({
      createdAt: adInvoices.createdAt,
      failureMessage: adInvoices.failureMessage,
      id: adInvoices.id,
      periodEnd: adInvoices.periodEnd,
      periodStart: adInvoices.periodStart,
      status: adInvoices.status,
      totalCents: adInvoices.totalCents,
    })
    .from(adInvoices)
    .where(eq(adInvoices.userId, userId))
    .orderBy(desc(adInvoices.periodEnd), desc(adInvoices.createdAt))
    .limit(limit);
}

export type AdminAdBillingSummary = {
  activeCampaignCount: number;
  openInvoiceCount: number;
  openInvoiceTotalCents: number;
  paidInvoiceTotalCents: number;
  totalDeliveredSpendCents: number;
  uninvoicedSpendCents: number;
};

export async function getAdminAdBillingSummary(): Promise<AdminAdBillingSummary> {
  const [campaignTotals, uninvoicedTotals, invoiceTotals] = await Promise.all([
    db
      .select({
        activeCount: sql<number>`count(*) filter (where ${adCampaigns.status} in ('ready','live'))::int`,
        deliveredTotal: sql<number>`coalesce(sum(${adCampaigns.deliveredSpendCents}), 0)`,
      })
      .from(adCampaigns)
      .then((rows) => rows[0] || { activeCount: 0, deliveredTotal: 0 }),
    db
      .select({
        total: sql<number>`coalesce(sum(${adSpendLedger.amountCents}), 0)`,
      })
      .from(adSpendLedger)
      .where(
        and(
          isNull(adSpendLedger.invoiceId),
          inArray(adSpendLedger.entryType, BILLABLE_ENTRY_TYPES as unknown as string[]),
        ),
      )
      .then((rows) => rows[0]?.total || 0),
    db
      .select({
        openCount: sql<number>`count(*) filter (where ${adInvoices.status} in ('open','past_due'))::int`,
        openTotal: sql<number>`coalesce(sum(${adInvoices.totalCents}) filter (where ${adInvoices.status} in ('open','past_due')), 0)`,
        paidTotal: sql<number>`coalesce(sum(${adInvoices.totalCents}) filter (where ${adInvoices.status} = 'paid'), 0)`,
      })
      .from(adInvoices)
      .then((rows) =>
        rows[0] || { openCount: 0, openTotal: 0, paidTotal: 0 },
      ),
  ]);

  return {
    activeCampaignCount: campaignTotals.activeCount || 0,
    openInvoiceCount: invoiceTotals.openCount || 0,
    openInvoiceTotalCents: invoiceTotals.openTotal || 0,
    paidInvoiceTotalCents: invoiceTotals.paidTotal || 0,
    totalDeliveredSpendCents: campaignTotals.deliveredTotal || 0,
    uninvoicedSpendCents: uninvoicedTotals,
  };
}

export async function chargeDueAdInvoicesForUser(userId: string) {
  await settleAdInvoicesForUser(userId);

  const [subscription] = await db
    .select({
      id: subscriptions.id,
      providerCustomerId: subscriptions.providerCustomerId,
      providerReference: subscriptions.providerReference,
      status: subscriptions.status,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!subscription?.providerCustomerId || !subscription.providerReference) {
    return;
  }

  const openInvoices = await db
    .select({
      id: adInvoices.id,
      totalCents: adInvoices.totalCents,
    })
    .from(adInvoices)
    .where(
      and(
        eq(adInvoices.userId, userId),
        inArray(adInvoices.status, ["open", "past_due"]),
        lte(adInvoices.periodEnd, new Date()),
      ),
    )
    .orderBy(asc(adInvoices.periodEnd));

  if (!openInvoices.length) {
    return;
  }

  const stripe = await getStripe();
  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscription.providerReference,
    { expand: ["default_payment_method"] },
  );
  const defaultPaymentMethodId =
    stripeSubscription.default_payment_method &&
    typeof stripeSubscription.default_payment_method !== "string"
      ? stripeSubscription.default_payment_method.id
      : typeof stripeSubscription.default_payment_method === "string"
        ? stripeSubscription.default_payment_method
        : null;

  if (!defaultPaymentMethodId) {
    return;
  }

  for (const invoice of openInvoices) {
    try {
      const intent = await stripe.paymentIntents.create({
        amount: invoice.totalCents,
        confirm: true,
        currency: "zar",
        customer: subscription.providerCustomerId,
        description: "Homzie Ads spend",
        metadata: {
          adInvoiceId: invoice.id,
          subscriptionId: subscription.id,
          userId,
        },
        off_session: true,
        payment_method: defaultPaymentMethodId,
      });

      const chargeId =
        typeof intent.latest_charge === "string"
          ? intent.latest_charge
          : intent.latest_charge?.id || null;

      await db
        .update(adInvoices)
        .set({
          chargedAt: new Date(),
          failureMessage: null,
          providerChargeId: chargeId,
          providerPaymentIntentId: intent.id,
          status: intent.status === "succeeded" ? "paid" : "open",
          updatedAt: new Date(),
        })
        .where(eq(adInvoices.id, invoice.id));
    } catch (error) {
      await db
        .update(adInvoices)
        .set({
          failureMessage: error instanceof Error ? error.message : "Charge failed.",
          status: "past_due",
          updatedAt: new Date(),
        })
        .where(eq(adInvoices.id, invoice.id));
    }
  }
}

export async function getOutstandingAdBillingState(userId: string) {
  await settleAdInvoicesForUser(userId);

  const [openInvoice] = await db
    .select({ id: adInvoices.id })
    .from(adInvoices)
    .where(
      and(
        eq(adInvoices.userId, userId),
        inArray(adInvoices.status, ["open", "past_due"]),
      ),
    )
    .limit(1);

  const [uninvoicedBalance] = await db
    .select({
      total: sql<number>`coalesce(sum(${adSpendLedger.amountCents}), 0)`,
    })
    .from(adSpendLedger)
    .where(
      and(
        eq(adSpendLedger.userId, userId),
        isNull(adSpendLedger.invoiceId),
        inArray(adSpendLedger.entryType, BILLABLE_ENTRY_TYPES as unknown as string[]),
      ),
    );

  const [activeCampaign] = await db
    .select({ id: adCampaigns.id })
    .from(adCampaigns)
    .where(
      and(
        eq(adCampaigns.userId, userId),
        inArray(adCampaigns.status, ACTIVE_CAMPAIGN_STATUSES as unknown as string[]),
      ),
    )
    .limit(1);

  const [pausedCampaign] = await db
    .select({ id: adCampaigns.id })
    .from(adCampaigns)
    .where(
      and(eq(adCampaigns.userId, userId), eq(adCampaigns.status, "paused")),
    )
    .limit(1);

  const uninvoicedSpendCents = uninvoicedBalance?.total || 0;

  return {
    hasActiveCampaign: Boolean(activeCampaign),
    hasOpenInvoices: Boolean(openInvoice),
    hasPausedCampaign: Boolean(pausedCampaign),
    hasOutstandingBalance:
      Boolean(openInvoice) || uninvoicedSpendCents > 0 || Boolean(activeCampaign),
    uninvoicedSpendCents,
  };
}
