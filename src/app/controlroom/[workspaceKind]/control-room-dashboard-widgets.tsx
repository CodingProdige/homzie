"use client";

import { useState } from "react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, ChevronRight } from "lucide-react";

import { AnalyticsInfoPopover } from "@/components/analytics-info-popover";
import {
  HomzieHorizontalBarChart,
  HomzieMetricBarChart,
  HomziePeriodAreaChart,
} from "@/components/charts/homzie-charts";
import { cn } from "@/lib/utils";

export type ControlRoomPeriodOption = {
  key: string;
  label: string;
};

export type ControlRoomTrendPoint = {
  actions: number;
  date: string;
  label: string;
  offers: number;
  sales: number;
  views: number;
};

export type ControlRoomContributionRow = {
  actions: number;
  helper: string;
  id: string;
  label: string;
  listings: number;
  members: number;
  offers: number;
  sales: number;
  score: number;
  views: number;
};

export type ControlRoomStatusRow = {
  count: number;
  label: string;
};

export type ControlRoomMetricCard = {
  description: string;
  helper: string;
  label: string;
  previousValue: number | null;
  trend: number[];
  value: number;
};

type TrendMetric = "views" | "actions" | "offers" | "sales";

const trendMetrics: Array<{
  description: string;
  key: TrendMetric;
  label: string;
}> = [
  {
    description: "Listing detail views across the selected control room scope.",
    key: "views",
    label: "Views",
  },
  {
    description: "All tracked listing interactions, including contact, save, share, hover, and offer starts.",
    key: "actions",
    label: "Actions",
  },
  {
    description: "High-intent buyer actions such as contacting an agent, starting an offer, or reserving.",
    key: "offers",
    label: "High intent",
  },
  {
    description: "Listings marked sold or sold externally during the selected period.",
    key: "sales",
    label: "Sold",
  },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    maximumFractionDigits: 0,
  }).format(value);
}

function deltaPercent(current: number, previous: number | null) {
  if (previous === null) return null;
  if (previous === 0) return current > 0 ? 100 : 0;

  return Math.round(((current - previous) / previous) * 100);
}

function deltaLabel(current: number, previous: number | null) {
  const delta = deltaPercent(current, previous);

  if (delta === null) return "Current snapshot";
  if (delta === 0) return "Flat vs previous";

  return `${delta > 0 ? "+" : ""}${delta}% vs previous`;
}

function compactTrendValues(values: number[], targetCount = 12) {
  const cleanValues = values.map((value) => Math.max(0, value));

  if (cleanValues.length <= targetCount) return cleanValues;

  const bucketSize = Math.ceil(cleanValues.length / targetCount);
  const buckets: number[] = [];

  for (let index = 0; index < cleanValues.length; index += bucketSize) {
    const bucket = cleanValues.slice(index, index + bucketSize);
    buckets.push(bucket.reduce((total, value) => total + value, 0));
  }

  return buckets.slice(0, targetCount);
}

function MetricCardVisual({
  label,
  values,
}: {
  label: string;
  values: number[];
}) {
  const isPeriodTrend = values.length > 4;
  const bars = compactTrendValues(values);
  const maxValue = Math.max(...bars, 0);

  if (!isPeriodTrend) return null;

  return (
    <div className="mt-4 rounded-md border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <span>Trend</span>
        <span>Peak {formatNumber(maxValue)}</span>
      </div>
      <HomzieMetricBarChart
        className="mt-2"
        data={bars.map((bar, index) => ({
          label: `P${index + 1}`,
          value: bar,
        }))}
        label={label}
      />
      <div className="mt-2 flex justify-between text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
        <span>Start</span>
        <span>Now</span>
      </div>
    </div>
  );
}

