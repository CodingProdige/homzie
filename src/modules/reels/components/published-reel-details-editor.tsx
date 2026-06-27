"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ArrowLeft,
  AtSign,
  Check,
  ChevronDown,
  Clapperboard,
  Globe2,
  Hash,
  Loader2,
  MapPin,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteReel, updatePublishedReelDetails } from "@/modules/reels/actions";
import {
  ReelCaptionSuggestions,
  ReelLocationPanel,
} from "@/modules/reels/components/reel-mvp-editor";

const maxReelCaptionLength = 1000;

type ReelPostOptions = {
  aiGenerated: boolean;
  allowComments: boolean;
  allowReuse: boolean;
  autoCheckSound: boolean;
};

type ReelCoverFrame = {
  clipId: string;
  src: string;
  time: number;
};

export type PublishedReelDetailsDraft = {
  caption: string;
  coverFrame: ReelCoverFrame | null;
  frames: ReelCoverFrame[];
  location: string;
  options: ReelPostOptions;
  privacy: string;
  profilePath: string;
  reelId: string;
  videoUrl: string;
};

function waitForVideoEvent(
  video: HTMLVideoElement,
  eventName: "loadedmetadata" | "seeked",
  timeoutMs = 8000,
) {
  return new Promise<boolean>((resolve) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    function cleanup() {
      window.clearTimeout(timeoutId);
      video.removeEventListener(eventName, handleSuccess);
      video.removeEventListener("error", handleError);
    }

    function handleSuccess() {
      cleanup();
      resolve(true);
    }

    function handleError() {
      cleanup();
      resolve(false);
    }

    video.addEventListener(eventName, handleSuccess, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });
}

async function capturePublishedCoverFrames(videoUrl: string, clipId: string) {
  const video = document.createElement("video");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) return [];

  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = videoUrl;

  const loaded = await waitForVideoEvent(video, "loadedmetadata");
  const duration = Number.isFinite(video.duration) ? video.duration : 0;

  if (!loaded || duration <= 0) return [];

  canvas.width = 120;
  canvas.height = 180;

  const frameTimes = Array.from({ length: 6 }, (_, index) =>
    Math.min(duration - 0.05, (duration / 5) * index),
  ).filter((time) => time >= 0);
  const frames: ReelCoverFrame[] = [];

  for (const time of frameTimes) {
    video.currentTime = time;
    const didSeek = await waitForVideoEvent(video, "seeked");

    if (!didSeek) continue;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push({
      clipId,
      src: canvas.toDataURL("image/jpeg", 0.72),
      time,
    });
  }

  return frames;
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function PostRow({
  expanded,
  icon: Icon,
  label,
  onClick,
  value,
}: {
  expanded: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  value?: string;
}) {
  return (
    <button
      type="button"
      className="flex min-h-16 w-full items-center gap-3 py-4 text-left"
      onClick={onClick}
    >
      <Icon className="size-6 shrink-0 text-black/65" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold">{label}</span>
        {value ? (
          <span className="mt-0.5 block truncate text-sm font-bold text-black/40">
            {value}
          </span>
        ) : null}
      </span>
      <ChevronDown
        className={`size-5 shrink-0 text-black/35 transition-transform ${
          expanded ? "rotate-180" : ""
        }`}
      />
    </button>
  );
}

