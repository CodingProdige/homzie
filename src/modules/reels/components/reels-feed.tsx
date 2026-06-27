"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  Check,
  ChevronRight,
  Copy,
  Heart,
  ImageIcon,
  Link2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat2,
  Send,
  Share2,
  Smile,
  ThumbsDown,
  Trash2,
  X,
  AtSign,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/modules/currency/currency-provider";
import { ReportContentButton } from "@/modules/moderation/report-content-button";
import { buildReelPath } from "@/modules/reels/urls";
import {
  createReelComment,
  deleteReel,
  deleteReelComment,
  editReelComment,
  getReelOwnerListings,
  getReelComments,
  getReelMentionSuggestions,
  linkReelListing,
  recordReelFeedback,
  trackReelListingClick,
  toggleReelCommentDislike,
  toggleProfileFollow,
  toggleReelCommentLike,
  toggleReelLike,
  toggleReelReshare,
  toggleReelSave,
  trackReelWatchProgress,
} from "@/modules/reels/actions";
import { RichCaption } from "./rich-caption";

export type ReelFeedItem = {
  id: string;
  agentName: string;
  agentUsername: string;
  agentAvatarUrl?: string | null;
  title: string;
  location: string;
  price?: string;
  priceZarCents?: number | null;
  recommendationReasons?: string[];
  beds?: string;
  baths?: string;
  size?: string;
  likes: string;
  likeCount: number;
  comments: string;
  commentCount: number;
  shares: string;
  shareCount: number;
  resharedByViewer: boolean;
  reshareCount: number;
  reshares: string;
  resharedByName?: string;
  resharedByUsername?: string;
  savedByViewer: boolean;
  saveCount: number;
  saves: string;
  likedByViewer: boolean;
  followingAgent: boolean;
  isOwnAgent: boolean;
  colorA?: string;
  colorB?: string;
  listingId?: string;
  videoUrl?: string;
  posterUrl?: string;
  linkedListingId?: string | null;
  linkedListing?: ReelLinkedListing | null;
};

type ReelLinkedListing = {
  coverImageUrl: string | null;
  id: string;
  location: string | null;
  priceCents: number | null;
  priceLabel: string | null;
  status: string;
  title: string;
};

type ReelOwnerListing = ReelLinkedListing;

type ReelCommentItem = {
  avatarUrl: string | null;
  body: string;
  createdAtLabel: string;
  dislikedByViewer: boolean;
  dislikeCount: number;
  dislikeCountLabel: string;
  id: string;
  isOwnComment: boolean;
  likedByViewer: boolean;
  likeCount: number;
  likeCountLabel: string;
  mediaUrl: string | null;
  name: string;
  parentId: string | null;
  username: string | null;
  userId: string;
};

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function prioritizeReel(reels: ReelFeedItem[], preferredReelId?: string | null) {
  if (!preferredReelId) return reels;

  const preferredReel = reels.find((reel) => reel.id === preferredReelId);

  if (!preferredReel) return reels;

  return [
    preferredReel,
    ...reels.filter((reel) => reel.id !== preferredReelId),
  ];
}

function orderReelsForSession(
  reels: ReelFeedItem[],
  scope: string,
  preferredReelId?: string | null,
  hiddenReelIds = new Set<string>(),
) {
  const visibleReels = reels.filter((reel) => !hiddenReelIds.has(reel.id));
  const prioritizedReels = prioritizeReel(visibleReels, preferredReelId);

  if (typeof window === "undefined") {
    return prioritizedReels;
  }

  const storageKey = `homzie-seen-reels:${scope}`;
  const seenIds = new Set(
    JSON.parse(window.sessionStorage.getItem(storageKey) || "[]") as string[],
  );
  const unseen = prioritizedReels.filter((reel) => !seenIds.has(reel.id));
  const seen = prioritizedReels.filter((reel) => seenIds.has(reel.id));
  const ordered = [...unseen, ...seen];

  return prioritizeReel(ordered, preferredReelId);
}

function readHiddenReelIds() {
  if (typeof window === "undefined") return new Set<string>();

  const storageKeys = [
    "homzie-hidden-reels:not_interested",
    "homzie-hidden-reels:dismissed_home",
  ];

  return new Set(
    storageKeys.flatMap((storageKey) => {
      try {
        return JSON.parse(window.localStorage.getItem(storageKey) || "[]") as string[];
      } catch {
        return [];
      }
    }),
  );
}

function rememberWatchedReel(scope: string, reelId: string) {
  if (typeof window === "undefined") return;

  const storageKeys = [
    `homzie-seen-reels:${scope}`,
    "homzie-seen-reels:all",
  ];

  storageKeys.forEach((storageKey) => {
    const watchedIds = new Set(
      JSON.parse(window.sessionStorage.getItem(storageKey) || "[]") as string[],
    );
    watchedIds.add(reelId);
    window.sessionStorage.setItem(storageKey, JSON.stringify([...watchedIds]));
  });
}

function rememberHiddenReel(reelId: string, reason: "dismissed_home" | "not_interested") {
  if (typeof window === "undefined") return;

  const storageKey = `homzie-hidden-reels:${reason}`;
  const hiddenIds = new Set(
    JSON.parse(window.localStorage.getItem(storageKey) || "[]") as string[],
  );

  hiddenIds.add(reelId);
  window.localStorage.setItem(storageKey, JSON.stringify([...hiddenIds].slice(-200)));
}

function getViewerSessionId() {
  if (typeof window === "undefined") return "";

  const storageKey = "homzie-reel-viewer-session";
  const existing = window.localStorage.getItem(storageKey);

  if (existing) return existing;

  const nextId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(storageKey, nextId);

  return nextId;
}

function PropertyArtwork({ reel }: { reel: ReelFeedItem }) {
  const colorA = reel.colorA || "#161625";
  const colorB = reel.colorB || "#7c3aed";

  return (
    <div
      className="absolute inset-0"
      style={{
        background: `linear-gradient(155deg, ${colorA}, ${colorB})`,
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.25),transparent_30%),linear-gradient(to_bottom,rgba(0,0,0,0.08),rgba(0,0,0,0.72))]" />
      <div className="absolute inset-x-8 top-[18%] h-[32%] rounded-t-lg bg-brand-black/70 shadow-2xl">
        <div className="absolute bottom-5 left-5 h-16 w-24 rounded bg-white/15" />
        <div className="absolute bottom-5 right-5 h-24 w-20 rounded bg-white/20" />
        <div className="absolute left-8 top-6 h-12 w-20 rounded bg-white/10" />
      </div>
      <div className="absolute inset-x-0 top-[49%] h-16 bg-white/10" />
      <div className="absolute bottom-0 left-0 right-0 h-[34%] bg-gradient-to-t from-black/80 to-transparent" />
    </div>
  );
}