export function ControlRoomPeriodSelector({
  basePath,
  currentPeriod,
  periods,
}: {
  basePath: string;
  currentPeriod: string;
  periods: readonly ControlRoomPeriodOption[];
}) {
  const activePeriod =
    periods.find((period) => period.key === currentPeriod) || periods[1];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold text-foreground shadow-sm outline-none transition-colors hover:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          {activePeriod.label}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-[80] w-56 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl shadow-black/15 outline-none"
        >
          {periods.map((period) => {
            const isActive = period.key === currentPeriod;

            return (
              <DropdownMenu.Item key={period.key} asChild>
                <Link
                  href={`${basePath}?period=${period.key}`}
                  scroll={false}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm font-bold outline-none transition-colors hover:bg-accent focus:bg-accent",
                    isActive &&
                      "bg-primary text-primary-foreground hover:bg-primary focus:bg-primary",
                  )}
                >
                  {period.label}
                  {isActive ? <Check className="size-4" /> : null}
                </Link>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function ControlRoomMetricGrid({
  metrics,
}: {
  metrics: ControlRoomMetricCard[];
}) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {metrics.map((metric) => {
        const delta = deltaPercent(metric.value, metric.previousValue);

        return (
          <article
            key={metric.label}
            className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {metric.label}
                  </p>
                  <AnalyticsInfoPopover
                    description={metric.description}
                    title={metric.label}
                  />
                </div>
                <p className="mt-2 truncate text-3xl font-semibold leading-none">
                  {formatNumber(metric.value)}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold",
                  delta === null
                    ? "bg-muted text-muted-foreground"
                    : delta > 0
                      ? "bg-emerald-500/10 text-emerald-700"
                      : delta < 0
                        ? "bg-red-500/10 text-red-600"
                        : "bg-muted text-muted-foreground",
                )}
              >
                {deltaLabel(metric.value, metric.previousValue)}
              </span>
            </div>

            <MetricCardVisual
              label={metric.label}
              values={metric.trend}
            />
            <p className="mt-3 truncate text-xs font-normal text-muted-foreground">
              {metric.helper}
            </p>
          </article>
        );
      })}
    </section>
  );
}

export function ControlRoomActivityTrend({
  currentPoints,
  previousPoints,
}: {
  currentPoints: ControlRoomTrendPoint[];
  previousPoints: ControlRoomTrendPoint[];
}) {
  const [metric, setMetric] = useState<TrendMetric>("views");
  const activeMetric = trendMetrics.find((item) => item.key === metric) || trendMetrics[0];
  const currentTotal = currentPoints.reduce((total, point) => total + point[metric], 0);
  const previousTotal = previousPoints.length
    ? previousPoints.reduce((total, point) => total + point[metric], 0)
    : null;
  const chartData = currentPoints.map((point, index) => ({
    current: point[metric],
    label: point.label,
    previous: previousPoints[index]?.[metric] ?? null,
  }));

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Activity trend
            </p>
            <AnalyticsInfoPopover
              description="Compares the selected period with the immediately previous period using the same duration."
              title="Activity trend"
            />
          </div>
          <h2 className="mt-1 text-xl font-semibold">Current vs previous period</h2>
        </div>
        <div className="inline-flex w-fit flex-wrap items-center gap-1 rounded-full border border-border bg-background p-1">
          {trendMetrics.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setMetric(item.key)}
              className={cn(
                "h-8 rounded-full px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                metric === item.key &&
                  "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground",
              )}
              title={item.description}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_10rem]">
        <HomziePeriodAreaChart
          data={chartData}
          emptyLabel="No recorded signal for this period."
          metricLabel={activeMetric.label}
        />

        <div className="rounded-md border border-border bg-background p-4">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-normal uppercase tracking-[0.12em] text-muted-foreground">
              {activeMetric.label}
            </p>
            <AnalyticsInfoPopover
              description={activeMetric.description}
              title={activeMetric.label}
            />
          </div>
          <p className="mt-2 text-3xl font-semibold">
            {formatNumber(currentTotal)}
          </p>
          <p
            className={cn(
              "mt-2 text-xs font-semibold",
              deltaPercent(currentTotal, previousTotal) === null
                ? "text-muted-foreground"
                : (deltaPercent(currentTotal, previousTotal) || 0) >= 0
                  ? "text-emerald-700"
                  : "text-red-600",
            )}
          >
            {deltaLabel(currentTotal, previousTotal)}
          </p>
          <div className="mt-5 grid gap-2 text-sm font-normal text-muted-foreground">
            <p>Current: {formatNumber(currentTotal)}</p>
            <p>Previous: {previousTotal === null ? "n/a" : formatNumber(previousTotal)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const contributionRollupLimit = 10;

function rollupSignal(row: ControlRoomContributionRow) {
  return row.views + row.actions + row.offers + row.sales;
}

function signalLabelFor(row: ControlRoomContributionRow) {
  const signal = rollupSignal(row);

  if (signal > 0) return "Period signal";
  if (row.listings > 0) return "Listed, no signal";

  return "No period signal";
}

function RollupSummaryMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate text-sm font-semibold leading-none",
          value === 0 && "text-muted-foreground",
        )}
      >
        {formatNumber(value)}
      </p>
    </div>
  );
}

