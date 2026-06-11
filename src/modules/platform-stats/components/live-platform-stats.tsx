"use client";

import { useEffect, useState } from "react";

import {
  getPlatformStats,
  heartbeatPlatformVisitor,
  type PlatformStats,
} from "@/modules/platform-stats/actions";

const visitorSessionKey = "homzie.visitorSessionId";

type LivePlatformStatsProps = {
  initialStats: PlatformStats;
};

type StatItem = {
  label: string;
  value: string;
};

function formatCount(value: number) {
  return Math.max(0, value).toLocaleString();
}

function formatSoldValue(cents: number) {
  return new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
  }).format(Math.max(0, cents) / 100);
}

function createVisitorId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getVisitorId() {
  const existing = sessionStorage.getItem(visitorSessionKey);

  if (existing) return existing;

  const next = createVisitorId();
  sessionStorage.setItem(visitorSessionKey, next);

  return next;
}

function onIdle(callback: () => void) {
  if ("requestIdleCallback" in window) {
    const idleId = window.requestIdleCallback(callback, { timeout: 3000 });

    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = globalThis.setTimeout(callback, 1500);

  return () => globalThis.clearTimeout(timeoutId);
}

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

function statsToItems(stats: PlatformStats): StatItem[] {
  return [
    {
      label: pluralize(stats.currentVisitors, "live visitor", "live visitors"),
      value: formatCount(stats.currentVisitors),
    },
    {
      label: "listings",
      value: formatCount(stats.totalListings),
    },
    {
      label: "property reels",
      value: formatCount(stats.totalReels),
    },
    {
      label: "sold",
      value:
        stats.totalSoldValueCents > 0
          ? `${formatSoldValue(stats.totalSoldValueCents)}+`
          : formatSoldValue(stats.totalSoldValueCents),
    },
    {
      label: "users",
      value: formatCount(stats.totalUsers),
    },
  ];
}

export function LivePlatformStats({ initialStats }: LivePlatformStatsProps) {
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    let mounted = true;

    async function refresh(heartbeat = true) {
      try {
        const nextStats = heartbeat
          ? await heartbeatPlatformVisitor(getVisitorId())
          : await getPlatformStats();

        if (mounted) {
          setStats(nextStats);
        }
      } catch {
        // Keep the server-rendered stats if a refresh fails.
      }
    }

    const cancelInitialRefresh = onIdle(() => {
      refresh();
    });

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }, 15_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      cancelInitialRefresh();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const items = statsToItems(stats);

  return (
    <div className="relative z-0 mt-7 hidden max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center text-xs font-black text-muted-foreground sm:flex sm:gap-x-7 sm:text-sm">
      {items.map((item, index) => {
        return (
          <span className="contents" key={item.label}>
            <span className="whitespace-nowrap">
              <span className="text-foreground/75">{item.value}</span>{" "}
              <span>{item.label}</span>
            </span>
            {index < items.length - 1 ? (
              <span aria-hidden="true" className="text-muted-foreground/80">
                &bull;
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
