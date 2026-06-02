import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { propertyListings } from "@/db/schema";

export type AgentPerformanceRange = "month" | "3m" | "6m" | "12m" | "year" | "all";

export type AgentPerformanceStats = {
  avgDaysToSellLabel: string;
  completedMandates: number;
  completedMandatesLabel: string;
  disputedCount: number;
  expiredCount: number;
  soldCount: number;
  soldExternallyCount: number;
  soldThisYear: number;
  soldThisYearDeltaLabel: string;
  soldThisYearLabel: string;
  totalSoldValueThisYearCents: number;
  totalSoldValueThisYearDeltaLabel: string;
  totalSoldValueThisYearLabel: string;
  verifiedSales: number;
  verifiedSalesDeltaLabel: string;
  verifiedSalesLabel: string;
  withdrawnCount: number;
  winRateDeltaLabel: string;
  winRateLabel: string;
};

export type AgentSoldPropertyHistoryItem = {
  askingPriceCents: number | null;
  daysOnMarketLabel: string;
  id: string;
  listedAt: Date;
  location: string | null;
  proofStatus: string;
  soldAt: Date | null;
  soldPriceCents: number | null;
  title: string;
};

export function formatCompactCount(value: number) {
  if (value < 1000) {
    return String(value);
  }

  const compactValue = value / 1000;

  return `${Number.isInteger(compactValue) ? compactValue.toFixed(0) : compactValue.toFixed(1)}K`;
}