function ReelCard({
  isMuted,
  onVisible,
  reel,
  scope,
}: {
  isMuted: boolean;
  onVisible?: (reelId: string) => void;
  reel: ReelFeedItem;
  scope: string;
}) {
  const cardRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captionRef = useRef<HTMLDivElement | null>(null);
  const hasRecordedViewRef = useRef(false);
  const hasTrackedHoverRef = useRef(false);
  const fastSkipRecordedRef = useRef(false);
  const hoverTimerRef = useRef<number | null>(null);
  const isSeekingRef = useRef(false);
  const lastTapRef = useRef(0);
  const tapTimeoutRef = useRef<number | null>(null);
  const progressFrameRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const visibleSinceRef = useRef<number | null>(null);
  const lastAnalyticsRef = useRef({
    currentTime: 0,
    sentAt: 0,
  });
  const [hasLongCaption, setHasLongCaption] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isListingSheetOpen, setIsListingSheetOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [liked, setLiked] = useState(reel.likedByViewer);
  const [likeLabel, setLikeLabel] = useState(reel.likes);
  const [commentLabel, setCommentLabel] = useState(reel.comments);
  const [saved, setSaved] = useState(reel.savedByViewer);
  const [saveLabel, setSaveLabel] = useState(reel.saves);
  const [reshared, setReshared] = useState(reel.resharedByViewer);
  const [reshareLabel, setReshareLabel] = useState(reel.reshares);
  const [reshareNotice, setReshareNotice] = useState("");
  const [linkedListingId, setLinkedListingId] = useState(reel.linkedListingId || null);
  const [linkedListing, setLinkedListing] = useState(reel.linkedListing || null);
  const [followingAgent, setFollowingAgent] = useState(reel.followingAgent);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const analyticsSource = reel.resharedByUsername
    ? "reshare-feed"
    : scope === "global"
      ? "global-feed"
      : "profile-feed";
  const linkedListingHref = linkedListingId ? `/listings/${linkedListingId}` : "";

  const togglePlayback = () => {
    const video = videoRef.current;

    if (!video) return;

    if (video.paused) {
      void video.play();
      setIsPlaying(true);
      return;
    }

    video.pause();
    setIsPlaying(false);
  };

  const handleVideoTap = (event: { timeStamp: number }) => {
    const now = event.timeStamp;
    const isDoubleTap = now - lastTapRef.current < 280;

    lastTapRef.current = now;

    if (isDoubleTap) {
      if (tapTimeoutRef.current !== null) {
        window.clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }

      if (!liked) {
        void handleLikeToggle();
      }

      return;
    }

    tapTimeoutRef.current = window.setTimeout(() => {
      togglePlayback();
      tapTimeoutRef.current = null;
    }, 280);
  };

  const seekVideo = (value: number) => {
    const video = videoRef.current;

    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      return;
    }

    const nextProgress = Math.min(1, Math.max(0, value));
    video.currentTime = nextProgress * video.duration;
    setProgress(nextProgress);
    progressRef.current = nextProgress;
  };

  const commitSeekProgress = (value: number) => {
    isSeekingRef.current = false;
    seekVideo(value);
  };

  const requireSignedIn = () => {
    // Server actions enforce auth; this keeps the mobile UX clear.
    return true;
  };

  const handleFollowToggle = async () => {
    if (!requireSignedIn()) return;

    const previous = followingAgent;
    setFollowingAgent(!previous);
    const result = await toggleProfileFollow(reel.agentUsername);

    if (!result.ok) {
      setFollowingAgent(previous);
      return;
    }

    setFollowingAgent(result.following);
    if (result.following) {
      void trackReelWatchProgress({
        eventType: "follow",
        reelId: reel.id,
        source: analyticsSource,
        viewerSessionId: getViewerSessionId(),
      });
    }
  };

  const handleLikeToggle = async () => {
    const previousLiked = liked;
    const previousLabel = likeLabel;
    setLiked(!previousLiked);
    const result = await toggleReelLike(reel.id);

    if (!result.ok) {
      setLiked(previousLiked);
      setLikeLabel(previousLabel);
      return;
    }

    setLiked(result.liked);
    setLikeLabel(result.countLabel);
  };

  const handleSaveToggle = async () => {
    const previous = saved;
    setSaved(!previous);
    const result = await toggleReelSave(reel.id);

    if (!result.ok) {
      setSaved(previous);
      return;
    }

    setSaved(result.saved);
    setSaveLabel(result.countLabel);
  };

  const handleReshareToggle = async () => {
    const previous = reshared;
    const previousLabel = reshareLabel;
    setReshared(!previous);
    const result = await toggleReelReshare(reel.id);

    if (!result.ok) {
      setReshared(previous);
      setReshareLabel(previousLabel);
      setReshareNotice(result.error || "This reel cannot be reshared.");
      return;
    }

    setReshared(result.reshared);
    setReshareLabel(result.countLabel);
  };

  useEffect(() => {
    if (!reshareNotice) return;

    const timeout = window.setTimeout(() => setReshareNotice(""), 2200);

    return () => window.clearTimeout(timeout);
  }, [reshareNotice]);

  useEffect(() => {
    const element = cardRef.current;

    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          visibleSinceRef.current = Date.now();
          onVisible?.(reel.id);
          rememberWatchedReel(scope, reel.id);

          if (!hasRecordedViewRef.current) {
            hasRecordedViewRef.current = true;
            void trackReelWatchProgress({
              eventType: "view",
              reelId: reel.id,
              source: analyticsSource,
              viewerSessionId: getViewerSessionId(),
            });
          }
        } else if (visibleSinceRef.current && !fastSkipRecordedRef.current) {
          const visibleMs = Date.now() - visibleSinceRef.current;
          visibleSinceRef.current = null;

          if (visibleMs < 2200 && progressRef.current < 0.1) {
            fastSkipRecordedRef.current = true;
            void recordReelFeedback({
              feedbackType: "fast_skip",
              reelId: reel.id,
              source: analyticsSource,
              viewerSessionId: getViewerSessionId(),
            });
          }
        }
      },
      { threshold: 0.65 },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [analyticsSource, onVisible, reel.id, scope]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    video.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;

        if (entry.isIntersecting) {
          void video
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => {
              video.controls = true;
              setIsPlaying(false);
            });
        } else {
          video.pause();
          setIsPlaying(false);
        }
      },
      { threshold: 0.65 },
    );

    observer.observe(video);

    return () => observer.disconnect();
  }, [reel.id, scope]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    const syncVisualProgress = () => {
      if (
        !isSeekingRef.current &&
        Number.isFinite(video.duration) &&
        video.duration > 0
      ) {
        setProgress(Math.min(1, Math.max(0, video.currentTime / video.duration)));
        progressRef.current = Math.min(
          1,
          Math.max(0, video.currentTime / video.duration),
        );
      }

      progressFrameRef.current = window.requestAnimationFrame(syncVisualProgress);
    };

    const updateProgress = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        if (!isSeekingRef.current) {
          setProgress(0);
        }
        return;
      }

      const nextProgress = Math.min(1, Math.max(0, video.currentTime / video.duration));
      progressRef.current = nextProgress;
      const now = Date.now();
      const last = lastAnalyticsRef.current;
      const watchSeconds =
        video.currentTime > last.currentTime
          ? Math.min(10, Math.max(0, video.currentTime - last.currentTime))
          : 0;
      const shouldTrack =
        now - last.sentAt > 5000 ||
        nextProgress >= 0.95 ||
        video.currentTime < last.currentTime;

      if (shouldTrack) {
        lastAnalyticsRef.current = {
          currentTime: video.currentTime,
          sentAt: now,
        };

        void trackReelWatchProgress({
          completed: nextProgress >= 0.95,
          durationSeconds: video.duration,
          eventType: nextProgress >= 0.95 ? "complete" : "progress",
          progressSeconds: video.currentTime,
          reelId: reel.id,
          source: analyticsSource,
          viewerSessionId: getViewerSessionId(),
          watchSeconds,
        });
      }
    };

    progressFrameRef.current = window.requestAnimationFrame(syncVisualProgress);
    video.addEventListener("timeupdate", updateProgress);
    video.addEventListener("loadedmetadata", updateProgress);
    video.addEventListener("durationchange", updateProgress);

    return () => {
      if (progressFrameRef.current !== null) {
        window.cancelAnimationFrame(progressFrameRef.current);
      }

      video.removeEventListener("timeupdate", updateProgress);
      video.removeEventListener("loadedmetadata", updateProgress);
      video.removeEventListener("durationchange", updateProgress);
    };
  }, [analyticsSource, reel.id, scope]);

  useEffect(() => {
    const caption = captionRef.current;

    if (!caption) return;

    const updateLongCaption = () => {
      setHasLongCaption(caption.scrollHeight > caption.clientHeight + 4);
    };

    updateLongCaption();

    const observer = new ResizeObserver(updateLongCaption);
    observer.observe(caption);

    return () => observer.disconnect();
  }, [reel.title, isCaptionExpanded]);

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current !== null) {
        window.clearTimeout(tapTimeoutRef.current);
      }
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  function scheduleHoverTracking() {
    if (hasTrackedHoverRef.current) return;

    hoverTimerRef.current = window.setTimeout(() => {
      hasTrackedHoverRef.current = true;
      void trackReelWatchProgress({
        eventType: "hover",
        reelId: reel.id,
        source: analyticsSource,
        viewerSessionId: getViewerSessionId(),
      });
    }, 450);
  }

  function cancelHoverTracking() {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }

  return (
    <section
      ref={cardRef}
      data-reel-card
      className="relative h-dvh snap-start overflow-hidden bg-black text-white lg:mx-auto lg:aspect-[9/16] lg:h-[clamp(640px,100dvh,920px)] lg:w-auto lg:rounded-2xl lg:shadow-2xl lg:shadow-black/45"
      onClick={handleVideoTap}
      onPointerEnter={scheduleHoverTracking}
      onPointerLeave={cancelHoverTracking}
    >
      {reel.videoUrl ? (
        <video
          ref={videoRef}
          className="absolute inset-0 size-full object-cover"
          controls={false}
          loop
          muted={isMuted}
          playsInline
          poster={reel.posterUrl}
          preload="metadata"
          src={reel.videoUrl}
        />
      ) : (
        <PropertyArtwork reel={reel} />
      )}

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.45)_0%,rgba(0,0,0,0.08)_24%,rgba(0,0,0,0.12)_54%,rgba(0,0,0,0.82)_100%)]" />

      {process.env.NODE_ENV === "development" &&
      reel.recommendationReasons?.length ? (
        <div className="pointer-events-none absolute left-3 top-[calc(env(safe-area-inset-top)+4.25rem)] z-20 max-w-[70%] rounded-full bg-black/45 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/80 backdrop-blur">
          {reel.recommendationReasons.slice(0, 3).join(" · ")}
        </div>
      ) : null}

      {!isPlaying ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="grid size-20 place-items-center rounded-full bg-black/35 text-white shadow-2xl backdrop-blur lg:scale-[var(--reel-ui-scale)]">
            <span className="ml-1 size-0 border-y-[16px] border-l-[24px] border-y-transparent border-l-white" />
          </div>
        </div>
      ) : null}

      <div
        className="absolute inset-x-0 bottom-0 z-40 px-2 pb-[max(env(safe-area-inset-bottom),0.25rem)] pt-3"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="range"
          aria-label="Reel progress"
          className="reel-progress-slider block h-5 w-full cursor-pointer appearance-none bg-transparent"
          max={1000}
          min={0}
          step={1}
          value={Math.round(progress * 1000)}
          onPointerDown={() => {
            isSeekingRef.current = true;
          }}
          onPointerUp={(event) => {
            commitSeekProgress(Number(event.currentTarget.value) / 1000);
          }}
          onPointerCancel={(event) => {
            commitSeekProgress(Number(event.currentTarget.value) / 1000);
          }}
          onBlur={(event) => {
            if (isSeekingRef.current) {
              commitSeekProgress(Number(event.currentTarget.value) / 1000);
            }
          }}
          onInput={(event) => {
            seekVideo(Number(event.currentTarget.value) / 1000);
          }}
          onChange={(event) => {
            if (!isSeekingRef.current) {
              seekVideo(Number(event.target.value) / 1000);
            }
          }}
          style={{
            background: `linear-gradient(90deg, #6d3cff 0%, #ff3fb4 ${progress * 100}%, rgba(255,255,255,0.32) ${progress * 100}%, rgba(255,255,255,0.32) 100%)`,
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-1 bg-white/30">
        <div
          className="h-full rounded-r-full bg-[var(--homzie-gradient)] shadow-[0_0_8px_rgba(255,63,180,0.75)]"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {reel.isOwnAgent ? (
        <button
          type="button"
          aria-label="Link listing"
          className={cn(
            "absolute right-4 top-[calc(env(safe-area-inset-top)+7.75rem)] z-20 flex size-10 origin-center items-center justify-center rounded-full bg-[var(--homzie-gradient)] text-white shadow-lg shadow-primary/30 ring-1 ring-white/30 lg:right-[calc(1rem*var(--reel-ui-scale))] lg:top-[calc((env(safe-area-inset-top)+7.75rem)*var(--reel-ui-scale))] lg:scale-[var(--reel-ui-scale)]",
            linkedListing && "top-[calc(env(safe-area-inset-top)+11rem)] lg:top-[calc((env(safe-area-inset-top)+11rem)*var(--reel-ui-scale))]",
            linkedListingId && "ring-2 ring-emerald-300",
          )}
          onClick={(event) => {
            event.stopPropagation();
            setIsListingSheetOpen(true);
          }}
        >
          <Link2 className="size-5 stroke-[3]" />
        </button>
      ) : null}

      {linkedListing ? (
        <div
          className="absolute left-3 right-3 top-[calc(env(safe-area-inset-top)+4.25rem)] z-20 lg:left-[calc(0.75rem*var(--reel-ui-scale))] lg:right-[calc(0.75rem*var(--reel-ui-scale))] lg:top-[calc((env(safe-area-inset-top)+4.25rem)*var(--reel-ui-scale))]"
          onClick={(event) => event.stopPropagation()}
        >
          <ReelListingLinkCard
            actionLabel="View now"
            href={linkedListingHref}
            listing={linkedListing}
            onAction={async () => {
              if (!linkedListingId) return;

              await trackReelListingClick({
                listingId: linkedListingId,
                reelId: reel.id,
                source: analyticsSource,
                viewerSessionId: getViewerSessionId(),
              });
            }}
          />
        </div>
      ) : null}

      <aside className="absolute bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] right-3 z-20 flex origin-bottom-right flex-col items-center gap-4 text-white lg:scale-[var(--reel-ui-scale)]">
        <div className="relative mb-1">
          <Link
            href={`/users/${reel.agentUsername}`}
            className="flex size-12 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[var(--homzie-gradient)] text-sm font-semibold shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            {reel.agentAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- User avatars can be local media URLs.
              <img
                src={reel.agentAvatarUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              initialsFromName(reel.agentName)
            )}
          </Link>
          {!reel.isOwnAgent ? (
            <button
              type="button"
              className={cn(
                "absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border-2 border-white text-white shadow-lg transition-transform hover:scale-105",
                followingAgent
                  ? "[background:var(--homzie-gradient)]"
                  : "bg-brand-pink",
              )}
              aria-label={followingAgent ? "Unfollow profile" : "Follow profile"}
              onClick={(event) => {
                event.stopPropagation();
                void handleFollowToggle();
              }}
            >
              {followingAgent ? (
                <Check className="size-3 stroke-[3]" />
              ) : (
                <Plus className="size-3 stroke-[3]" />
              )}
            </button>
          ) : null}
        </div>

        <ReelActionButton
          active={liked}
          activeTone="heart"
          icon={Heart}
          label={likeLabel}
          onClick={handleLikeToggle}
        />
        <ReelActionButton
          icon={MessageCircle}
          label={commentLabel}
          onClick={() => setIsCommentsOpen(true)}
        />
        <div className="relative">
          <ReelActionButton
            active={reshared}
            icon={Repeat2}
            label={reshareLabel}
            onClick={handleReshareToggle}
          />
          {reshareNotice ? (
            <div
              className="absolute right-full top-1/2 mr-3 w-48 -translate-y-1/2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              {reshareNotice}
              <span className="absolute -right-1 top-1/2 size-3 -translate-y-1/2 rotate-45 bg-white" />
            </div>
          ) : null}
        </div>
        <ReelActionButton
          icon={Share2}
          label={reel.shares}
          onClick={() => setIsShareOpen(true)}
        />
        <ReelActionButton
          active={saved}
          activeTone="gradient"
          icon={Bookmark}
          label={saveLabel}
          onClick={handleSaveToggle}
        />
      </aside>

      <div
        className="absolute bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] left-3 right-20 z-20 rounded-lg bg-black/10 p-3 text-white shadow-lg drop-shadow backdrop-blur-[2px] lg:bottom-[calc((env(safe-area-inset-bottom)+1.25rem)*var(--reel-ui-scale))] lg:left-[calc(0.75rem*var(--reel-ui-scale))] lg:right-[calc(5rem*var(--reel-ui-scale))]"
        onClick={(event) => event.stopPropagation()}
      >
        <Link
          href={`/users/${reel.agentUsername}`}
          className="text-sm font-bold"
        >
          @{reel.agentUsername}
        </Link>
        {reel.resharedByUsername ? (
          <Link
            href={`/users/${reel.resharedByUsername}`}
            className="mt-1 block text-xs font-bold text-white/75"
          >
            Reshared by @{reel.resharedByUsername}
          </Link>
        ) : null}
        <p className="mt-2 text-xs font-semibold text-white/90">{reel.location}</p>
        <div
          ref={captionRef}
          className={cn(
            "mt-2 overflow-hidden text-[15px] font-normal leading-snug",
            isCaptionExpanded
              ? "max-h-[50dvh] overflow-y-auto pr-1"
              : "line-clamp-3 max-h-[4.4rem]",
          )}
        >
          <RichCaption text={reel.title} className="font-normal" />
        </div>
        {(hasLongCaption || isCaptionExpanded) && (
          <button
            type="button"
            className="mt-1 text-sm font-bold text-white/85"
            onClick={() => setIsCaptionExpanded((value) => !value)}
          >
            {isCaptionExpanded ? "Show less" : "Show more"}
          </button>
        )}
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-white/90">
          <Send className="size-4" />
          Original sound
        </div>
      </div>
      <CommentsSheet
        open={isCommentsOpen}
        reel={reel}
        commentLabel={commentLabel}
        onCommentCountChange={setCommentLabel}
        onClose={() => setIsCommentsOpen(false)}
      />
      <ListingLinkSheet
        linkedListingId={linkedListingId}
        onLinkedListingChange={(listing) => {
          setLinkedListingId(listing?.id || null);
          setLinkedListing(listing);
        }}
        onClose={() => setIsListingSheetOpen(false)}
        open={isListingSheetOpen}
        reel={reel}
      />
      <ShareSheet
        open={isShareOpen}
        reel={reel}
        onClose={() => setIsShareOpen(false)}
        onShare={() => {
          void trackReelWatchProgress({
            eventType: "share",
            reelId: reel.id,
            source: analyticsSource,
            viewerSessionId: getViewerSessionId(),
          });
        }}
      />
    </section>
  );
}

