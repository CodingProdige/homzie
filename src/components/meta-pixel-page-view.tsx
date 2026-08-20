"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

type MetaPixelPageViewProps = {
  pixelId: string;
};

export function MetaPixelPageView({ pixelId }: MetaPixelPageViewProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousPath = useRef<string | null>(null);
  const query = searchParams.toString();
  const pagePath = query ? `${pathname}?${query}` : pathname;

  useEffect(() => {
    // The root-layout snippet records the initial PageView. Track only client-side
    // navigations here so the landing page is not counted twice.
    if (previousPath.current === null) {
      previousPath.current = pagePath;
      return;
    }

    if (previousPath.current !== pagePath) {
      window.fbq?.("track", "PageView");
      previousPath.current = pagePath;
    }
  }, [pagePath, pixelId]);

  return null;
}
