import type { LucideIcon } from "lucide-react";

import { AnalyticsInfoPopover } from "@/components/analytics-info-popover";
import { cn } from "@/lib/utils";
import {
  type AnalyticsBreakdownRow,
  type AnalyticsTrendPoint,
  formatMetric,
} from "@/modules/users/analytics/content-analytics";

export type AnalyticsMetric = {
  icon: LucideIcon;
  label: string;
  value: number;
};

export function AnalyticsMetricTable({ metrics }: { metrics: AnalyticsMetric[] }) {
  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <table className="w-full text-left text-sm">
        <tbody>
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <tr key={metric.label} className="border-b border-border last:border-b-0">
                <th className="min-w-0 px-3 py-3 font-black sm:px-4">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-3.5" />
                    </span>
                    <span className="truncate text-[10px] uppercase tracking-[0.12em] text-primary">
                      {metric.label}
                    </span>
                  </span>
                </th>
                <td className="w-24 px-3 py-3 text-right text-lg font-black sm:px-4">
                  {formatMetric(metric.value)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export function AnalyticsTrendChart({
  points,
  title = "Activity trend",
}: {
  points: AnalyticsTrendPoint[];
  title?: string;
}) {
  const maxValue = Math.max(...points.map((point) => point.total), 0);
  const safeMax = maxValue || 1;
  const hasData = maxValue > 0;

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
            Trend
          </p>
          <h2 className="mt-1 text-xl font-black">{title}</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-primary" />
            Impressions
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-brand-pink" />
            Clicks
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500" />
            Saves
          </span>
        </div>
      </div>

      <div className="mt-5 h-56">
        <div className="flex h-48 items-end gap-1.5">
          {points.map((point) => {
            const height = Math.max(4, (point.total / safeMax) * 100);
            const titleText = `${point.label}: ${formatMetric(point.total)} total`;

            return (
              <div
                key={point.date}
                className="group flex h-full min-w-0 flex-1 items-end"
                title={titleText}
              >
                <div
                  className={cn(
                    "w-full min-w-1 overflow-hidden rounded-t-md bg-muted",
                    !hasData && "opacity-35",
                  )}
                  style={{ height: `${hasData ? height : 4}%` }}
                >
                  <span
                    className="block w-full bg-primary"
                    style={{
                      height: `${
                        point.total ? (point.impressions / point.total) * 100 : 0
                      }%`,
                    }}
                  />
                  <span
                    className="block w-full bg-brand-pink"
                    style={{
                      height: `${point.total ? (point.clicks / point.total) * 100 : 0}%`,
                    }}
                  />
                  <span
                    className="block w-full bg-emerald-500"
                    style={{
                      height: `${point.total ? (point.saves / point.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-between text-[10px] font-black uppercase tracking-wide text-muted-foreground">
          <span>{points[0]?.label || ""}</span>
          <span>{points[Math.floor(points.length / 2)]?.label || ""}</span>
          <span>{points[points.length - 1]?.label || ""}</span>
        </div>
      </div>
    </section>
  );
}

export function AnalyticsBreakdownBars({
  emptyLabel,
  labelHeader = "Action",
  rows,
  title,
}: {
  emptyLabel: string;
  labelHeader?: string;
  rows: AnalyticsBreakdownRow[];
  title: string;
}) {
  const maxValue = Math.max(...rows.map((row) => row.count), 0);

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
            Breakdown
          </p>
          <h2 className="mt-1 text-xl font-black">{title}</h2>
        </div>
        <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
          {rows.length} types
        </span>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[minmax(0,1fr)_5rem] bg-muted/50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          <span>{labelHeader}</span>
          <span className="text-right">Count</span>
        </div>
        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-3 border-t border-border px-3 py-3"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-sm font-black">{row.label}</p>
                  <AnalyticsInfoPopover
                    className="shrink-0"
                    description={row.description}
                    title={row.label}
                  />
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-[image:var(--homzie-gradient)]"
                    style={{
                      width: `${maxValue ? Math.max(3, (row.count / maxValue) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
              <p className="text-right text-sm font-black">{formatMetric(row.count)}</p>
            </div>
          ))
        ) : (
          <div className="border-t border-border p-6 text-center text-sm font-semibold text-muted-foreground">
            {emptyLabel}
          </div>
        )}
      </div>
    </section>
  );
}