export function PublishedReelDetailsEditor({
  draft,
}: {
  draft: PublishedReelDetailsDraft;
}) {
  const router = useRouter();
  const [caption, setCaption] = useState(draft.caption);
  const [coverFrame, setCoverFrame] = useState(draft.coverFrame);
  const [coverFrames, setCoverFrames] = useState(draft.frames);
  const [location, setLocation] = useState(draft.location);
  const [privacy, setPrivacy] = useState(draft.privacy);
  const [options, setOptions] = useState<ReelPostOptions>(draft.options);
  const [expandedRow, setExpandedRow] = useState<
    "cover" | "details" | "location" | "privacy" | "options" | null
  >(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [isGeneratingCoverFrames, setIsGeneratingCoverFrames] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const coverFrameTime = coverFrame?.time || 0;

  useEffect(() => {
    if (coverFrames.length || !draft.videoUrl) return;

    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      setIsGeneratingCoverFrames(true);

      void capturePublishedCoverFrames(draft.videoUrl, draft.reelId)
        .then((frames) => {
          if (!isActive) return;

          setCoverFrames(frames);
          setCoverFrame((current) => current || frames[0] || null);
        })
        .finally(() => {
          if (isActive) {
            setIsGeneratingCoverFrames(false);
          }
        });
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [coverFrames.length, draft.reelId, draft.videoUrl]);

  function appendToken(prefix: "#" | "@") {
    const needsSpace = caption.length > 0 && !/\s$/.test(caption);
    setCaption(`${caption}${needsSpace ? " " : ""}${prefix}`);
  }

  function toggleExpandedRow(
    row: "cover" | "details" | "location" | "privacy" | "options",
  ) {
    setExpandedRow((current) => (current === row ? null : row));
  }

  function saveDetails() {
    setError("");
    setSaved(false);

    startTransition(async () => {
      const result = await updatePublishedReelDetails({
        caption,
        coverFrame,
        location,
        options,
        privacy,
        reelId: draft.reelId,
      });

      if (!result.ok) {
        setError(result.error || "Could not update this reel.");
        return;
      }

      setSaved(true);
      router.refresh();
    });
  }

  return (
    <main className="min-h-dvh bg-black text-black">
      <div className="mx-auto min-h-dvh max-w-[430px] bg-white">
        <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center px-4">
          <Button asChild variant="ghost" className="-ml-3 text-black hover:bg-black/5">
            <Link href={draft.profilePath}>
              <ArrowLeft className="size-7" />
            </Link>
          </Button>
          <p className="text-sm font-semibold">Edit details</p>
          <span />
        </div>

        <div className="px-5 pb-8">
          <div className="flex gap-4">
            <textarea
              className="min-h-36 flex-1 resize-none text-xl outline-none placeholder:text-black/30"
              maxLength={maxReelCaptionLength}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Add description..."
              value={caption}
            />
            <button
              className="relative h-40 w-28 shrink-0 overflow-hidden rounded-2xl bg-black/10"
              onClick={() => toggleExpandedRow("cover")}
              type="button"
            >
              {coverFrame ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- Cover frames are canvas data URLs from the reel editor. */}
                  <img
                    alt=""
                    className="size-full object-cover"
                    src={coverFrame.src}
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 py-2 text-sm font-semibold text-white">
                    Edit cover
                  </span>
                </>
              ) : (
                <span className="grid size-full place-items-center text-xs font-semibold text-black/35">
                  No cover
                </span>
              )}
            </button>
          </div>
          <div className="mt-2 text-right text-xs font-bold text-black/35">
            {caption.length}/{maxReelCaptionLength}
          </div>
          <div className="mt-5 flex gap-2">
            <button
              className="inline-flex items-center gap-1 rounded-lg bg-black/5 px-3 py-2 text-base font-semibold"
              onClick={() => appendToken("#")}
              type="button"
            >
              <Hash className="size-4" />
              Hashtags
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-lg bg-black/5 px-3 py-2 text-base font-semibold"
              onClick={() => appendToken("@")}
              type="button"
            >
              <AtSign className="size-4" />
              Mention
            </button>
          </div>
          <ReelCaptionSuggestions
            caption={caption}
            onCaptionChange={setCaption}
          />

          <div className="mt-8 divide-y divide-black/10">
            <div>
              <PostRow
                expanded={expandedRow === "location"}
                icon={MapPin}
                label="Location"
                onClick={() => toggleExpandedRow("location")}
                value={location || "Add"}
              />
              {expandedRow === "location" ? (
                <ReelLocationPanel
                  onSelect={setLocation}
                  selectedLocation={location}
                />
              ) : null}
            </div>
            <div>
              <PostRow
                expanded={expandedRow === "privacy"}
                icon={Globe2}
                label={`${privacy} can view this post`}
                onClick={() => toggleExpandedRow("privacy")}
              />
              {expandedRow === "privacy" ? (
                <div className="grid gap-2 pb-4">
                  {["Everyone", "Followers", "Only me"].map((option) => (
                    <button
                      key={option}
                      className="flex h-11 items-center justify-between rounded-xl bg-black/5 px-4 text-sm font-semibold"
                      onClick={() => setPrivacy(option)}
                      type="button"
                    >
                      {option}
                      {privacy === option ? <Check className="size-4" /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div>
              <PostRow
                expanded={expandedRow === "cover"}
                icon={Clapperboard}
                label="Cover"
                onClick={() => toggleExpandedRow("cover")}
                value={formatTime(coverFrameTime)}
              />
              {expandedRow === "cover" ? (
                <div className="grid grid-cols-3 gap-2 pb-4">
                  {coverFrames.map((frame) => (
                    <button
                      key={`${frame.clipId}-${frame.time}`}
                      className="relative aspect-[9/14] overflow-hidden rounded-xl bg-black/10"
                      onClick={() => setCoverFrame(frame)}
                      type="button"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- Cover frames are canvas data URLs from the reel editor. */}
                      <img alt="" className="size-full object-cover" src={frame.src} />
                      {coverFrame?.src === frame.src ? (
                        <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-[var(--homzie-gradient)] text-white">
                          <Check className="size-3.5" />
                        </span>
                      ) : null}
                    </button>
                  ))}
                  {isGeneratingCoverFrames ? (
                    <p className="col-span-3 rounded-xl bg-black/5 px-4 py-3 text-sm font-bold text-black/45">
                      Generating cover frames...
                    </p>
                  ) : null}
                  {!coverFrames.length && !isGeneratingCoverFrames ? (
                    <p className="col-span-3 rounded-xl bg-black/5 px-4 py-3 text-sm font-bold text-black/45">
                      We could not generate alternate cover frames for this reel.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div>
              <PostRow
                expanded={expandedRow === "details"}
                icon={Clapperboard}
                label="Reel details"
                onClick={() => toggleExpandedRow("details")}
                value="Published"
              />
              {expandedRow === "details" ? (
                <p className="pb-4 text-sm font-bold leading-6 text-black/45">
                  This reel has already been published, so the video, clips, trimming,
                  audio and timeline are locked. Only the reel metadata can be updated.
                </p>
              ) : null}
            </div>
            <div>
              <PostRow
                expanded={expandedRow === "options"}
                icon={Settings2}
                label="More options"
                onClick={() => toggleExpandedRow("options")}
              />
              {expandedRow === "options" ? (
                <div className="grid gap-2 pb-4">
                  {[
                    ["allowComments", "Allow comments"],
                    ["allowReuse", "Allow reuse"],
                    ["autoCheckSound", "Auto-check sound"],
                    ["aiGenerated", "AI-generated content"],
                  ].map(([key, label]) => (
                    <label
                      key={key}
                      className="flex min-h-11 items-center justify-between rounded-xl bg-black/5 px-4 text-sm font-semibold"
                    >
                      {label}
                      <input
                        checked={Boolean(options[key as keyof ReelPostOptions])}
                        onChange={(event) =>
                          setOptions((current) => ({
                            ...current,
                            [key]: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">
              {error}
            </div>
          ) : null}
          {saved ? (
            <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-600">
              Reel details updated.
            </div>
          ) : null}

          <div className="mt-8 grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="lg"
              disabled={isPending}
              onClick={() => router.replace(draft.profilePath)}
              type="button"
            >
              Cancel
            </Button>
            <Button
              size="lg"
              disabled={isPending}
              onClick={saveDetails}
              type="button"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save
            </Button>
          </div>
          <Dialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                className="mx-auto mt-5 flex items-center justify-center gap-2 text-sm font-semibold text-red-500 transition-colors hover:text-red-600"
              >
                <Trash2 className="size-4" />
                Delete reel
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
              <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-5 text-foreground shadow-2xl outline-none">
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
                    <input type="hidden" name="reelId" value={draft.reelId} />
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
      </div>
    </main>
  );
}
