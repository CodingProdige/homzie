"use client";

import { useEffect, useState } from "react";

export function MessageCountBadge({ className }: { className?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;

    async function refreshCount() {
      if (document.visibilityState !== "visible") return;

      try {
        const response = await fetch("/api/messages/unread-count", {
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
    const interval = window.setInterval(refreshCount, 5000);
    document.addEventListener("visibilitychange", refreshCount);

    return () => {
      alive = false;
      window.clearInterval(interval);
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
