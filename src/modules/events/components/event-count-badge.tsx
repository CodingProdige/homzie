"use client";

import { useEffect, useState } from "react";

import { addUserNotificationCreatedListener } from "@/modules/notifications/realtime-client";

export function EventCountBadge({ className }: { className?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;

    async function refreshCount() {
      try {
        const response = await fetch("/api/events/unseen-count", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const payload = (await response.json()) as { count?: unknown };
        const nextCount =
          typeof payload.count === "number" && Number.isFinite(payload.count)
            ? payload.count
            : 0;

        if (alive) setCount(nextCount);
      } catch {}
    }

    refreshCount();
    const interval = window.setInterval(refreshCount, 20_000);
    const removeNotificationListener =
      addUserNotificationCreatedListener(refreshCount);

    return () => {
      alive = false;
      window.clearInterval(interval);
      removeNotificationListener();
    };
  }, []);

  if (!count) return null;

  return (
    <span className={className}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
