"use client";

import { useEffect } from "react";

import { heartbeatPlatformVisitor } from "@/modules/platform-stats/actions";
import {
  platformStatsUpdatedEventName,
  type PlatformStatsUpdatedEvent,
} from "@/modules/platform-stats/events";

const visitorSessionKey = "homzie.visitorSessionId";
const heartbeatIntervalMs = 15_000;

function createVisitorId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getVisitorId() {
  const existing = sessionStorage.getItem(visitorSessionKey);

  if (existing) return existing;

  const next = createVisitorId();
  sessionStorage.setItem(visitorSessionKey, next);

  return next;
}

function onIdle(callback: () => void) {
  if ("requestIdleCallback" in window) {
    const idleId = window.requestIdleCallback(callback, { timeout: 3000 });

    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = globalThis.setTimeout(callback, 1500);

  return () => globalThis.clearTimeout(timeoutId);
}

export function PlatformVisitorHeartbeat() {
  useEffect(() => {
    let mounted = true;
    let inFlight = false;

    async function refreshPresence() {
      if (inFlight) return;

      inFlight = true;

      try {
        const stats = await heartbeatPlatformVisitor(getVisitorId());

        if (mounted) {
          window.dispatchEvent(
            new CustomEvent(platformStatsUpdatedEventName, {
              detail: { stats },
            }) satisfies PlatformStatsUpdatedEvent,
          );
        }
      } catch {
        // Visitor presence should never interrupt the page experience.
      } finally {
        inFlight = false;
      }
    }

    const cancelInitialRefresh = onIdle(() => {
      refreshPresence();
    });

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshPresence();
      }
    }, heartbeatIntervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshPresence();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      cancelInitialRefresh();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
