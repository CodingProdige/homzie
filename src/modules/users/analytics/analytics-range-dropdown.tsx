"use client";

import { useRouter } from "next/navigation";

const rangeOptions = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 3 months" },
  { key: "12m", label: "Last 12 months" },
  { key: "all", label: "All time" },
];

export function AnalyticsRangeDropdown({
  activeRangeKey,
  baseHref,
}: {
  activeRangeKey: string;
  baseHref: string;
}) {
  const router = useRouter();
  const separator = baseHref.includes("?") ? "&" : "?";

  return (
    <label className="block min-w-48">
      <span className="sr-only">Time period</span>
      <select
        className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm font-black text-foreground shadow-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
        value={activeRangeKey}
        onChange={(event) => {
          router.push(`${baseHref}${separator}range=${event.target.value}`);
        }}
      >
        {rangeOptions.map((range) => (
          <option key={range.key} value={range.key}>
            {range.label}
          </option>
        ))}
      </select>
    </label>
  );
}
