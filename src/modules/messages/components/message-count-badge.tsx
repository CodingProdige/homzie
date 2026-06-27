"use client";

import { useEffect, useState } from "react";

import { getUnreadMessageCountAction } from "@/modules/messages/actions";

export function MessageCountBadge({ className }: { className?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;

    async function refreshCount() {
      if (document.visibilityState !== "visible") return;

      const nextCount = await getUnreadMessageCountAction();
      if (alive) setCount(nextCount);
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
