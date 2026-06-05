"use client";

import { useEffect, useState } from "react";

import { getUnreadMessageCountAction } from "@/modules/messages/actions";

export function MessageCountBadge({ className }: { className?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;

    async function refreshCount() {
      const nextCount = await getUnreadMessageCountAction();
      if (alive) setCount(nextCount);
    }

    refreshCount();
    const interval = window.setInterval(refreshCount, 20_000);

    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  if (!count) return null;

  return (
    <span className={className}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
