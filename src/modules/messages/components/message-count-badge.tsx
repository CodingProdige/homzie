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

    return () => {
      alive = false;
    };
  }, []);

  if (!count) return null;

  return (
    <span className={className}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