function OwnerReelMenu({
  onOpenChange,
  open,
  reelId,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  reelId: string;
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Reel options"
        className="flex size-10 items-center justify-center rounded-full bg-black/35 text-white shadow-lg ring-1 ring-white/20 backdrop-blur transition hover:bg-black/55"
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!open);
        }}
      >
        <MoreHorizontal className="size-5" />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-12 w-44 overflow-hidden rounded-2xl bg-white text-sm font-semibold text-black shadow-2xl ring-1 ring-black/10"
          onClick={(event) => event.stopPropagation()}
        >
          <Link
            href={`/reels/${reelId}/edit`}
            className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-black/5"
          >
            <Pencil className="size-4" />
            Edit reel
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-red-500 hover:bg-red-50"
            onClick={() => {
              onOpenChange(false);
              setDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="size-4" />
            Delete reel
          </button>
        </div>
      ) : null}
      <Dialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-[91] w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-5 text-foreground shadow-2xl outline-none"
            onClick={(event) => event.stopPropagation()}
          >
            <Dialog.Title className="text-base font-semibold">
              Delete reel?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
              This permanently removes the reel and clears it from saved profiles,
              likes, comments and reshares.
            </Dialog.Description>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Dialog.Close>
              <form action={deleteReel}>
                <input type="hidden" name="reelId" value={reelId} />
                <Button type="submit" variant="destructive" className="w-full">
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </form>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function ViewerReelMenu({
  onNotInterested,
  reel,
}: {
  onNotInterested: () => void | Promise<void>;
  reel: ReelFeedItem;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Reel options"
        className="flex size-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal className="size-5" />
      </button>
      {open ? (
        <div className="absolute right-0 top-12 w-52 overflow-hidden rounded-2xl bg-white text-sm font-semibold text-black shadow-2xl ring-1 ring-black/10">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-black/5"
            onClick={() => {
              setOpen(false);
              void onNotInterested();
            }}
          >
            <ThumbsDown className="size-4" />
            Not interested
          </button>
          <ReportContentButton
            label="Report reel"
            onTrigger={() => setOpen(false)}
            targetId={reel.id}
            targetLabel="reel"
            targetType="reel"
            triggerClassName="flex h-auto w-full justify-start rounded-none px-4 py-3 text-left text-sm font-semibold text-red-500 shadow-none hover:bg-red-50 hover:text-red-600"
            triggerVariant="ghost"
          />
        </div>
      ) : null}
    </div>
  );
}

