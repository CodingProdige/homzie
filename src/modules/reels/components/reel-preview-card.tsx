"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Clock3, Loader2, PlayCircle, RotateCcw, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  deleteReelById,
  retryReelRender,
  trackReelWatchProgress,
} from "@/modules/reels/actions";
import { getAnalyticsViewerSessionId } from "@/modules/analytics/browser-session";

export type ReelPreviewCardData = {
  coverUrl?: string | null;
  durationLabel?: string;
  href: string;
  id: string;
  isPromoted?: boolean;
  renderProgress?: number | null;
  status?: "draft" | "failed" | "processing" | "published";
  title?: string | null;
  username?: string | null;
  viewCountLabel?: string;
  watched?: boolean;
};

export function ReelPreviewCard({ reel }: { reel: ReelPreviewCardData }) {
  const isProcessing = reel.status === "processing";
  const isFailed = reel.status === "failed";
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRetryPending, startRetryTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();
  const hasTrackedHoverRef = useRef(false);
  const hasTrackedImpressionRef = useRef(false);
  const hoverTimerRef = useRef<number | null>(null);
  const [polledProgress, setPolledProgress] = useState<number | null>(
    typeof reel.renderProgress === "number"
      ? Math.max(0, Math.min(100, Math.round(reel.renderProgress)))
      : null,
  );
  const renderProgress = polledProgress;

  useEffect(() => {
    if (reel.status !== "processing") return;

    let isActive = true;

    async function poll() {
      try {
        const response = await fetch(`/api/reels/${reel.id}/status`, {
          cache: "no-store",
        });

        if (!response.ok || !isActive) return;

        const result = (await response.json()) as {
          renderProgress?: number;
          status?: string;
        };

        if (typeof result.renderProgress === "number") {
          setPolledProgress((current) =>
            Math.max(
              current ?? 0,
              Math.max(0, Math.min(100, Math.round(result.renderProgress!))),
            ),
          );
        }

        if (result.status && result.status !== "processing") {
          window.location.reload();
        }
      } catch {
        // Progress is nice-to-have; the card still links to the editor/status page.
      }
    }

    void poll();
    const interval = window.setInterval(() => void poll(), 3000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [reel.id, reel.status]);

  useEffect(() => {
    if (reel.status !== "published" || hasTrackedImpressionRef.current) return;

    hasTrackedImpressionRef.current = true;
    void trackReelWatchProgress({
      eventType: "impression",
      reelId: reel.id,
      source: "reel_preview_card",
      viewerSessionId: getAnalyticsViewerSessionId(),
    });
  }, [reel.id, reel.status]);

  useEffect(
    () => () => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
      }
    },
    [],
  );

  function scheduleHoverTracking() {
    if (reel.status !== "published" || hasTrackedHoverRef.current) return;

    hoverTimerRef.current = window.setTimeout(() => {
      hasTrackedHoverRef.current = true;
      void trackReelWatchProgress({
        eventType: "hover",
        reelId: reel.id,
        source: "reel_preview_card",
        viewerSessionId: getAnalyticsViewerSessionId(),
      });
    }, 450);
  }

  function cancelHoverTracking() {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }

  const cardClassName = cn(
    "group relative isolate block aspect-[3/4] min-w-0 overflow-hidden rounded-lg bg-brand-midnight text-white shadow-sm transition",
    isProcessing || isFailed
      ? "cursor-default"
      : "hover:-translate-y-0.5 hover:shadow-md",
  );
  function retryFailedReel() {
    setActionError(null);
    startRetryTransition(async () => {
      const result = await retryReelRender(reel.id);

      if (!result.ok) {
        setActionError(result.error);
        return;
      }

      window.location.reload();
    });
  }

  function deleteFailedReel() {
    setActionError(null);
    startDeleteTransition(async () => {
      const result = await deleteReelById(reel.id);

      if (!result.ok) {
        setActionError(result.error);
        return;
      }

      window.location.reload();
    });
  }

  const content = (
    <>
      {reel.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Covers may be generated data URLs or protected local media URLs.
        <img
          alt=""
          draggable={false}
          className="absolute inset-0 size-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          src={reel.coverUrl}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(124,92,255,0.38),transparent_34%),linear-gradient(155deg,#111116,#050508)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 to-black/75" />

      {reel.watched && reel.status === "published" ? (
        <>
          <div className="absolute inset-0 z-10 bg-black/35 backdrop-saturate-75" />
          <span className="absolute left-2 top-2 z-20 rounded-full bg-black/55 px-2 py-1 text-[9px] font-black uppercase text-white shadow-sm backdrop-blur">
            Watched
          </span>
        </>
      ) : null}

      {reel.isPromoted ? (
        <span className="absolute right-2 top-2 z-20 rounded-full border border-white/15 bg-black/55 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white/75 backdrop-blur">
          Promoted
        </span>
      ) : null}

      {reel.status === "draft" ? (
        <div className="absolute left-2 top-2 z-20 grid size-7 place-items-center rounded-full bg-black/55 text-white shadow-sm backdrop-blur">
          <Clock3 className="size-3.5" />
        </div>
      ) : null}

      {reel.status === "processing" || reel.status === "failed" ? (
        <div className="absolute left-2 right-2 top-2 z-20">
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-1 text-[9px] font-black uppercase shadow-sm backdrop-blur",
              reel.status === "processing"
                ? "bg-violet-100/95 text-violet-700"
                : "bg-red-100/95 text-red-700",
            )}
          >
            {reel.status === "processing"
              ? `Processing${renderProgress !== null ? ` ${renderProgress}%` : ""}`
              : "Failed"}
          </span>
          {reel.status === "processing" && renderProgress !== null ? (
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/35 shadow-sm">
              <span
                className="block h-full rounded-full bg-violet-400"
                style={{ width: `${renderProgress}%` }}
              />
            </div>
          ) : null}
          {isFailed ? (
            <div className="mt-2 flex items-center gap-1.5">
              <button
                aria-label="Retry reel processing"
                className="grid size-8 place-items-center rounded-full bg-white/90 text-black shadow-sm transition hover:bg-white disabled:opacity-60"
                disabled={isRetryPending || isDeletePending}
                onClick={retryFailedReel}
                type="button"
              >
                {isRetryPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
              </button>
              <button
                aria-label="Delete failed reel"
                className="grid size-8 place-items-center rounded-full bg-red-100/95 text-red-700 shadow-sm transition hover:bg-red-50 disabled:opacity-60"
                disabled={isRetryPending || isDeletePending}
                onClick={deleteFailedReel}
                type="button"
              >
                {isDeletePending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </button>
            </div>
          ) : null}
          {actionError ? (
            <p className="mt-1 rounded-md bg-black/65 px-2 py-1 text-[10px] font-bold normal-case leading-4 text-white">
              {actionError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="absolute inset-x-3 bottom-3 z-20">
        {reel.title ? (
          <h3 className="line-clamp-2 text-sm font-black leading-tight text-white">
            {reel.title}
          </h3>
        ) : null}
        {reel.username ? (
          <p className="mt-1 truncate text-xs font-bold text-white/80">
            @{reel.username}
          </p>
        ) : null}
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-black">
          {reel.viewCountLabel ? (
            <span className="flex min-w-0 items-center gap-1 rounded-full bg-black/20 px-1.5 py-1 backdrop-blur-[1px]">
              <PlayCircle className="size-3.5 shrink-0" />
              {reel.viewCountLabel}
            </span>
          ) : null}
          {reel.durationLabel ? (
            <span className="rounded-full bg-black/20 px-1.5 py-1 backdrop-blur-[1px]">
              {reel.durationLabel}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );

  if (isProcessing || isFailed) {
    return (
      <div
        aria-disabled={isProcessing ? "true" : undefined}
        aria-label={isProcessing ? "Reel is still processing" : "Reel failed processing"}
        className={cardClassName}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={reel.href}
      draggable={false}
      className={cardClassName}
      onClick={() => {
        void trackReelWatchProgress({
          eventType: "click",
          reelId: reel.id,
          source: "reel_preview_card_click",
          viewerSessionId: getAnalyticsViewerSessionId(),
        });
      }}
      onPointerEnter={scheduleHoverTracking}
      onPointerLeave={cancelHoverTracking}
    >
      {content}
    </Link>
  );
}
