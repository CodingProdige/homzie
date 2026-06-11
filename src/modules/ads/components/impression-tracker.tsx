"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { recordAdImpression } from "@/modules/ads/impression-actions";

export function ImpressionTracker({
  campaignId,
  children,
  className,
}: {
  campaignId: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const trackedRef = useRef(false);

  const track = useCallback(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    recordAdImpression(campaignId).catch(() => {});
  }, [campaignId]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          timer = setTimeout(track, 1000);
        } else {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [track]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