function ReelActionButton({
  active,
  activeTone = "white",
  icon: Icon,
  label,
  onClick,
}: {
  active?: boolean;
  activeTone?: "gradient" | "heart" | "white";
  icon: LucideIcon;
  label: string;
  onClick: () => void | Promise<void>;
}) {
  const activeClass =
    activeTone === "heart"
      ? "fill-red-500 text-red-500"
      : activeTone === "gradient"
        ? "fill-[url(#homzie-action-gradient)] text-brand-violet drop-shadow-[0_0_8px_rgba(255,63,180,0.65)]"
        : "fill-white text-white";

  return (
    <button
      type="button"
      className="flex flex-col items-center gap-1 text-[11px] font-bold drop-shadow"
      onClick={(event) => {
        event.stopPropagation();
        void onClick();
      }}
    >
      <svg className="absolute size-0" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="homzie-action-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6d3cff" />
            <stop offset="100%" stopColor="#ff3fb4" />
          </linearGradient>
        </defs>
      </svg>
      <Icon className={cn("size-8", active && activeClass)} />
      {label}
    </button>
  );
}

function formatCommentCount(count: number) {
  if (count < 1000) return String(count);

  const compact = count / 1000;

  return `${Number.isInteger(compact) ? compact.toFixed(0) : compact.toFixed(1)}K`;
}

