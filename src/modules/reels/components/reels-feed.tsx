"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  Volume2,
  VolumeX,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { BackButton } from "@/components/back-button";
import { RichCaption } from "./rich-caption";

export type ReelFeedItem = {
  id: string;
  agentName: string;
  agentUsername: string;
  title: string;
  location: string;
  price?: string;
  beds?: string;
  baths?: string;
  size?: string;
  likes: string;
  comments: string;
  shares: string;
  colorA?: string;
  colorB?: string;
  listingId?: string;
  videoUrl?: string;
  posterUrl?: string;
};

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function orderReelsForSession(reels: ReelFeedItem[], scope: string) {
  if (typeof window === "undefined") {
    return reels;
  }

  const storageKey = `homzie-seen-reels:${scope}`;
  const seenIds = new Set(
    JSON.parse(window.sessionStorage.getItem(storageKey) || "[]") as string[],
  );
  const unseen = reels.filter((reel) => !seenIds.has(reel.id));
  const seen = reels.filter((reel) => seenIds.has(reel.id));
  const ordered = [...unseen, ...seen];

  return ordered;
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

function ReelCard({ reel, scope }: { reel: ReelFeedItem; scope: string }) {
  const cardRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captionRef = useRef<HTMLDivElement | null>(null);
  const [hasLongCaption, setHasLongCaption] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

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

  const seekVideo = (value: number) => {
    const video = videoRef.current;

    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      return;
    }

    const nextProgress = Math.min(1, Math.max(0, value));
    video.currentTime = nextProgress * video.duration;
    setProgress(nextProgress);
  };

  useEffect(() => {
    const element = cardRef.current;

    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          rememberWatchedReel(scope, reel.id);
        }
      },
      { threshold: 0.65 },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [reel.id, scope]);

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
  }, [reel.id]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    const updateProgress = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        setProgress(0);
        return;
      }

      setProgress(Math.min(1, Math.max(0, video.currentTime / video.duration)));
    };

    video.addEventListener("timeupdate", updateProgress);
    video.addEventListener("loadedmetadata", updateProgress);
    video.addEventListener("durationchange", updateProgress);

    return () => {
      video.removeEventListener("timeupdate", updateProgress);
      video.removeEventListener("loadedmetadata", updateProgress);
      video.removeEventListener("durationchange", updateProgress);
    };
  }, [reel.id]);

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

  return (
    <section
      ref={cardRef}
      className="relative h-dvh snap-start overflow-hidden bg-black text-white"
      onClick={togglePlayback}
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

      {!isPlaying ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="grid size-20 place-items-center rounded-full bg-black/35 text-white shadow-2xl backdrop-blur">
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
          onChange={(event) => seekVideo(Number(event.target.value) / 1000)}
          style={{
            background: `linear-gradient(90deg, #6d3cff 0%, #ff3fb4 ${progress * 100}%, rgba(255,255,255,0.32) ${progress * 100}%, rgba(255,255,255,0.32) 100%)`,
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-1 bg-white/30">
        <div
          className="h-full rounded-r-full bg-[var(--homzie-gradient)] shadow-[0_0_8px_rgba(255,63,180,0.75)] transition-[width] duration-100 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <button
        type="button"
        aria-label={isMuted ? "Unmute reel" : "Mute reel"}
        className="absolute right-4 top-[calc(env(safe-area-inset-top)+4.75rem)] z-20 flex size-10 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur"
        onClick={(event) => {
          event.stopPropagation();
          setIsMuted((value) => !value);
        }}
      >
        {isMuted ? (
          <VolumeX className="size-5" />
        ) : (
          <Volume2 className="size-5" />
        )}
      </button>

      <aside className="absolute bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] right-3 z-20 flex flex-col items-center gap-4 text-white">
        <Link
          href={`/users/${reel.agentUsername}`}
          className="relative flex size-12 items-center justify-center rounded-full border-2 border-white bg-[var(--homzie-gradient)] text-sm font-black shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          {initialsFromName(reel.agentName)}
          <span className="absolute -bottom-1 flex size-5 items-center justify-center rounded-full bg-brand-pink text-base leading-none">
            +
          </span>
        </Link>

        {[
          { icon: Heart, label: reel.likes, fill: true },
          { icon: MessageCircle, label: reel.comments },
          { icon: Share2, label: reel.shares },
          { icon: Bookmark, label: "Save" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              className="flex flex-col items-center gap-1 text-[11px] font-bold drop-shadow"
              onClick={(event) => event.stopPropagation()}
            >
              <Icon className={cn("size-8", item.fill && "fill-white")} />
              {item.label}
            </button>
          );
        })}
      </aside>

      <div
        className="absolute bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] left-3 right-20 z-20 rounded-lg bg-black/10 p-3 text-white shadow-lg drop-shadow backdrop-blur-[2px]"
        onClick={(event) => event.stopPropagation()}
      >
        <Link
          href={`/users/${reel.agentUsername}`}
          className="text-sm font-bold"
        >
          @{reel.agentUsername}
        </Link>
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
        {reel.price || reel.beds || reel.baths || reel.size ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-white/90">
            {reel.price ? <span>{reel.price}</span> : null}
            {reel.beds ? <span>{reel.beds} beds</span> : null}
            {reel.baths ? <span>{reel.baths} baths</span> : null}
            {reel.size ? <span>{reel.size}</span> : null}
          </div>
        ) : null}
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-white/90">
          <Send className="size-4" />
          Original sound
        </div>
      </div>
    </section>
  );
}

export function ReelsFeed({
  reels,
  scope,
}: {
  reels: ReelFeedItem[];
  scope: string;
}) {
  const orderedReels = useMemo(
    () => orderReelsForSession(reels, scope),
    [reels, scope],
  );
  const feedTitle = useMemo(
    () => (scope === "global" ? "For You" : `@${scope}`),
    [scope],
  );

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
    <main className="h-dvh overflow-y-auto snap-y snap-mandatory bg-black text-white">
      <header className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between bg-black/10 px-4 pt-[env(safe-area-inset-top)] text-white backdrop-blur-[2px]">
        <BackButton
          className="flex size-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur"
          iconClassName="size-6"
          label="Back"
          showLabel={false}
        />
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-5 text-sm font-bold">
          <span className="border-b-2 border-primary pb-2">{feedTitle}</span>
          <Link href="/reels" className="pb-2 text-white/70">
            Following
          </Link>
        </div>
        <button
          type="button"
          className="flex size-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur"
          aria-label="More reel options"
        >
          <MoreHorizontal className="size-5" />
        </button>
      </header>

      <div>
        {orderedReels.map((reel) => (
          <ReelCard key={reel.id} reel={reel} scope={scope} />
        ))}
      </div>
    </main>
  );
}
