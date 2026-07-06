"use client";

import { useId } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts";

import { cn } from "@/lib/utils";

export type HomzieBarDatum = {
  helper?: string;
  label: string;
  value: number;
};

export type HomziePeriodDatum = {
  current: number;
  label: string;
  previous?: number | null;
};

const chartColor = {
  border: "hsl(var(--border))",
  card: "hsl(var(--card))",
  emerald: "#10b981",
  foreground: "hsl(var(--foreground))",
  muted: "hsl(var(--muted))",
  mutedForeground: "hsl(var(--muted-foreground))",
  pink: "#ff4db8",
  primary: "#7c5cff",
  primarySoft: "rgba(124, 92, 255, 0.11)",
};

const barPalette = [
  chartColor.primary,
  chartColor.pink,
  chartColor.emerald,
  "#38bdf8",
  "#f59e0b",
  "#a855f7",
];

function formatChartNumber(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    maximumFractionDigits: 0,
  }).format(value);
}

function tooltipValue(value: TooltipValueType | undefined) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(" - ");
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (Number.isFinite(parsed)) return formatChartNumber(parsed);
  if (typeof value === "string" && value.length) return value;

  return "0";
}

function HomzieChartTooltip({
  active,
  label,
  payload,
}: TooltipContentProps<TooltipValueType>) {
  if (!active || !payload?.length) return null;

  const helper = payload.find((item) => {
    const rawPayload = item.payload as HomzieBarDatum | undefined;
    return rawPayload?.helper;
  })?.payload as HomzieBarDatum | undefined;

  return (
    <div className="min-w-36 rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-xl">
      <p className="max-w-52 truncate text-xs font-semibold">
        {String(label || "")}
      </p>
      {helper?.helper ? (
        <p className="mt-0.5 max-w-52 truncate text-[11px] font-normal text-muted-foreground">
          {helper.helper}
        </p>
      ) : null}
      <div className="mt-2 grid gap-1">
        {payload.map((item) => (
          <div
            key={`${item.dataKey}-${item.name}`}
            className="flex items-center justify-between gap-4 text-xs"
          >
            <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color || item.fill || chartColor.primary }}
              />
              <span className="truncate">{String(item.name || item.dataKey)}</span>
            </span>
            <span className="font-semibold text-foreground">
              {tooltipValue(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderHomzieChartTooltip(props: TooltipContentProps<TooltipValueType>) {
  return <HomzieChartTooltip {...props} />;
}

export function HomzieMetricBarChart({
  className,
  data,
  label,
}: {
  className?: string;
  data: HomzieBarDatum[];
  label: string;
}) {
  const gradientId = useId().replaceAll(":", "");
  const maxValue = Math.max(...data.map((item) => item.value), 0);
  const hasData = maxValue > 0;

  return (
    <div
      className={cn(
        "relative h-24 overflow-hidden rounded-md bg-[linear-gradient(to_right,rgba(124,92,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,92,255,0.12)_1px,transparent_1px)] bg-[size:3rem_100%,100%_1.75rem]",
        className,
      )}
    >
      {hasData ? (
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 320, height: 96 }}
        >
          <BarChart
            data={data}
            margin={{ bottom: 0, left: 0, right: 0, top: 8 }}
            barCategoryGap={data.length > 9 ? "18%" : "30%"}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={chartColor.pink} />
                <stop offset="100%" stopColor={chartColor.primary} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="rgba(124, 92, 255, 0.14)"
              strokeDasharray="3 5"
              vertical={false}
            />
            <XAxis dataKey="label" hide />
            <YAxis domain={[0, maxValue]} hide />
            <Tooltip
              content={renderHomzieChartTooltip}
              cursor={{ fill: chartColor.primarySoft }}
              isAnimationActive={false}
            />
            <Bar
              dataKey="value"
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              minPointSize={3}
              name={label}
              radius={[5, 5, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="grid h-full place-items-center px-4 text-center">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">
              No trend yet
            </p>
            <p className="mt-1 text-[10px] font-normal uppercase tracking-wide text-muted-foreground/80">
              Waiting for period activity
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function HomzieSnapshotBarChart({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value: number;
}) {
  const gradientId = useId().replaceAll(":", "");
  const data = [{ label, value }];

  return (
    <div className={cn("h-12", className)}>
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 320, height: 48 }}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ bottom: 6, left: 0, right: 0, top: 6 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={chartColor.primary} />
              <stop offset="100%" stopColor={chartColor.pink} />
            </linearGradient>
          </defs>
          <XAxis domain={[0, Math.max(value, 1)]} hide type="number" />
          <YAxis dataKey="label" hide type="category" />
          <Tooltip
            content={renderHomzieChartTooltip}
            cursor={{ fill: "transparent" }}
            isAnimationActive={false}
          />
          <Bar
            barSize={10}
            dataKey="value"
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            minPointSize={value ? 2 : 0}
            name={label}
            radius={[999, 999, 999, 999]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HomziePeriodAreaChart({
  className,
  data,
  emptyLabel,
  metricLabel,
}: {
  className?: string;
  data: HomziePeriodDatum[];
  emptyLabel: string;
  metricLabel: string;
}) {
  const gradientId = useId().replaceAll(":", "");
  const maxValue = Math.max(
    ...data.map((item) => item.current),
    ...data.map((item) => item.previous || 0),
    0,
  );
  const hasData = maxValue > 0;

  return (
    <div
      className={cn(
        "relative h-72 overflow-hidden rounded-md border border-border bg-background bg-[linear-gradient(to_right,rgba(124,92,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,92,255,0.10)_1px,transparent_1px)] bg-[size:5rem_100%,100%_3.5rem]",
        className,
      )}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 720, height: 288 }}
      >
        <ComposedChart data={data} margin={{ bottom: 18, left: 0, right: 18, top: 18 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={chartColor.primary} stopOpacity={0.26} />
              <stop offset="100%" stopColor={chartColor.pink} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="rgba(124, 92, 255, 0.16)"
            strokeDasharray="3 5"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="label"
            interval="preserveStartEnd"
            minTickGap={26}
            tick={{ fill: chartColor.mutedForeground, fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            domain={[0, maxValue || 1]}
            tick={
              hasData
                ? { fill: chartColor.mutedForeground, fontSize: 11 }
                : false
            }
            tickFormatter={formatChartNumber}
            tickLine={false}
            width={42}
          />
          {hasData ? (
            <>
              <Tooltip
                content={renderHomzieChartTooltip}
                cursor={{ stroke: chartColor.primary, strokeDasharray: "3 5", strokeOpacity: 0.35 }}
                isAnimationActive={false}
              />
              <Area
                activeDot={{ fill: chartColor.pink, r: 5, stroke: chartColor.card, strokeWidth: 3 }}
                dataKey="current"
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
                name={`Current ${metricLabel}`}
                stroke={chartColor.primary}
                strokeWidth={3}
                type="monotone"
              />
              <Line
                connectNulls
                dataKey="previous"
                dot={false}
                isAnimationActive={false}
                name={`Previous ${metricLabel}`}
                stroke={chartColor.mutedForeground}
                strokeDasharray="7 7"
                strokeWidth={2.5}
                type="monotone"
              />
            </>
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
      {!hasData ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
          <div className="rounded-full border border-primary/15 bg-background/85 px-4 py-2 shadow-sm backdrop-blur">
            <p className="text-sm font-semibold text-muted-foreground">
              {emptyLabel}
            </p>
            <p className="mt-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground/75">
              Chart will activate once data is recorded
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function HomzieHorizontalBarChart({
  className,
  data,
  emptyLabel,
  valueLabel,
}: {
  className?: string;
  data: HomzieBarDatum[];
  emptyLabel: string;
  valueLabel: string;
}) {
  const rows = data.slice(0, 6);
  const maxValue = Math.max(...rows.map((item) => item.value), 0);

  if (!rows.length) {
    return (
      <div className="grid min-h-44 place-items-center rounded-md border border-dashed border-primary/20 bg-primary/5 p-6 text-center">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{emptyLabel}</p>
          <p className="mt-1 text-[10px] font-normal uppercase tracking-wide text-muted-foreground/75">
            Nothing to rank yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("grid min-h-44 gap-3 rounded-md border border-border bg-background p-3", className)}
    >
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`} className="grid gap-1.5">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{row.label}</p>
              {row.helper ? (
                <p className="mt-0.5 truncate text-[11px] font-normal text-muted-foreground">
                  {row.helper}
                </p>
              ) : null}
            </div>
            <p className="shrink-0 text-sm font-semibold">
              {formatChartNumber(row.value)}
            </p>
          </div>
          <div className="h-6 overflow-hidden rounded-md bg-[linear-gradient(to_right,rgba(124,92,255,0.10)_1px,transparent_1px)] bg-[size:25%_100%]">
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={{ width: 320, height: 24 }}
            >
              <BarChart
                data={[row]}
                layout="vertical"
                margin={{ bottom: 0, left: 0, right: 0, top: 0 }}
              >
                <XAxis domain={[0, maxValue || 1]} hide type="number" />
                <YAxis dataKey="label" hide type="category" />
                <Tooltip
                  content={renderHomzieChartTooltip}
                  cursor={{ fill: chartColor.primarySoft }}
                  isAnimationActive={false}
                />
                <Bar
                  barSize={10}
                  dataKey="value"
                  isAnimationActive={false}
                  minPointSize={maxValue ? 2 : 0}
                  name={valueLabel}
                  radius={[0, 999, 999, 0]}
                >
                  <Cell fill={barPalette[index % barPalette.length]} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
