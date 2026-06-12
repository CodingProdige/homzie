"use client";

export function getAnalyticsViewerSessionId() {
  if (typeof window === "undefined") return "";

  const storageKey = "homzie-analytics-viewer-session";
  const existing = window.localStorage.getItem(storageKey);

  if (existing) return existing;

  const nextId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(storageKey, nextId);

  return nextId;
}
