"use client";

type GtagEventParams = Record<string, boolean | number | string | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackGoogleEvent(
  eventName: string,
  params: GtagEventParams = {},
) {
  if (typeof window === "undefined") return;

  window.gtag?.("event", eventName, params);
}