function ReelListingLinkCard({
  actionLabel,
  disabled,
  href,
  isSelected,
  listing,
  onAction,
  onSelect,
}: {
  actionLabel?: string;
  disabled?: boolean;
  href?: string;
  isSelected?: boolean;
  listing: ReelLinkedListing;
  onAction?: () => Promise<void> | void;
  onSelect?: () => void;
}) {
  const { formatPriceCents, formatPriceLabel } = useCurrency();
  const displayPrice =
    typeof listing.priceCents === "number"
      ? formatPriceCents(listing.priceCents)
      : formatPriceLabel(listing.priceLabel);
  const className = cn(
    "flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-white p-3 text-left text-black shadow-sm transition",
    isSelected && "border-primary ring-2 ring-primary/30",
  );
  const content = (
    <>
      <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-black/5">
        {listing.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Listing covers are local media URLs.
          <img
            src={listing.coverImageUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center bg-[var(--homzie-gradient)] text-white">
            <Link2 className="size-6" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{listing.title}</p>
          {isSelected ? (
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
              Linked
            </span>
          ) : null}
        </div>
        {listing.location ? (
          <p className="mt-1 truncate text-xs font-bold text-black/45">
            {listing.location}
          </p>
        ) : null}
        <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-black/60">
          {displayPrice ? <span>{displayPrice}</span> : null}
          <span className="rounded-full bg-black/5 px-2 py-1 capitalize">
            {listing.status}
          </span>
        </div>
      </div>
      {actionLabel && href ? (
        <Link
          href={href}
          aria-label={actionLabel}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-black text-white shadow-sm transition-transform hover:scale-105"
          onClick={async (event) => {
            event.stopPropagation();
            event.preventDefault();

            try {
              await onAction?.();
            } finally {
              window.location.href = href;
            }
          }}
        >
          <ChevronRight className="size-4 stroke-[3]" />
        </Link>
      ) : null}
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={onSelect}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function SheetShell({
  children,
  open,
  onClose,
}: {
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
}) {
  const [dragY, setDragY] = useState(0);
  const dragStartRef = useRef<number | null>(null);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/30"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="absolute inset-x-0 bottom-0 lg:left-1/2 lg:right-auto lg:w-[clamp(360px,calc(100dvh*9/16),520px)] lg:-translate-x-1/2">
        <div
          className="flex h-[70dvh] flex-col overflow-hidden rounded-t-[1.75rem] bg-white text-black shadow-2xl lg:max-h-[min(70dvh,calc(920px*0.72))]"
          style={{ transform: `translateY(${dragY}px)` }}
          onClick={(event) => event.stopPropagation()}
          onPointerMove={(event) => {
            if (dragStartRef.current === null) return;
            setDragY(Math.max(0, event.clientY - dragStartRef.current));
          }}
          onPointerUp={() => {
            if (dragY > 110) {
              onClose();
            }

            setDragY(0);
            dragStartRef.current = null;
          }}
        >
          <div
            className="mx-auto mt-2 h-1.5 w-12 shrink-0 touch-none rounded-full bg-black/10"
            onPointerDown={(event) => {
              dragStartRef.current = event.clientY;
            }}
          />
          {children}
        </div>
      </div>
    </div>
  );
}

function CommentAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  return (
    <div className="mt-0.5 size-10 shrink-0 overflow-hidden rounded-full bg-black text-sm font-semibold text-white">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Stored user avatars can be relative media URLs.
        <img src={avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center">
          {initialsFromName(name)}
        </span>
      )}
    </div>
  );
}

function ListingLinkSheet({
  linkedListingId,
  onClose,
  onLinkedListingChange,
  open,
  reel,
}: {
  linkedListingId: string | null;
  onClose: () => void;
  onLinkedListingChange: (listing: ReelLinkedListing | null) => void;
  open: boolean;
  reel: ReelFeedItem;
}) {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [listings, setListings] = useState<ReelOwnerListing[]>([]);

  useEffect(() => {
    if (!open) return;

    let isActive = true;
    const timeout = window.setTimeout(() => {
      setError("");
      setIsLoading(true);
      void getReelOwnerListings(reel.id)
        .then((result) => {
          if (!isActive) return;

          if (!result.ok) {
            setError(result.error || "We could not load your listings.");
            setListings([]);
            return;
          }

          setListings(result.listings);
          onLinkedListingChange(
            result.listings.find((listing) => listing.id === result.linkedListingId) ||
              null,
          );
        })
        .finally(() => {
          if (isActive) {
            setIsLoading(false);
          }
        });
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timeout);
    };
  }, [onLinkedListingChange, open, reel.id]);

  const selectListing = async (listingId: string | null) => {
    const previous =
      listings.find((listing) => listing.id === linkedListingId) || null;
    const nextListing =
      listings.find((listing) => listing.id === listingId) || null;

    setError("");
    setIsSaving(true);
    onLinkedListingChange(nextListing);

    const result = await linkReelListing({
      listingId,
      reelId: reel.id,
    });

    setIsSaving(false);

    if (!result.ok) {
      onLinkedListingChange(previous);
      setError(result.error || "We could not link that listing.");
      return;
    }

    onLinkedListingChange(result.linkedListing || null);
    onClose();
  };

  return (
    <SheetShell open={open} onClose={onClose}>
      <div className="flex h-14 shrink-0 items-center justify-center border-b border-black/5 px-4">
        <h2 className="text-lg font-semibold">Link listing</h2>
        <button
          type="button"
          className="absolute right-4 top-4 text-black"
          onClick={onClose}
          aria-label="Close listing link"
        >
          <X className="size-7" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <p className="text-sm font-semibold text-black/50">
          Choose one listed property to connect to this reel.
        </p>
        {error ? (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
            {error}
          </div>
        ) : null}
        {isLoading ? (
          <div className="mt-6 space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-2xl bg-black/5" />
            ))}
          </div>
        ) : listings.length ? (
          <div className="mt-5 space-y-3">
            {linkedListingId ? (
              <button
                type="button"
                className="flex w-full items-center justify-center rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                disabled={isSaving}
                onClick={() => void selectListing(null)}
              >
                Unlink current listing
              </button>
            ) : null}
            {listings.map((listing) => (
              <ReelListingLinkCard
                key={listing.id}
                disabled={isSaving}
                isSelected={linkedListingId === listing.id}
                listing={listing}
                onSelect={() => void selectListing(listing.id)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl bg-black/[0.04] p-6 text-center">
            <Link2 className="mx-auto size-10 text-black/35" />
            <h3 className="mt-4 text-lg font-semibold">No listings yet</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-black/45">
              Once you create listed properties, they will appear here so you can link one to this reel.
            </p>
          </div>
        )}
      </div>
    </SheetShell>
  );
}

function CommentRow({
  comment,
  isReply,
  onLike,
  onReply,
  onDislike,
  onDelete,
  onEdit,
}: {
  comment: ReelCommentItem;
  isReply?: boolean;
  onDelete: (comment: ReelCommentItem) => void;
  onDislike: (comment: ReelCommentItem) => void;
  onEdit: (comment: ReelCommentItem) => void;
  onLike: (comment: ReelCommentItem) => void;
  onReply: (comment: ReelCommentItem) => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className={cn("flex gap-3", isReply && "ml-12")}>
      <CommentAvatar name={comment.name} avatarUrl={comment.avatarUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-bold text-black/45">
            {comment.username ? `@${comment.username}` : comment.name}
          </p>
          {comment.isOwnComment ? (
            <div className="relative shrink-0">
              <button
                type="button"
                className="-mt-1 inline-flex size-7 items-center justify-center rounded-full hover:bg-black/5"
                onClick={() => setIsMenuOpen((value) => !value)}
                aria-label="Comment options"
              >
                <MoreHorizontal className="size-5" />
              </button>
              {isMenuOpen ? (
                <div className="absolute right-0 top-7 z-10 w-32 overflow-hidden rounded-xl bg-white text-sm font-semibold text-black shadow-xl ring-1 ring-black/10">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-black/5"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onEdit(comment);
                    }}
                  >
                    <Pencil className="size-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-500 hover:bg-red-50"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onDelete(comment);
                    }}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <RichCaption text={comment.body} className="mt-0.5 text-[15px] font-normal leading-snug text-black" />
        {comment.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- User supplied comment media is rendered as an inline attachment.
          <img
            src={comment.mediaUrl}
            alt=""
            className="mt-2 max-h-32 w-auto max-w-[min(13rem,100%)] rounded-lg object-contain"
          />
        ) : null}
        <div className="mt-2 flex items-center justify-between gap-4 text-sm font-bold text-black/40">
          <div className="flex min-w-0 items-center gap-5">
            <span>{comment.createdAtLabel}</span>
            <button type="button" onClick={() => onReply(comment)}>
              Reply
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <button
              type="button"
              className="flex items-center gap-1"
              onClick={() => onLike(comment)}
              aria-label="Like comment"
            >
              <Heart
                className={cn(
                  "size-6",
                  comment.likedByViewer && "fill-brand-pink text-brand-pink",
                )}
              />
              <span className="min-w-4 text-left text-sm font-bold">
                {comment.likeCountLabel}
              </span>
            </button>
            <button
              type="button"
              className="flex items-center gap-1"
              onClick={() => onDislike(comment)}
              aria-label="Dislike comment"
            >
              <ThumbsDown
                className={cn(
                  "size-6",
                  comment.dislikedByViewer && "fill-primary text-primary",
                )}
              />
              <span className="min-w-4 text-left text-sm font-bold">
                {comment.dislikeCountLabel}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentsSheet({
  commentLabel,
  onClose,
  onCommentCountChange,
  open,
  reel,
}: {
  commentLabel: string;
  onClose: () => void;
  onCommentCountChange: (value: string) => void;
  open: boolean;
  reel: ReelFeedItem;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [comments, setComments] = useState<ReelCommentItem[]>([]);
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaLabel, setMediaLabel] = useState("");
  const [expandedReplyIds, setExpandedReplyIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [editingComment, setEditingComment] = useState<ReelCommentItem | null>(null);
  const [replyTo, setReplyTo] = useState<ReelCommentItem | null>(null);
  const [picker, setPicker] = useState<"emoji" | "gif" | null>(null);
  const [emojiQuery, setEmojiQuery] = useState("");
  const [gifQuery, setGifQuery] = useState("");
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [recentGifs, setRecentGifs] = useState<{ label: string; url: string }[]>([]);
  const [mentionSuggestions, setMentionSuggestions] = useState<
    { name: string; username: string | null; avatarUrl: string | null }[]
  >([]);
  const emojiSuggestions = [
    { emoji: "😁", label: "grin smile happy" },
    { emoji: "🥰", label: "love hearts happy" },
    { emoji: "😂", label: "laugh crying funny" },
    { emoji: "😳", label: "shocked blush surprised" },
    { emoji: "😉", label: "wink playful" },
    { emoji: "😅", label: "sweat nervous laugh" },
    { emoji: "🥺", label: "cute pleading sad" },
    { emoji: "🔥", label: "fire hot amazing" },
    { emoji: "👏", label: "clap applause" },
    { emoji: "🏡", label: "home house property" },
    { emoji: "✨", label: "sparkles clean luxury" },
    { emoji: "🙌", label: "celebrate hands" },
    { emoji: "😍", label: "heart eyes love" },
    { emoji: "💯", label: "hundred perfect" },
    { emoji: "❤️", label: "heart love" },
    { emoji: "🤩", label: "star struck wow" },
    { emoji: "👌", label: "ok perfect" },
    { emoji: "💸", label: "money price" },
  ];
  const gifSuggestions = [
    {
      label: "Love it",
      tags: "love heart excited",
      url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExb2Z6Z2t4dGlrM2t6d3Nqb2hsZHV3cjJyOTd2emZyOTdpZmE5bGUwYiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/26FLdmIp6wJr91JAI/giphy.gif",
    },
    {
      label: "Amazing",
      tags: "amazing wow excited",
      url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdnJ3aDhlb25sbHZ4dGV4cHRnNmkzdGl0cWsyYTVyejQzbTNpM2JhZCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/xT9IgG50Fb7Mi0prBC/giphy.gif",
    },
    {
      label: "Wow",
      tags: "wow shocked surprised",
      url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcTFiNGNiNHQ5aWhrd3FycHJvcW83MWt2cHIzNWtzdzN0Zm9uN2IzYiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/5VKbvrjxpVJCM/giphy.gif",
    },
    {
      label: "Yes",
      tags: "yes celebrate agree",
      url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNjFtdzEzNHJtdGk1dGRnbGQ0ZnFyOWY4b3FwczNxeW9tbm9mcjNobyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3o7TKF1fSIs1R19B8k/giphy.gif",
    },
    {
      label: "Sold",
      tags: "sold property deal house",
      url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdm5sOGZpZDBncmZwNnYzbzZycTVndjlwbWl3aHZjNzQyMmFoaGM0YiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l0MYt5jPR6QX5pnqM/giphy.gif",
    },
    {
      label: "Take my money",
      tags: "money buy price",
      url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaHF2MTJodGVweDhxM2Zjdm0ybjZ6MnVwdjRpa3NveHh5ZDM4YXJkNSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3oKIPa2TdahY8LAAxy/giphy.gif",
    },
  ];
  const filteredEmojis = emojiSuggestions.filter((item) => {
    const query = emojiQuery.trim().toLowerCase();

    return !query || item.label.includes(query) || item.emoji.includes(query);
  });
  const filteredGifs = gifSuggestions.filter((gif) => {
    const query = gifQuery.trim().toLowerCase();

    return (
      !query ||
      gif.label.toLowerCase().includes(query) ||
      gif.tags.toLowerCase().includes(query)
    );
  });
  const mentionQuery = useMemo(() => {
    const match = body.match(/@([a-z0-9_]{1,24})$/i);

    return match?.[1] || "";
  }, [body]);

  useEffect(() => {
    if (!open) return;

    const timeout = window.setTimeout(() => {
      try {
        setRecentEmojis(
          JSON.parse(window.localStorage.getItem("homzie-recent-emojis") || "[]"),
        );
        setRecentGifs(
          JSON.parse(window.localStorage.getItem("homzie-recent-gifs") || "[]"),
        );
      } catch {
        setRecentEmojis([]);
        setRecentGifs([]);
      }
    }, 0);

    void getReelComments(reel.id).then((result) => {
      if (!result.ok) return;

      setComments(result.comments);
      onCommentCountChange(formatCommentCount(result.count));
    });

    return () => window.clearTimeout(timeout);
  }, [open, reel.id, onCommentCountChange]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!mentionQuery) {
        setMentionSuggestions([]);
        return;
      }

      void getReelMentionSuggestions(mentionQuery).then(setMentionSuggestions);
    }, mentionQuery ? 180 : 0);

    return () => window.clearTimeout(timeout);
  }, [mentionQuery]);

  const rootComments = comments.filter((comment) => !comment.parentId);
  const repliesByParent = new Map<string, ReelCommentItem[]>();

  comments
    .filter((comment) => comment.parentId)
    .forEach((comment) => {
      const parentId = comment.parentId || "";
      repliesByParent.set(parentId, [...(repliesByParent.get(parentId) || []), comment]);
    });

  const submitComment = async () => {
    const trimmed = body.trim();

    if (!trimmed && !mediaUrl) return;

    if (editingComment) {
      const result = await editReelComment({
        body: trimmed,
        commentId: editingComment.id,
        mediaUrl,
      });

      if (!result.ok) return;

      setComments(result.comments);
      onCommentCountChange(formatCommentCount(result.count));
      setBody("");
      setMediaUrl(null);
      setMediaLabel("");
      setEditingComment(null);
      setPicker(null);
      return;
    }

    const result = await createReelComment({
      body: trimmed,
      mediaUrl,
      parentId: replyTo?.id || null,
      reelId: reel.id,
    });

    if (!result.ok) return;

    setComments(result.comments);
    setExpandedReplyIds((current) => {
      if (!replyTo?.id) return current;

      const next = new Set(current);
      next.add(replyTo.id);

      return next;
    });
    onCommentCountChange(formatCommentCount(result.count));
    setBody("");
    setMediaUrl(null);
    setMediaLabel("");
    setReplyTo(null);
    setPicker(null);
  };

  const startEditingComment = (comment: ReelCommentItem) => {
    setEditingComment(comment);
    setReplyTo(null);
    setBody(comment.body);
    setMediaUrl(comment.mediaUrl);
    setMediaLabel(comment.mediaUrl ? "Current attachment" : "");
    setPicker(null);
  };

  const clearComposerContext = () => {
    setEditingComment(null);
    setReplyTo(null);
    setBody("");
    setMediaUrl(null);
    setMediaLabel("");
    setPicker(null);
  };

  const toggleLike = async (comment: ReelCommentItem) => {
    const result = await toggleReelCommentLike(comment.id);

    if (!result.ok) return;

    setComments((current) =>
      current.map((item) =>
        item.id === comment.id
          ? {
              ...item,
              dislikedByViewer: result.disliked,
              dislikeCount: result.dislikeCount,
              dislikeCountLabel: result.dislikeCountLabel,
              likedByViewer: result.liked,
              likeCount: result.count,
              likeCountLabel: result.countLabel,
            }
          : item,
      ),
    );
  };

  const toggleDislike = async (comment: ReelCommentItem) => {
    const result = await toggleReelCommentDislike(comment.id);

    if (!result.ok) return;

    setComments((current) =>
      current.map((item) =>
        item.id === comment.id
          ? {
              ...item,
              dislikedByViewer: result.disliked,
              dislikeCount: result.dislikeCount,
              dislikeCountLabel: result.dislikeCountLabel,
              likedByViewer: result.liked,
              likeCount: result.likeCount,
              likeCountLabel: result.likeCountLabel,
            }
          : item,
      ),
    );
  };

  const deleteComment = async (comment: ReelCommentItem) => {
    const result = await deleteReelComment(comment.id);

    if (!result.ok) return;

    setComments(result.comments);
    onCommentCountChange(formatCommentCount(result.count));
    setExpandedReplyIds((current) => {
      const next = new Set(current);
      next.delete(comment.id);

      return next;
    });
  };

  const attachImage = (file: File | null | undefined) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;

      setMediaUrl(reader.result);
      setMediaLabel(file.name);
      setPicker(null);
    };
    reader.readAsDataURL(file);
  };

  const rememberEmoji = (emoji: string) => {
    const next = [emoji, ...recentEmojis.filter((item) => item !== emoji)].slice(0, 14);

    setRecentEmojis(next);
    window.localStorage.setItem("homzie-recent-emojis", JSON.stringify(next));
  };

  const pickEmoji = (emoji: string) => {
    setBody((value) => `${value}${emoji}`);
    rememberEmoji(emoji);
  };

  const pickGif = (gif: { label: string; url: string }) => {
    const next = [gif, ...recentGifs.filter((item) => item.url !== gif.url)].slice(0, 8);

    setMediaUrl(gif.url);
    setMediaLabel(gif.label);
    setRecentGifs(next);
    window.localStorage.setItem("homzie-recent-gifs", JSON.stringify(next));
    setPicker(null);
  };

  return (
    <SheetShell open={open} onClose={onClose}>
      <div className="flex h-12 shrink-0 items-center justify-center border-b border-black/5 px-4">
        <h2 className="text-base font-semibold">{commentLabel} comments</h2>
        <button
          type="button"
          className="absolute right-4 top-4 text-black"
          onClick={onClose}
          aria-label="Close comments"
        >
          <X className="size-7" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {rootComments.length ? (
          <div className="space-y-6">
            {rootComments.map((comment) => {
              const replies = repliesByParent.get(comment.id) || [];
              const isExpanded = expandedReplyIds.has(comment.id);

              return (
                <div key={comment.id} className="space-y-3">
                  <CommentRow
                    comment={comment}
                    onDelete={deleteComment}
                    onDislike={toggleDislike}
                    onEdit={startEditingComment}
                    onLike={toggleLike}
                    onReply={setReplyTo}
                  />
                  {replies.length ? (
                    <button
                      type="button"
                      className="ml-[3.25rem] flex items-center gap-3 text-sm font-bold text-black/40"
                      onClick={() =>
                        setExpandedReplyIds((current) => {
                          const next = new Set(current);

                          if (next.has(comment.id)) {
                            next.delete(comment.id);
                          } else {
                            next.add(comment.id);
                          }

                          return next;
                        })
                      }
                    >
                      <span className="h-px w-9 bg-black/15" />
                      {isExpanded
                        ? "Hide replies"
                        : `View ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
                    </button>
                  ) : null}
                  {isExpanded
                    ? replies.map((reply) => (
                        <CommentRow
                          key={reply.id}
                          comment={reply}
                          isReply
                          onDelete={deleteComment}
                          onDislike={toggleDislike}
                          onEdit={startEditingComment}
                          onLike={toggleLike}
                          onReply={setReplyTo}
                        />
                      ))
                    : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid h-full place-items-center text-center text-black/45">
            <div>
              <MessageCircle className="mx-auto size-10" />
              <p className="mt-3 text-sm font-bold">No comments yet</p>
              <p className="mt-1 text-xs">Start the conversation.</p>
            </div>
          </div>
        )}
      </div>
      <div className="shrink-0 border-t border-black/10 bg-white px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
        {picker ? (
          <div className="mb-3 rounded-2xl bg-black/[0.04] p-3">
            <div className="mb-3 grid grid-cols-2 rounded-full bg-white p-1 text-sm font-semibold shadow-sm">
              <button
                type="button"
                className={cn(
                  "rounded-full py-2",
                  picker === "emoji" && "bg-black text-white",
                )}
                onClick={() => setPicker("emoji")}
              >
                Emoji
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-full py-2",
                  picker === "gif" && "bg-black text-white",
                )}
                onClick={() => setPicker("gif")}
              >
                GIFs
              </button>
            </div>
            {picker === "emoji" ? (
              <div className="space-y-3">
                <input
                  className="h-10 w-full rounded-full bg-white px-4 text-sm font-semibold outline-none placeholder:text-black/35"
                  placeholder="Search emojis"
                  value={emojiQuery}
                  onChange={(event) => setEmojiQuery(event.target.value)}
                />
                {recentEmojis.length ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-black/45">Recently used</p>
                    <div className="flex gap-1 overflow-x-auto pb-1 text-2xl">
                      {recentEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="grid size-10 shrink-0 place-items-center rounded-xl bg-white"
                          onClick={() => pickEmoji(emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="grid grid-cols-7 gap-1 text-2xl">
                  {filteredEmojis.map((item) => (
                    <button
                      key={item.emoji}
                      type="button"
                      className="grid size-10 place-items-center rounded-xl bg-white"
                      onClick={() => pickEmoji(item.emoji)}
                    >
                      {item.emoji}
                    </button>
                  ))}
                </div>
                {!filteredEmojis.length ? (
                  <p className="py-3 text-center text-xs font-bold text-black/45">
                    No emojis found.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  className="h-10 w-full rounded-full bg-white px-4 text-sm font-semibold outline-none placeholder:text-black/35"
                  placeholder="Search GIFs"
                  value={gifQuery}
                  onChange={(event) => setGifQuery(event.target.value)}
                />
                {recentGifs.length ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-black/45">Recently used</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {recentGifs.map((gif) => (
                        <button
                          key={gif.url}
                          type="button"
                          className="w-20 shrink-0 overflow-hidden rounded-xl bg-white text-left shadow-sm"
                          onClick={() => pickGif(gif)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- GIF picker thumbnails are remote GIF previews. */}
                          <img src={gif.url} alt="" className="aspect-square w-full object-cover" />
                          <span className="block truncate px-2 py-1 text-[10px] font-semibold">
                            {gif.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="grid grid-cols-4 gap-2">
                  {filteredGifs.map((gif) => (
                    <button
                      key={gif.url}
                      type="button"
                      className="overflow-hidden rounded-xl bg-white text-left shadow-sm"
                      onClick={() => pickGif(gif)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- GIF picker thumbnails are remote GIF previews. */}
                      <img src={gif.url} alt="" className="aspect-square w-full object-cover" />
                      <span className="block truncate px-2 py-1 text-[10px] font-semibold">
                        {gif.label}
                      </span>
                    </button>
                  ))}
                </div>
                {!filteredGifs.length ? (
                  <p className="py-3 text-center text-xs font-bold text-black/45">
                    No GIFs found.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
        {replyTo ? (
          <div className="mb-2 flex items-center justify-between rounded-full bg-black/5 px-3 py-2 text-xs font-bold text-black/50">
            Replying to @{replyTo.username || replyTo.name}
            <button type="button" onClick={() => setReplyTo(null)}>
              <X className="size-4" />
            </button>
          </div>
        ) : null}
        {editingComment ? (
          <div className="mb-2 flex items-center justify-between rounded-full bg-black/5 px-3 py-2 text-xs font-bold text-black/50">
            Editing comment
            <button type="button" onClick={clearComposerContext}>
              <X className="size-4" />
            </button>
          </div>
        ) : null}
        {mediaUrl ? (
          <div className="mb-2 flex items-end gap-2">
            <div className="relative size-20 overflow-hidden rounded-xl bg-black/5 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element -- Comment attachments can be local data URLs or selected GIF URLs. */}
              <img
                src={mediaUrl}
                alt={mediaLabel || "Comment attachment preview"}
                className="size-full object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-[9px] font-semibold text-white">
                {mediaLabel || "Attachment"}
              </span>
            </div>
            <button
              type="button"
              className="grid size-8 place-items-center rounded-full bg-black text-white shadow-sm"
              onClick={() => {
                setMediaUrl(null);
                setMediaLabel("");
              }}
              aria-label="Remove attachment"
            >
              <X className="size-4 stroke-[3]" />
            </button>
          </div>
        ) : null}
        {mentionSuggestions.length && mentionQuery ? (
          <div className="mb-2 flex gap-2 overflow-x-auto">
            {mentionSuggestions.map((user) => (
              <button
                key={user.username || user.name}
                type="button"
                className="flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-xs font-bold text-white"
                onClick={() => {
                  setBody((value) => value.replace(/@[a-z0-9_]{1,24}$/i, `@${user.username} `));
                  setMentionSuggestions([]);
                }}
              >
                <span className="grid size-5 place-items-center overflow-hidden rounded-full bg-white/15">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Mention avatars are small inline suggestions.
                    <img src={user.avatarUrl} alt="" className="size-full object-cover" />
                  ) : (
                    initialsFromName(user.name)
                  )}
                </span>
                @{user.username}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-black text-sm font-semibold text-white">
            {initialsFromName(reel.agentName)}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.gif"
            className="hidden"
            onChange={(event) => {
              attachImage(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-black/5 px-4 py-2">
            <input
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-black/35"
              placeholder={editingComment ? "Edit comment..." : "Add comment..."}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitComment();
                }
              }}
            />
            <button
              type="button"
              aria-label="Attach image"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="size-6" />
            </button>
            <button
              type="button"
              aria-label="Open emoji and GIF picker"
              onClick={() =>
                setPicker((value) => (value === "emoji" ? "gif" : "emoji"))
              }
            >
              <Smile className="size-6" />
            </button>
            <button type="button" aria-label="Mention user" onClick={() => setBody((value) => `${value}@`)}>
              <AtSign className="size-6" />
            </button>
          </div>
          <button
            type="button"
            className="grid size-11 shrink-0 place-items-center rounded-full [background:var(--homzie-gradient)] text-white shadow-lg shadow-primary/25 transition-opacity disabled:opacity-40"
            disabled={!body.trim() && !mediaUrl}
            onClick={() => void submitComment()}
            aria-label="Post comment"
          >
            <Send className="size-5" />
          </button>
        </div>
      </div>
    </SheetShell>
  );
}

function ShareSheet({
  onClose,
  onShare,
  open,
  reel,
}: {
  onClose: () => void;
  onShare?: () => void;
  open: boolean;
  reel: ReelFeedItem;
}) {
  const reelUrl =
    typeof window === "undefined"
      ? buildReelPath(reel.id)
      : `${window.location.origin}${buildReelPath(reel.id)}`;
  const encodedUrl = encodeURIComponent(reelUrl);
  const text = encodeURIComponent(`Watch @${reel.agentUsername}'s Homzie reel`);
  const shareTargets = [
    {
      brand: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${text}%20${encodedUrl}`,
    },
    {
      brand: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    { brand: "sms", label: "SMS", href: `sms:?&body=${text}%20${encodedUrl}` },
    {
      brand: "email",
      label: "Email",
      href: `mailto:?subject=Homzie reel&body=${text}%20${encodedUrl}`,
    },
  ];

  const copyLink = async () => {
    await navigator.clipboard.writeText(reelUrl);
    onShare?.();
    onClose();
  };

  const nativeShare = async () => {
    if (!navigator.share) {
      await copyLink();
      return;
    }

    await navigator.share({
      text: `Watch @${reel.agentUsername}'s Homzie reel`,
      title: "Homzie reel",
      url: reelUrl,
    });
    onShare?.();
    onClose();
  };

  return (
    <SheetShell open={open} onClose={onClose}>
      <div className="flex h-14 shrink-0 items-center justify-center border-b border-black/5 px-4">
        <h2 className="text-lg font-semibold">Share reel</h2>
        <button
          type="button"
          className="absolute right-4 top-4 text-black"
          onClick={onClose}
          aria-label="Close share options"
        >
          <X className="size-7" />
        </button>
      </div>
      <div className="space-y-4 p-5">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-2xl bg-black px-5 py-4 text-left font-semibold text-white"
          onClick={() => void nativeShare()}
        >
          Share with device
          <Share2 className="size-5" />
        </button>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-2xl bg-black/5 px-5 py-4 text-left font-semibold"
          onClick={() => void copyLink()}
        >
          Copy link
          <Copy className="size-5" />
        </button>
        <div className="grid grid-cols-4 gap-3 pt-2">
          {shareTargets.map((target) => (
            <a
              key={target.label}
              href={target.href}
              className="flex flex-col items-center gap-2 rounded-2xl bg-black/5 p-3 text-xs font-bold"
              target={target.href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              onClick={onShare}
            >
              <span className="grid size-11 place-items-center rounded-full bg-white shadow-sm">
                <ShareBrandIcon brand={target.brand} />
              </span>
              {target.label}
            </a>
          ))}
        </div>
      </div>
    </SheetShell>
  );
}

function ShareBrandIcon({ brand }: { brand: string }) {
  if (brand === "whatsapp") {
    return (
      <svg className="size-7" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#25D366" />
        <path
          fill="#fff"
          d="M16.1 7.1a8.7 8.7 0 0 0-7.4 13.3L7.7 25l4.8-1.2a8.7 8.7 0 1 0 3.6-15.7Zm0 1.6a7.1 7.1 0 0 1 6.1 10.8 7.1 7.1 0 0 1-8.3 2.8l-.3-.1-2.8.7.8-2.7-.2-.3a7.1 7.1 0 0 1 4.7-11.2Zm-3 3.7c-.2 0-.5.1-.7.4-.2.3-.9.9-.9 2.1 0 1.3.9 2.5 1 2.7.2.2 1.8 2.8 4.4 3.8 2.2.9 2.6.7 3.1.7.5 0 1.6-.7 1.8-1.3.2-.6.2-1.1.1-1.3-.1-.1-.2-.2-.5-.4l-1.8-.9c-.3-.1-.5-.1-.7.2l-.8 1c-.1.2-.3.2-.6.1-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.6-1.5-1.9-.2-.3 0-.4.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.8-1.9c-.2-.4-.4-.4-.6-.4Z"
        />
      </svg>
    );
  }

  if (brand === "facebook") {
    return (
      <svg className="size-7" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#1877F2" />
        <path
          fill="#fff"
          d="M18.3 27V17h3.1l.5-3.9h-3.6v-2.5c0-1.1.3-1.9 1.9-1.9H22V5.2c-.4-.1-1.7-.2-3.2-.2-3.2 0-5.4 2-5.4 5.5v3.1H10V17h3.4v10h4.9Z"
        />
      </svg>
    );
  }

  if (brand === "sms") {
    return (
      <span className="grid size-7 place-items-center rounded-full bg-[#34C759] text-[9px] font-semibold text-white">
        SMS
      </span>
    );
  }

  return <Mail className="size-6 text-black" />;
}

export function ReelsFeed({
  preferredReelId,
  reels,
  scope,
}: {
  preferredReelId?: string | null;
  reels: ReelFeedItem[];
  scope: string;
}) {
  const [hiddenReelIds, setHiddenReelIds] = useState<Set<string>>(() =>
    readHiddenReelIds(),
  );
  const orderedReels = useMemo(
    () => orderReelsForSession(reels, scope, preferredReelId, hiddenReelIds),
    [hiddenReelIds, preferredReelId, reels, scope],
  );
  const feedRef = useRef<HTMLElement | null>(null);
  const [activeReelId, setActiveReelId] = useState(orderedReels[0]?.id || "");
  const [isOwnerMenuOpen, setIsOwnerMenuOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const lastSyncedUrlRef = useRef("");
  const feedTitle = useMemo(
    () => (scope === "global" ? "For You" : `@${scope}`),
    [scope],
  );
  const activeReel =
    orderedReels.find((reel) => reel.id === activeReelId) || orderedReels[0];
  const handleActiveReelChange = (reelId: string) => {
    setActiveReelId((currentReelId) => {
      if (currentReelId === reelId) return currentReelId;

      setIsOwnerMenuOpen(false);
      return reelId;
    });
  };

  useEffect(() => {
    if (!activeReelId || typeof window === "undefined") return;

    const nextPath = buildReelPath(activeReelId);

    if (window.location.pathname === nextPath) return;
    if (lastSyncedUrlRef.current === nextPath) return;

    lastSyncedUrlRef.current = nextPath;
    window.history.replaceState(window.history.state, "", nextPath);
  }, [activeReelId]);

  const hideActiveReel = async () => {
    if (!activeReel) return;

    const reelId = activeReel.id;
    const nextActiveReelId =
      orderedReels.find((reel) => reel.id !== reelId)?.id || "";

    rememberHiddenReel(reelId, "not_interested");
    setHiddenReelIds((currentIds) => new Set([...currentIds, reelId]));
    setActiveReelId(nextActiveReelId);

    await recordReelFeedback({
      feedbackType: "not_interested",
      reelId,
      source: scope === "global" ? "global-feed" : "profile-feed",
      viewerSessionId: getViewerSessionId(),
    });
  };

  useEffect(() => {
    function scrollToSiblingReel(direction: 1 | -1) {
      const feed = feedRef.current;

      if (!feed) return;

      const cards = Array.from(
        feed.querySelectorAll<HTMLElement>("[data-reel-card]"),
      );

      if (!cards.length) return;

      const currentTop = feed.scrollTop;
      const currentIndex = cards.reduce((closestIndex, card, index) => {
        const closestDistance = Math.abs(cards[closestIndex].offsetTop - currentTop);
        const nextDistance = Math.abs(card.offsetTop - currentTop);

        return nextDistance < closestDistance ? index : closestIndex;
      }, 0);
      const nextIndex = Math.min(
        Math.max(currentIndex + direction, 0),
        cards.length - 1,
      );

      feed.scrollTo({ behavior: "smooth", top: cards[nextIndex].offsetTop });
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

      const target = event.target as HTMLElement | null;

      if (
        target?.closest("input, textarea, select, button, [contenteditable='true']")
      ) {
        return;
      }

      event.preventDefault();
      scrollToSiblingReel(event.key === "ArrowDown" ? 1 : -1);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (orderedReels.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-brand-black p-6 text-center text-white">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">
            Homzie Reels
          </p>
          <h1 className="mt-4 text-3xl font-bold">No reels yet</h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">
            Property reels will appear here once agents begin publishing video.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      ref={feedRef}
      className="h-dvh overflow-y-auto snap-y snap-mandatory bg-black text-white lg:[--reel-ui-scale:min(1,max(0.78,calc(100dvh/820px)))]"
    >
      <header className="fixed left-0 right-0 top-0 z-30 mx-auto flex h-14 items-center justify-between bg-black/10 px-4 pt-[env(safe-area-inset-top)] text-white backdrop-blur-[2px] lg:h-[calc(3.5rem*var(--reel-ui-scale))] lg:w-[clamp(360px,calc(100dvh*9/16),520px)] lg:rounded-b-2xl lg:px-[calc(1rem*var(--reel-ui-scale))] lg:pt-[calc(env(safe-area-inset-top)*var(--reel-ui-scale))]">
        <BackButton
          className="flex size-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur"
          iconClassName="size-6"
          label="Back"
          showLabel={false}
        />
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center text-sm font-bold">
          <span className="border-b-2 border-primary pb-2">{feedTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          {activeReel?.isOwnAgent ? (
            <OwnerReelMenu
              open={isOwnerMenuOpen}
              reelId={activeReel.id}
              onOpenChange={setIsOwnerMenuOpen}
            />
          ) : activeReel ? (
            <ViewerReelMenu reel={activeReel} onNotInterested={hideActiveReel} />
          ) : null}
          <button
            type="button"
            aria-label={isMuted ? "Unmute reels" : "Mute reels"}
            className="flex size-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur"
            onClick={() => setIsMuted((value) => !value)}
          >
            {isMuted ? (
              <VolumeX className="size-5" />
            ) : (
              <Volume2 className="size-5" />
            )}
          </button>
        </div>
      </header>

      <div className="lg:grid lg:justify-center">
        {orderedReels.map((reel) => (
          <ReelCard
            key={reel.id}
            isMuted={isMuted}
            onVisible={handleActiveReelChange}
            reel={reel}
            scope={scope}
          />
        ))}
      </div>
    </main>
  );
}
