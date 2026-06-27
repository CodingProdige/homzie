"use client";

import { useMemo } from "react";

import { useCurrency } from "@/modules/currency/currency-provider";

export type PerformanceTrendPoint = {
  label: string;
  valueCents: number;
};

function buildPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  return points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;

      const previous = points[index - 1];
      const controlX = (previous.x + point.x) / 2;

      return `C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
    })
    .join(" ");
}

export function PerformanceTrendChart({
  points,
}: {
  points: PerformanceTrendPoint[];
}) {
  const { formatPriceCentsCompact } = useCurrency();
  const hasData = points.some((point) => point.valueCents > 0);
  const maxValue = Math.max(...points.map((point) => point.valueCents), 0);
  const safeMax = maxValue > 0 ? maxValue : 1;
  const chartPoints = useMemo(
    () =>
      points.map((point, index) => ({
        x: points.length <= 1 ? 250 : 18 + (index / (points.length - 1)) * 464,
        y: 198 - (point.valueCents / safeMax) * 172,
      })),
    [points, safeMax],
  );
  const path = buildPath(chartPoints);
  const areaPath = path
    ? `${path} L ${chartPoints[chartPoints.length - 1].x} 205 L ${chartPoints[0].x} 205 Z`
    : "";
  const activePoint = chartPoints[chartPoints.length - 1];
  const yAxisLabels = [safeMax, Math.round(safeMax * 0.66), Math.round(safeMax * 0.33), 0];

  return (
    <div className="relative z-10 mt-6 h-56">
      <div className="absolute inset-x-0 bottom-0 top-0 rounded-md bg-[linear-gradient(to_top,rgba(255,77,184,0.22),transparent_62%)]" />
      <div className="absolute inset-0 grid grid-rows-4 text-[10px] font-bold text-white/35">
        {yAxisLabels.map((label, index) => (
          <div key={`${label}-${index}`} className="border-b border-white/7">
            {formatPriceCentsCompact(label)}
          </div>
        ))}
      </div>

      <svg
        viewBox="0 0 500 220"
        className="absolute inset-x-0 bottom-3 h-[86%] w-full overflow-visible"
        role="img"
        aria-label="Total value trend"
      >
        <defs>
          <linearGradient id="performance-trend" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#6335ff" />
            <stop offset="55%" stopColor="#b647ff" />
            <stop offset="100%" stopColor="#ff4db8" />
          </linearGradient>
          <linearGradient id="performance-trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ff4db8" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#6335ff" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {hasData && areaPath ? (
          <path d={areaPath} fill="url(#performance-trend-fill)" />
        ) : null}
        {hasData && path ? (
          <path
            d={path}
            fill="none"
            stroke="url(#performance-trend)"
            strokeLinecap="round"
            strokeWidth="5"
          />
        ) : (
          <path
            d="M18 198 L482 198"
            fill="none"
            stroke="rgba(255,255,255,0.24)"
            strokeLinecap="round"
            strokeWidth="4"
          />
        )}
        {hasData && activePoint ? (
          <circle
            cx={activePoint.x}
            cy={activePoint.y}
            r="8"
            fill="#ff4db8"
            stroke="#fff"
            strokeWidth="4"
          />
        ) : null}
      </svg>

      {!hasData ? (
        <div className="absolute inset-x-0 top-20 text-center text-xs font-semibold uppercase tracking-wide text-white/45">
          No sold value yet
        </div>
      ) : null}

      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] font-bold text-white/45">
        {points.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}
