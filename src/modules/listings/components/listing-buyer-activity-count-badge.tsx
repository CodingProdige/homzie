"use client";

import { useEffect, useState } from "react";

import { getUnreadListingBuyerActivityCountAction } from "@/modules/listings/activity-count-actions";

export function ListingBuyerActivityCountBadge({
  className,
}: {
  className?: string;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;

    async function refreshCount() {
      const nextCount = await getUnreadListingBuyerActivityCountAction();
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
