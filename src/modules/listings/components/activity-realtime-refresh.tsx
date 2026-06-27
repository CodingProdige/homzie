"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  addUserNotificationCreatedListener,
  isListingNotification,
} from "@/modules/notifications/realtime-client";

type ActivityRealtimeRefreshProps = {
  className?: string;
  clearSearchParams?: string[];
  intervalMs?: number;
};

export function ActivityRealtimeRefresh({
  className,
  clearSearchParams = [],
  intervalMs = 5000,
}: ActivityRealtimeRefreshProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
      setLastUpdatedAt(new Date());
    });
  }, [router]);

  useEffect(() => {
    const initialUpdate = window.setTimeout(() => {
      setLastUpdatedAt(new Date());
    }, 0);

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const interval = window.setInterval(refreshIfVisible, intervalMs);
    const removeNotificationListener = addUserNotificationCreatedListener((event) => {
      if (document.visibilityState === "visible" && isListingNotification(event)) {
        refresh();
      }
    });

    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
      removeNotificationListener();
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [intervalMs, refresh]);

  useEffect(() => {
    if (!clearSearchParams.length) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    let changed = false;

    for (const key of clearSearchParams) {
      if (nextParams.has(key)) {
        nextParams.delete(key);
        changed = true;
      }
    }

    if (!changed) return;

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [clearSearchParams, pathname, router, searchParams]);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 font-semibold text-foreground">
        <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
        Live updates
      </span>
      {lastUpdatedAt ? (
        <span className="hidden sm:inline">
          Updated {lastUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 rounded-full px-2.5 text-xs"
        disabled={isPending}
        onClick={refresh}
      >
        <RefreshCw className={cn("size-3.5", isPending && "animate-spin")} />
        Refresh
      </Button>
    </div>
  );
}
