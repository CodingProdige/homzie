import type { PlatformStats } from "./actions";

export const platformStatsUpdatedEventName = "homzie:platform-stats-updated";

export type PlatformStatsUpdatedEvent = CustomEvent<{
  stats: PlatformStats;
}>;
