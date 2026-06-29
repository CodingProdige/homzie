"use client";

import { useEffect, useState } from "react";

import { addUserNotificationCreatedListener } from "@/modules/notifications/realtime-client";

type CountResponse = {
  count?: unknown;
};

function normalizeCount(payload: CountResponse) {
  return typeof payload.count === "number" && Number.isFinite(payload.count)
    ? payload.count
    : 0;
}

async function fetchCount(path: string) {
  const response = await fetch(path, { cache: "no-store" });

  if (!response.ok) return 0;

  return normalizeCount((await response.json()) as CountResponse);
}

export function ActivityCountBadge({ className }: { className?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;

    async function refreshCount() {
      if (document.visibilityState !== "visible") return;

      try {
        const [eventCount, listingBuyerCount] = await Promise.all([
          fetchCount("/api/events/unseen-count"),
          fetchCount("/api/listings/buyer-activity/unread-count"),
        ]);

        if (alive) setCount(eventCount + listingBuyerCount);
      } catch {}
    }

    refreshCount();
    const interval = window.setInterval(refreshCount, 5000);
    const removeNotificationListener =
      addUserNotificationCreatedListener(refreshCount);
    document.addEventListener("visibilitychange", refreshCount);

    return () => {
      alive = false;
      window.clearInterval(interval);
      removeNotificationListener();
      document.removeEventListener("visibilitychange", refreshCount);
    };
  }, []);

  if (!count) return null;

  return (
    <span className={className}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