export function formatCurrencyCompact(cents: number) {
  const value = Math.round(cents / 100);

  if (value >= 1_000_000) {
    const millions = value / 1_000_000;

    return `R${Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }

  if (value >= 1000) {
    const thousands = value / 1000;

    return `R${Number.isInteger(thousands) ? thousands.toFixed(0) : thousands.toFixed(1)}K`;
  }

  return `R${value}`;
}

function rangeStartDate(range: AgentPerformanceRange) {
  const now = new Date();

  if (range === "all") return null;

  if (range === "year") {
    return new Date(now.getFullYear(), 0, 1);
  }

  const months = range === "month" ? 1 : range === "3m" ? 3 : range === "6m" ? 6 : 12;
  const start = new Date(now);
  start.setMonth(start.getMonth() - months);

  return start;
}

function previousRangeStartDate(range: AgentPerformanceRange, currentStart: Date | null) {
  if (!currentStart || range === "all") return null;

  const previousStart = new Date(currentStart);

  if (range === "year") {
    previousStart.setFullYear(previousStart.getFullYear() - 1);
    return previousStart;
  }

  const months = range === "month" ? 1 : range === "3m" ? 3 : range === "6m" ? 6 : 12;
  previousStart.setMonth(previousStart.getMonth() - months);

  return previousStart;
}

function listingOutcomeDate(listing: {
  listedAt: Date;
  outcomeAt: Date | null;
  soldAt: Date | null;
}) {
  return listing.soldAt || listing.outcomeAt || listing.listedAt;
}

function inRange(
  listing: {
    listedAt: Date;
    outcomeAt: Date | null;
    soldAt: Date | null;
  },
  start: Date | null,
  end: Date | null,
) {
  const date = listingOutcomeDate(listing);

  if (start && date < start) return false;
  if (end && date >= end) return false;

  return true;
}

function countDeltaLabel(current: number, previous: number) {
  if (previous === 0) return current > 0 ? `+${current}` : "0";

  const delta = current - previous;

  return `${delta >= 0 ? "+" : ""}${delta}`;
}

function percentDeltaLabel(current: number, previous: number) {
  if (previous === 0) return current > 0 ? "+100%" : "0%";

  const delta = Math.round(((current - previous) / previous) * 100);

  return `${delta >= 0 ? "+" : ""}${delta}%`;
}

export async function getAgentPerformanceStats(
  userId: string,
  range: AgentPerformanceRange = "year",
): Promise<AgentPerformanceStats> {
  const rows = await db
    .select({
      listedAt: propertyListings.listedAt,
      outcomeAt: propertyListings.outcomeAt,
      proofStatus: propertyListings.proofStatus,
      soldAt: propertyListings.soldAt,
      soldPriceCents: propertyListings.soldPriceCents,
      status: propertyListings.status,
    })
    .from(propertyListings)
    .where(eq(propertyListings.userId, userId));

  const completedStatuses = new Set([
    "sold",
    "sold_externally",
    "withdrawn",
    "expired",
  ]);
  const currentStart = rangeStartDate(range);
  const previousStart = previousRangeStartDate(range, currentStart);
  const currentEnd = range === "all" ? null : new Date();
  const currentRows = rows.filter((listing) => inRange(listing, currentStart, currentEnd));
  const previousRows =
    previousStart && currentStart
      ? rows.filter((listing) => inRange(listing, previousStart, currentStart))
      : [];
  const completedRows = currentRows.filter((listing) =>
    completedStatuses.has(listing.status),
  );
  const previousCompletedRows = previousRows.filter((listing) =>
    completedStatuses.has(listing.status),
  );
  const soldRows = currentRows.filter((listing) => listing.status === "sold");
  const previousSoldRows = previousRows.filter((listing) => listing.status === "sold");
  const totalSoldValueThisYearCents = soldRows.reduce(
    (total, listing) => total + (listing.soldPriceCents || 0),
    0,
  );
  const previousTotalSoldValueCents = previousSoldRows.reduce(
    (total, listing) => total + (listing.soldPriceCents || 0),
    0,
  );
  const verifiedSales = soldRows.filter(
    (listing) => listing.proofStatus === "verified",
  ).length;
  const previousVerifiedSales = previousSoldRows.filter(
    (listing) => listing.proofStatus === "verified",
  ).length;
  const daysToSell = soldRows
    .map((listing) => {
      if (!listing.listedAt || !listing.soldAt) return null;

      return Math.max(
        0,
        Math.round(
          (listing.soldAt.getTime() - listing.listedAt.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
    })
    .filter((value): value is number => value !== null);
  const avgDaysToSell =
    daysToSell.length > 0
      ? Math.round(daysToSell.reduce((total, value) => total + value, 0) / daysToSell.length)
      : null;
  const winRate =
    completedRows.length > 0 ? Math.round((soldRows.length / completedRows.length) * 100) : 0;
  const previousWinRate =
    previousCompletedRows.length > 0
      ? Math.round((previousSoldRows.length / previousCompletedRows.length) * 100)
      : 0;

  return {
    avgDaysToSellLabel: avgDaysToSell === null ? "No sales yet" : `${avgDaysToSell} days`,
    completedMandates: completedRows.length,
    completedMandatesLabel: `${completedRows.length} completed mandates`,
    disputedCount: currentRows.filter((listing) => listing.status === "disputed").length,
    expiredCount: currentRows.filter((listing) => listing.status === "expired").length,
    soldCount: soldRows.length,
    soldExternallyCount: currentRows.filter((listing) => listing.status === "sold_externally")
      .length,
    soldThisYear: soldRows.length,
    soldThisYearDeltaLabel: countDeltaLabel(soldRows.length, previousSoldRows.length),
    soldThisYearLabel: formatCompactCount(soldRows.length),
    totalSoldValueThisYearCents,
    totalSoldValueThisYearDeltaLabel: percentDeltaLabel(
      totalSoldValueThisYearCents,
      previousTotalSoldValueCents,
    ),
    totalSoldValueThisYearLabel:
      totalSoldValueThisYearCents > 0
        ? formatCurrencyCompact(totalSoldValueThisYearCents)
        : "R0",
    verifiedSales,
    verifiedSalesDeltaLabel: countDeltaLabel(verifiedSales, previousVerifiedSales),
    verifiedSalesLabel: formatCompactCount(verifiedSales),
    withdrawnCount: currentRows.filter((listing) => listing.status === "withdrawn").length,
    winRateDeltaLabel: percentDeltaLabel(winRate, previousWinRate),
    winRateLabel: completedRows.length > 0 ? `${winRate}%` : "New",
  };
}

export async function getAgentSoldPropertyHistory(
  userId: string,
  range: AgentPerformanceRange = "year",
): Promise<AgentSoldPropertyHistoryItem[]> {
  const rows = await db
    .select({
      askingPriceCents: propertyListings.askingPriceCents,
      id: propertyListings.id,
      listedAt: propertyListings.listedAt,
      location: propertyListings.location,
      outcomeAt: propertyListings.outcomeAt,
      proofStatus: propertyListings.proofStatus,
      soldAt: propertyListings.soldAt,
      soldPriceCents: propertyListings.soldPriceCents,
      title: propertyListings.title,
    })
    .from(propertyListings)
    .where(eq(propertyListings.userId, userId));

  const currentStart = rangeStartDate(range);
  const currentEnd = range === "all" ? null : new Date();

  return rows
    .filter((listing) => listing.soldAt)
    .filter((listing) => inRange(listing, currentStart, currentEnd))
    .sort((first, second) => {
      const firstDate = first.soldAt || first.listedAt;
      const secondDate = second.soldAt || second.listedAt;

      return secondDate.getTime() - firstDate.getTime();
    })
    .map((listing) => {
      const daysOnMarket = listing.soldAt
        ? Math.max(
            0,
            Math.round(
              (listing.soldAt.getTime() - listing.listedAt.getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : null;

      return {
        ...listing,
        daysOnMarketLabel:
          daysOnMarket === null
            ? "Not available"
            : `${daysOnMarket} ${daysOnMarket === 1 ? "day" : "days"}`,
      };
    });
}
