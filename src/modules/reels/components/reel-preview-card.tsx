"use client";

import Link from "next/link";
import { Clock3, PlayCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export type ReelPreviewCardData = {
  coverUrl?: string | null;
  durationLabel?: string;
  href: string;
  id: string;
  status?: "draft" | "failed" | "processing" | "published";
  title?: string | null;
  username?: string | null;
  viewCountLabel?: string;
  watched?: boolean;
};

export function ReelPreviewCard({ reel }: { reel: ReelPreviewCardData }) {
  return (
    <Link
      href={reel.href}
      draggable={false}
      className="group relative isolate block aspect-[3/4] min-w-0 overflow-hidden rounded-lg bg-brand-midnight text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
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

      {reel.status === "draft" ? (
        <div className="absolute left-2 top-2 z-20 grid size-7 place-items-center rounded-full bg-black/55 text-white shadow-sm backdrop-blur">
          <Clock3 className="size-3.5" />
        </div>
      ) : null}

      {reel.status === "processing" || reel.status === "failed" ? (
        <span
          className={cn(
            "absolute left-2 top-2 z-20 rounded-full px-2 py-1 text-[9px] font-black uppercase shadow-sm backdrop-blur",
            reel.status === "processing"
              ? "bg-violet-100/95 text-violet-700"
              : "bg-red-100/95 text-red-700",
          )}
        >
          {reel.status === "processing" ? "Processing" : "Failed"}
        </span>
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
    </Link>
  );
}