function ContributionExpandedPanel({ row }: { row: ControlRoomContributionRow }) {
  const signalRows = [
    { label: "Views", value: row.views },
    { label: "Actions", value: row.actions },
    { label: "High intent", value: row.offers },
    { label: "Sold", value: row.sales },
  ].filter((item) => item.value > 0);
  const footprintRows = [
    { label: "Team", value: row.members },
    { label: "Active listings", value: row.listings },
  ].filter((item) => item.value > 0);

  return (
    <div className="border-t border-border bg-muted/20 px-4 py-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,0.7fr)]">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Buyer signal mix
            </p>
            <p className="text-xs font-semibold text-foreground">
              {formatNumber(rollupSignal(row))}
            </p>
          </div>
          <HomzieHorizontalBarChart
            data={signalRows}
            emptyLabel="No buyer signal for this period."
            valueLabel="Events"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Footprint
            </p>
            <p className="text-xs font-semibold text-foreground">
              {formatNumber(row.members + row.listings)}
            </p>
          </div>
          <HomzieHorizontalBarChart
            data={footprintRows}
            emptyLabel="No active footprint yet."
            valueLabel="Count"
          />
        </div>
      </div>
    </div>
  );
}

function ContributionRollup({
  label,
  rows,
}: {
  label: string;
  rows: ControlRoomContributionRow[];
}) {
  const topRows = rows.slice(0, contributionRollupLimit);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const activeExpandedId = topRows.some((row) => row.id === expandedId)
    ? expandedId
    : null;

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
        <p className="text-sm font-semibold text-foreground">
          No {label.toLowerCase()} to roll up yet.
        </p>
        <p className="mt-1 text-xs font-normal text-muted-foreground">
          Activity will appear once this control room has connected records.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="divide-y divide-border">
        {topRows.map((row, index) => {
          const periodSignal = rollupSignal(row);
          const signalLabel = signalLabelFor(row);
          const isExpanded = activeExpandedId === row.id;

          return (
            <article key={row.id}>
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() =>
                  setExpandedId((current) => (current === row.id ? null : row.id))
                }
                className={cn(
                  "grid w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 lg:grid-cols-[minmax(15rem,1fr)_minmax(22rem,0.9fr)_2rem] lg:items-center",
                  isExpanded && "bg-primary/5",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h4 className="truncate text-sm font-semibold leading-tight text-foreground">
                        {row.label}
                      </h4>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]",
                          periodSignal > 0
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {signalLabel}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs font-normal text-muted-foreground">
                      {row.helper}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <RollupSummaryMetric label="Views" value={row.views} />
                  <RollupSummaryMetric label="Actions" value={row.actions} />
                  <RollupSummaryMetric label="Listings" value={row.listings} />
                  <RollupSummaryMetric label="Team" value={row.members} />
                </div>

                <ChevronRight
                  className={cn(
                    "size-4 justify-self-end text-muted-foreground transition-transform",
                    isExpanded && "rotate-90 text-primary",
                  )}
                />
              </button>

              {isExpanded ? <ContributionExpandedPanel row={row} /> : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function ControlRoomOversightBreakdown({
  contributionLabel,
  contributionRows,
  statusRows,
}: {
  contributionLabel: string;
  contributionRows: ControlRoomContributionRow[];
  statusRows: ControlRoomStatusRow[];
}) {
  const rollupTitle =
    contributionLabel === "Branches" ? "Branch analytics" : "Agent analytics";
  const rollupLabel =
    contributionLabel === "Branches" ? "Top branches" : "Top agents";

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Oversight
            </p>
            <AnalyticsInfoPopover
              description="Shows the top branch or agent rows with expandable charts for signal mix and footprint."
              title={rollupTitle}
            />
          </div>
          <h2 className="mt-1 text-xl font-semibold">{rollupTitle}</h2>
        </div>
      </div>

      <div className="mt-5 grid gap-5">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">{rollupLabel}</h3>
            <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Top {contributionRollupLimit}
            </span>
            <AnalyticsInfoPopover
              description="Ranked by buyer signal and active footprint. Expand a row to inspect the branch or agent mix."
              title={rollupLabel}
            />
          </div>
          <div className="mt-3">
            <ContributionRollup
              label={contributionLabel}
              rows={contributionRows}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">Listing mix</h3>
            <AnalyticsInfoPopover
              description="A live breakdown of listing statuses inside this control room scope."
              title="Listing mix"
            />
          </div>
          <div className="mt-3">
            <HomzieHorizontalBarChart
              data={statusRows.map((row) => ({
                label: row.label,
                value: row.count,
              }))}
              emptyLabel="No listing status data yet."
              valueLabel="Listings"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
