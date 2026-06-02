import type { AgentPerformanceRange } from "./performance";

export const performanceRanges: Array<{
  label: string;
  value: AgentPerformanceRange;
}> = [
  { label: "Past month", value: "month" },
  { label: "Past 3 months", value: "3m" },
  { label: "Past 6 months", value: "6m" },
  { label: "Past 12 months", value: "12m" },
  { label: "This year", value: "year" },
  { label: "All time", value: "all" },
];
