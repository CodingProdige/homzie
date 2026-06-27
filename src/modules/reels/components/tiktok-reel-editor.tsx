"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowLeft,
  Captions,
  Check,
  ChevronRight,
  Clapperboard,
  Hash,
  ImageIcon,
  Layers,
  Loader2,
  Maximize2,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Send,
  Settings,
  SlidersHorizontal,
  Type,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TikTokReelEditorProps = {
  profilePath: string;
};

type Stage = "upload" | "edit" | "timeline" | "post";
type PreviewMode = "contain" | "cover" | "fill";
type EditorSheet =
  | "text"
  | "captions"
  | "edit"
  | "adjust"
  | "cover"
  | "settings"
  | null;

type Sound = {
  id: string;
  title: string;
  artist: string;
};

type CoverFrame = {
  src: string;
  time: number;
};

const sounds: Sound[] = [
  { id: "original", title: "Original audio", artist: "Homzie" },
  { id: "none", title: "No music", artist: "Muted" },
  { id: "dance_harder", title: "Dance Harder", artist: "IMG.LY library" },
  { id: "far_from_home", title: "Far From Home", artist: "IMG.LY library" },
  { id: "elsewhere", title: "Elsewhere", artist: "IMG.LY library" },
];

const modeLabels: Record<PreviewMode, string> = {
  contain: "Fit",
  cover: "Fill",
  fill: "Stretch",
};

function formatTime(value: number) {
  if (!Number.isFinite(value)) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function TikTokReelEditor({ profilePath }: TikTokReelEditorProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stage, setStage] = useState<Stage>("upload");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("cover");
  const [selectedSound, setSelectedSound] = useState<Sound>(sounds[0]);
  const [activeSheet, setActiveSheet] = useState<EditorSheet>(null);
  const [overlayText, setOverlayText] = useState("");
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [coverTime, setCoverTime] = useState(0);
  const [coverFrames, setCoverFrames] = useState<CoverFrame[]>([]);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [splitMarkers, setSplitMarkers] = useState<number[]>([]);
  const [isSoundOpen, setIsSoundOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoUrl || duration <= 0) {
      return;
    }

    const sourceUrl = videoUrl;
    let isCancelled = false;
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const frameTimes = Array.from({ length: 6 }, (_, index) =>
      Math.min(duration - 0.1, (duration / 5) * index),
    ).filter((time) => time >= 0);

    async function captureFrames() {
      if (!context) {
        return;
      }

      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;
      video.src = sourceUrl;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Could not read video frames."));
      });

      canvas.width = 120;
      canvas.height = 180;

      const frames: CoverFrame[] = [];

      for (const time of frameTimes) {
        if (isCancelled) {
          return;
        }

        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
          video.currentTime = time;
        });

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push({ time, src: canvas.toDataURL("image/jpeg", 0.72) });
      }

      if (!isCancelled) {
        setCoverFrames(frames);
      }
    }

    captureFrames().catch(() => setCoverFrames([]));

    return () => {
      isCancelled = true;
    };
  }, [duration, videoUrl]);

  function chooseVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("video/")) {
      setError("Choose an MP4, MOV, or WebM video.");
      return;
    }

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    setError(null);
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setCoverFrames([]);
    setCoverTime(0);
    setCurrentTime(0);
    setDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
    setSplitMarkers([]);
    setStage("edit");
  }

  async function togglePlayback() {
    if (!videoRef.current) {
      return;
    }

    if (videoRef.current.paused) {
      await videoRef.current.play();
      setIsPlaying(true);
      return;
    }

    videoRef.current.pause();
    setIsPlaying(false);
  }

  function cyclePreviewMode() {
    setPreviewMode((current) => {
      if (current === "cover") return "contain";
      if (current === "contain") return "fill";
      return "cover";
    });
  }

  function seekTo(time: number) {
    const nextTime = Math.max(0, Math.min(time, duration || time));

    setCurrentTime(nextTime);

    if (videoRef.current) {
      videoRef.current.currentTime = nextTime;
    }
  }

  async function publishReel(status: "draft" | "published") {
    if (!videoFile) {
      setError("Upload a video first.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("video", videoFile);

      const uploadResponse = await fetch("/api/reels/upload", {
        method: "POST",
        body: formData,
      });
      const uploadResult = (await uploadResponse.json()) as {
        error?: string;
        mediaPath?: string;
      };

      if (!uploadResponse.ok || !uploadResult.mediaPath) {
        throw new Error(uploadResult.error || "Could not upload this reel.");
      }

      const saveResponse = await fetch("/api/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption,
          coverTime,
          previewMode,
          soundId: selectedSound.id,
          splitMarkers,
          status,
          trimEnd,
          trimStart,
          videoPath: uploadResult.mediaPath,
        }),
      });
      const saveResult = (await saveResponse.json()) as { error?: string };

      if (!saveResponse.ok) {
        throw new Error(saveResult.error || "Could not save this reel.");
      }

      router.replace(profilePath);
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this reel.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const previewObjectClass =
    previewMode === "fill"
      ? "h-full w-full object-fill"
      : previewMode === "contain"
        ? "h-full w-full object-contain"
        : "h-full w-full object-cover";

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-black text-white">
      <input
        ref={inputRef}
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={chooseVideo}
        type="file"
      />

      {stage === "timeline" ? (
        <div className="relative mx-auto flex min-h-0 flex-1 flex-col overflow-hidden bg-[#07070b] sm:max-w-[430px]">
          <TimelineVideoEditor
            brightness={brightness}
            captionsEnabled={captionsEnabled}
            contrast={contrast}
            coverFrames={coverFrames}
            currentTime={currentTime}
            duration={duration}
            onBack={() => setStage("edit")}
            onCover={() => setActiveSheet("cover")}
            onOverlayTextChange={setOverlayText}
            onSave={() => setStage("edit")}
            onSeek={seekTo}
            onSound={() => setIsSoundOpen(true)}
            onSplitMarkersChange={setSplitMarkers}
            onTrimEndChange={setTrimEnd}
            onTrimStartChange={setTrimStart}
            overlayText={overlayText}
            previewObjectClass={previewObjectClass}
            selectedSound={selectedSound}
            splitMarkers={splitMarkers}
            trimEnd={trimEnd}
            trimStart={trimStart}
            videoUrl={videoUrl}
          />
          {isSoundOpen ? (
            <SoundSheet
              onClose={() => setIsSoundOpen(false)}
              onSelect={(sound) => {
                setSelectedSound(sound);
                setIsSoundOpen(false);
              }}
              selectedSound={selectedSound}
            />
          ) : null}
          {activeSheet === "cover" ? (
            <EditorActionSheet
              activeSheet="cover"
              brightness={brightness}
              captionsEnabled={captionsEnabled}
              contrast={contrast}
              coverFrames={coverFrames}
              coverTime={coverTime}
              currentTime={currentTime}
              duration={duration}
              onBrightnessChange={setBrightness}
              onCaptionsChange={setCaptionsEnabled}
              onClose={() => setActiveSheet(null)}
              onContrastChange={setContrast}
              onCoverTimeChange={setCoverTime}
              onOverlayTextChange={setOverlayText}
              onSeek={seekTo}
              onTrimEndChange={setTrimEnd}
              onTrimStartChange={setTrimStart}
              overlayText={overlayText}
              previewMode={previewMode}
              trimEnd={trimEnd}
              trimStart={trimStart}
            />
          ) : null}
        </div>
      ) : stage === "post" ? (
        <PostScreen
          caption={caption}
          error={error}
          isSaving={isSaving}
          onBack={() => setStage("edit")}
          onCaptionChange={setCaption}
          onDraft={() => publishReel("draft")}
          onPost={() => publishReel("published")}
          sound={selectedSound}
          videoUrl={videoUrl}
        />
      ) : (
        <div className="relative mx-auto flex min-h-0 flex-1 flex-col overflow-hidden bg-black sm:max-w-[430px]">
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-4">
            <button
              aria-label="Back"
              className="flex size-10 items-center justify-center rounded-full bg-black/35 backdrop-blur"
              onClick={() => {
                if (stage === "edit") {
                  setStage("upload");
                  return;
                }
                router.replace(profilePath);
              }}
              type="button"
            >
              <ArrowLeft className="size-5" />
            </button>
            {videoUrl ? (
              <>
                <button
                  className="inline-flex max-w-[210px] items-center gap-2 rounded-full bg-black/45 px-4 py-2 text-sm font-bold backdrop-blur"
                  onClick={() => setIsSoundOpen(true)}
                  type="button"
                >
                  <Music2 className="size-4" />
                  <span className="truncate">
                    {selectedSound.id === "original"
                      ? "Add sound"
                      : selectedSound.title}
                  </span>
                </button>
                <button
                  aria-label="Settings"
                  className="flex size-10 items-center justify-center rounded-full bg-black/35 backdrop-blur"
                  onClick={() => setActiveSheet("settings")}
                  type="button"
                >
                  <Settings className="size-5" />
                </button>
              </>
            ) : (
              <span className="size-10" />
            )}
          </div>

          <button
            className="relative flex min-h-0 flex-1 items-center justify-center bg-[#07070b]"
            onClick={videoUrl ? togglePlayback : () => inputRef.current?.click()}
            type="button"
          >
            {videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  className={cn(previewObjectClass, "bg-black")}
                  loop
                  muted={selectedSound.id !== "original"}
                  onLoadedMetadata={(event) => {
                    const nextDuration = event.currentTarget.duration || 0;
                    setDuration(nextDuration);
                    setTrimEnd(nextDuration);
                  }}
                  onTimeUpdate={(event) => {
                    const time = event.currentTarget.currentTime;
                    setCurrentTime(time);

                    if (trimEnd > trimStart && time >= trimEnd) {
                      event.currentTarget.currentTime = trimStart;
                    }
                  }}
                  playsInline
                  src={videoUrl}
                  style={{
                    filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                  }}
                />
                {overlayText ? (
                  <span className="absolute left-1/2 top-[42%] max-w-[82%] -translate-x-1/2 rounded-xl bg-black/35 px-3 py-2 text-center text-3xl font-semibold leading-tight text-white shadow-lg">
                    {overlayText}
                  </span>
                ) : null}
                {captionsEnabled ? (
                  <span className="absolute bottom-32 left-1/2 max-w-[78%] -translate-x-1/2 rounded-lg bg-black/70 px-3 py-2 text-center text-sm font-bold text-white">
                    Auto captions will be generated after upload.
                  </span>
                ) : null}
                {!isPlaying ? (
                  <span className="absolute grid size-20 place-items-center rounded-full bg-black/45 backdrop-blur">
                    <Play className="ml-1 size-9 fill-white" />
                  </span>
                ) : null}
              </>
            ) : (
              <div className="flex flex-col items-center gap-5 px-8 text-center">
                <span className="grid size-20 place-items-center rounded-full bg-white/10">
                  <Upload className="size-9" />
                </span>
                <div>
                  <p className="text-2xl font-semibold">Upload video</p>
                  <p className="mt-2 text-sm font-medium text-white/60">
                    MP4, MOV, or WebM
                  </p>
                </div>
              </div>
            )}
          </button>

          {stage === "edit" ? (
            <div className="absolute right-3 top-24 z-20 flex flex-col items-center gap-4">
              <ToolButton
                icon={Type}
                label="Text"
                onClick={() => setActiveSheet("text")}
              />
              <ToolButton
                icon={Captions}
                label="Captions"
                onClick={() => setActiveSheet("captions")}
              />
              <ToolButton
                icon={Scissors}
                label="Edit"
                onClick={() => setStage("timeline")}
              />
              <ToolButton
                icon={Maximize2}
                label={modeLabels[previewMode]}
                onClick={cyclePreviewMode}
              />
              <ToolButton
                icon={SlidersHorizontal}
                label="Adjust"
                onClick={() => setActiveSheet("adjust")}
              />
              <ToolButton
                icon={ImageIcon}
                label="Cover"
                onClick={() => setActiveSheet("cover")}
              />
            </div>
          ) : null}

          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/85 to-transparent px-4 pb-5 pt-24">
            {error ? (
              <div className="mb-3 rounded-xl border border-red-400/50 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-100">
                {error}
              </div>
            ) : null}
            <div className="flex items-center gap-3">
              <Button
                className="h-12 flex-1 rounded-xl border-white/20 bg-white text-black hover:bg-white/90"
                onClick={() => inputRef.current?.click()}
                type="button"
              >
                <Clapperboard className="size-5" />
                {videoUrl ? "Replace" : "Upload"}
              </Button>
              <Button
                className="h-12 flex-1 rounded-xl bg-[#ff315f] text-white hover:bg-[#f02a56]"
                disabled={!videoUrl}
                onClick={() => setStage("post")}
                type="button"
              >
                Next
                <ChevronRight className="size-5" />
              </Button>
            </div>
          </div>

          {isSoundOpen ? (
            <SoundSheet
              onClose={() => setIsSoundOpen(false)}
              onSelect={(sound) => {
                setSelectedSound(sound);
                setIsSoundOpen(false);
              }}
              selectedSound={selectedSound}
            />
          ) : null}

          {activeSheet ? (
            <EditorActionSheet
              activeSheet={activeSheet}
              brightness={brightness}
              captionsEnabled={captionsEnabled}
              contrast={contrast}
              coverFrames={coverFrames}
              coverTime={coverTime}
              currentTime={currentTime}
              duration={duration}
              onBrightnessChange={setBrightness}
              onCaptionsChange={setCaptionsEnabled}
              onClose={() => setActiveSheet(null)}
              onContrastChange={setContrast}
              onCoverTimeChange={setCoverTime}
              onOverlayTextChange={setOverlayText}
              onSeek={seekTo}
              onTrimEndChange={setTrimEnd}
              onTrimStartChange={setTrimStart}
              overlayText={overlayText}
              previewMode={previewMode}
              trimEnd={trimEnd}
              trimStart={trimStart}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Type;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      className="flex w-16 flex-col items-center gap-1 text-[11px] font-bold text-white drop-shadow"
      onClick={onClick}
      type="button"
    >
      <span className="grid size-11 place-items-center rounded-full bg-black/35 backdrop-blur">
        <Icon className="size-5" />
      </span>
      {label}
    </button>
  );
}

function TimelineVideoEditor({
  brightness,
  captionsEnabled,
  contrast,
  coverFrames,
  currentTime,
  duration,
  onBack,
  onCover,
  onOverlayTextChange,
  onSave,
  onSeek,
  onSound,
  onSplitMarkersChange,
  onTrimEndChange,
  onTrimStartChange,
  overlayText,
  previewObjectClass,
  selectedSound,
  splitMarkers,
  trimEnd,
  trimStart,
  videoUrl,
}: {
  brightness: number;
  captionsEnabled: boolean;
  contrast: number;
  coverFrames: CoverFrame[];
  currentTime: number;
  duration: number;
  onBack: () => void;
  onCover: () => void;
  onOverlayTextChange: (value: string) => void;
  onSave: () => void;
  onSeek: (value: number) => void;
  onSound: () => void;
  onSplitMarkersChange: (value: number[]) => void;
  onTrimEndChange: (value: number) => void;
  onTrimStartChange: (value: number) => void;
  overlayText: string;
  previewObjectClass: string;
  selectedSound: Sound;
  splitMarkers: number[];
  trimEnd: number;
  trimStart: number;
  videoUrl: string | null;
}) {
  const timelineVideoRef = useRef<HTMLVideoElement | null>(null);
  const safeDuration = Math.max(duration, 0.1);
  const playheadPercent = Math.min(100, (currentTime / safeDuration) * 100);
  const trimStartPercent = Math.min(100, (trimStart / safeDuration) * 100);
  const trimEndPercent = Math.min(
    100,
    ((trimEnd || duration) / safeDuration) * 100,
  );

  function jumpTo(time: number) {
    const nextTime = Math.max(0, Math.min(time, duration || time));

    if (timelineVideoRef.current) {
      timelineVideoRef.current.currentTime = nextTime;
    }

    onSeek(nextTime);
  }

  function splitAtPlayhead() {
    if (duration <= 0) {
      return;
    }

    const nextMarkers = Array.from(
      new Set([...splitMarkers, Number(currentTime.toFixed(2))]),
    )
      .filter((time) => time > 0.2 && time < duration - 0.2)
      .sort((a, b) => a - b);

    onSplitMarkersChange(nextMarkers);
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-[#08080c] text-white">
      <div className="flex h-12 shrink-0 items-center justify-between px-3 text-sm font-bold">
        <button onClick={onBack} type="button">
          Cancel
        </button>
        <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
        <button onClick={onSave} type="button">
          Save
        </button>
      </div>

      <div className="relative mx-auto aspect-[9/13] min-h-0 w-[74%] max-w-[300px] overflow-hidden rounded-sm bg-black">
        {videoUrl ? (
          <video
            ref={timelineVideoRef}
            className={cn(previewObjectClass, "bg-black")}
            loop
            muted={selectedSound.id !== "original"}
            onTimeUpdate={(event) => {
              const time = event.currentTarget.currentTime;
              onSeek(time);

              if (trimEnd > trimStart && time >= trimEnd) {
                event.currentTarget.currentTime = trimStart;
              }
            }}
            playsInline
            src={videoUrl}
            style={{
              filter: `brightness(${brightness}%) contrast(${contrast}%)`,
            }}
          />
        ) : null}
        {overlayText ? (
          <span className="absolute left-1/2 top-[42%] max-w-[82%] -translate-x-1/2 rounded-lg bg-black/35 px-3 py-2 text-center text-xl font-semibold leading-tight text-white">
            {overlayText}
          </span>
        ) : null}
        {captionsEnabled ? (
          <span className="absolute bottom-6 left-1/2 max-w-[82%] -translate-x-1/2 rounded bg-black/70 px-2 py-1 text-center text-xs font-bold">
            Auto captions enabled
          </span>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-7 py-3">
        <button
          className="text-xs font-bold text-white/70"
          onClick={() => jumpTo(Math.max(trimStart, currentTime - 1))}
          type="button"
        >
          -1s
        </button>
        <button
          className="grid size-11 place-items-center rounded-full bg-white text-black"
          onClick={() => {
            const video = timelineVideoRef.current;

            if (!video) {
              return;
            }

            if (video.paused) {
              void video.play();
              return;
            }

            video.pause();
          }}
          type="button"
        >
          <Play className="ml-0.5 size-5 fill-black" />
        </button>
        <button
          className="text-xs font-bold text-white/70"
          onClick={() => jumpTo(Math.min(trimEnd || duration, currentTime + 1))}
          type="button"
        >
          +1s
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <div className="relative mb-4 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3">
          <div
            className="absolute bottom-3 top-3 z-20 w-0.5 bg-white"
            style={{ left: `calc(${playheadPercent}% + 12px)` }}
          >
            <span className="absolute -top-2 left-1/2 size-3 -translate-x-1/2 rounded-full bg-white" />
          </div>
          <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-white/55">
            <span>Clip timeline</span>
            <span>
              {formatTime(trimStart)} - {formatTime(trimEnd || duration)}
            </span>
          </div>
          <button
            className="relative flex h-16 w-full overflow-hidden rounded-xl border border-white/10 bg-black"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const percent = (event.clientX - rect.left) / rect.width;
              jumpTo(percent * safeDuration);
            }}
            type="button"
          >
            <span
              className="absolute inset-y-0 border-l-4 border-primary"
              style={{ left: `${trimStartPercent}%` }}
            />
            <span
              className="absolute inset-y-0 border-r-4 border-primary"
              style={{ left: `${trimEndPercent}%` }}
            />
            {coverFrames.length
              ? coverFrames.map((frame) => (
                  <span className="min-w-16 flex-1" key={frame.time}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- Canvas-generated data URL thumbnails are not remote/image-loader assets. */}
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      src={frame.src}
                    />
                  </span>
                ))
              : null}
            {splitMarkers.map((time) => (
              <span
                className="absolute inset-y-0 w-0.5 bg-yellow-300"
                key={time}
                style={{ left: `${(time / safeDuration) * 100}%` }}
              />
            ))}
          </button>

          <TrackRow
            color="bg-[#ff4d8d]"
            icon={Type}
            label={overlayText ? "Text overlay" : "Text track"}
            muted={!overlayText}
          />
          <TrackRow
            color="bg-[#6d5dfc]"
            icon={Music2}
            label={selectedSound.title}
            muted={selectedSound.id === "none"}
          />
          <TrackRow
            color="bg-[#37c871]"
            icon={Layers}
            label="Overlay track"
            muted
          />
        </div>

        <div className="grid grid-cols-4 gap-2">
          <TimelineAction
            icon={Scissors}
            label="Split"
            onClick={splitAtPlayhead}
          />
          <TimelineAction
            icon={Clapperboard}
            label="Trim"
            onClick={() => {
              onTrimStartChange(Math.min(currentTime, trimEnd || duration));
              onTrimEndChange(Math.max(currentTime, trimStart));
            }}
          />
          <TimelineAction icon={Music2} label="Sound" onClick={onSound} />
          <TimelineAction
            icon={Type}
            label="Text"
            onClick={() =>
              onOverlayTextChange(overlayText || "Property tour")
            }
          />
          <TimelineAction icon={ImageIcon} label="Cover" onClick={onCover} />
          <TimelineAction
            icon={RotateCcw}
            label="Reset"
            onClick={() => {
              onTrimStartChange(0);
              onTrimEndChange(duration);
              onSplitMarkersChange([]);
              jumpTo(0);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function TrackRow({
  color,
  icon: Icon,
  label,
  muted,
}: {
  color: string;
  icon: typeof Type;
  label: string;
  muted?: boolean;
}) {
  return (
    <div className="mt-2 flex h-9 items-center gap-2">
      <Icon className="size-4 text-white/60" />
      <div
        className={cn(
          "flex h-8 flex-1 items-center rounded-lg px-3 text-xs font-semibold",
          muted ? "bg-white/10 text-white/45" : `${color} text-white`,
        )}
      >
        {label}
      </div>
    </div>
  );
}

function TimelineAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Scissors;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white/[0.08] text-xs font-semibold text-white"
      onClick={onClick}
      type="button"
    >
      <Icon className="size-5" />
      {label}
    </button>
  );
}

function SoundSheet({
  onClose,
  onSelect,
  selectedSound,
}: {
  onClose: () => void;
  onSelect: (sound: Sound) => void;
  selectedSound: Sound;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/55">
      <div className="w-full rounded-t-[28px] bg-background px-4 pb-5 pt-3 text-foreground">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-border" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Sounds</h2>
          <button
            aria-label="Close sounds"
            className="grid size-10 place-items-center rounded-full bg-muted"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-2">
          {sounds.map((sound) => (
            <button
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-left"
              key={sound.id}
              onClick={() => onSelect(sound)}
              type="button"
            >
              <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
                {sound.id === "none" ? (
                  <Pause className="size-5" />
                ) : (
                  <Volume2 className="size-5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {sound.title}
                </span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {sound.artist}
                </span>
              </span>
              {selectedSound.id === sound.id ? (
                <Check className="size-5 text-primary" />
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditorActionSheet({
  activeSheet,
  brightness,
  captionsEnabled,
  contrast,
  coverFrames,
  coverTime,
  currentTime,
  duration,
  onBrightnessChange,
  onCaptionsChange,
  onClose,
  onContrastChange,
  onCoverTimeChange,
  onOverlayTextChange,
  onSeek,
  onTrimEndChange,
  onTrimStartChange,
  overlayText,
  previewMode,
  trimEnd,
  trimStart,
}: {
  activeSheet: Exclude<EditorSheet, null>;
  brightness: number;
  captionsEnabled: boolean;
  contrast: number;
  coverFrames: CoverFrame[];
  coverTime: number;
  currentTime: number;
  duration: number;
  onBrightnessChange: (value: number) => void;
  onCaptionsChange: (value: boolean) => void;
  onClose: () => void;
  onContrastChange: (value: number) => void;
  onCoverTimeChange: (value: number) => void;
  onOverlayTextChange: (value: string) => void;
  onSeek: (value: number) => void;
  onTrimEndChange: (value: number) => void;
  onTrimStartChange: (value: number) => void;
  overlayText: string;
  previewMode: PreviewMode;
  trimEnd: number;
  trimStart: number;
}) {
  const title = {
    adjust: "Adjust",
    captions: "Captions",
    cover: "Cover",
    edit: "Edit video",
    settings: "Settings",
    text: "Text",
  }[activeSheet];

  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/35">
      <div className="w-full rounded-t-[28px] bg-background px-4 pb-5 pt-3 text-foreground shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-border" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            aria-label={`Close ${title}`}
            className="grid size-10 place-items-center rounded-full bg-muted"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        {activeSheet === "text" ? (
          <div className="space-y-3">
            <input
              autoFocus
              className="h-12 w-full rounded-2xl border border-border bg-card px-4 text-base font-bold outline-none focus:border-primary"
              maxLength={80}
              onChange={(event) => onOverlayTextChange(event.target.value)}
              placeholder="Add text overlay"
              value={overlayText}
            />
            <div className="flex gap-2">
              {["Tour", "For Sale", "New Listing"].map((preset) => (
                <button
                  className="rounded-full bg-muted px-3 py-2 text-xs font-semibold"
                  key={preset}
                  onClick={() => onOverlayTextChange(preset)}
                  type="button"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {activeSheet === "captions" ? (
          <div className="space-y-4">
            <button
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 text-left"
              onClick={() => onCaptionsChange(!captionsEnabled)}
              type="button"
            >
              <span>
                <span className="block text-sm font-semibold">Auto captions</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  Generate captions from reel audio after upload.
                </span>
              </span>
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full border",
                  captionsEnabled
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border",
                )}
              >
                {captionsEnabled ? <Check className="size-4" /> : null}
              </span>
            </button>
          </div>
        ) : null}

        {activeSheet === "edit" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {coverFrames.length ? (
                coverFrames.map((frame) => (
                  <button
                    className={cn(
                      "relative h-24 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-muted",
                      Math.abs(currentTime - frame.time) < 1
                        ? "border-primary"
                        : "border-transparent",
                    )}
                    key={frame.time}
                    onClick={() => onSeek(frame.time)}
                    type="button"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- Canvas-generated data URL thumbnails are not remote/image-loader assets. */}
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      src={frame.src}
                    />
                    <span className="absolute inset-x-1 bottom-1 rounded bg-black/65 py-0.5 text-[10px] font-semibold text-white">
                      {formatTime(frame.time)}
                    </span>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl bg-muted px-4 py-3 text-sm font-normal text-muted-foreground">
                  Loading clip frames...
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                className="rounded-2xl border border-border bg-card px-3 py-3 text-left"
                onClick={() => onTrimStartChange(Math.min(currentTime, trimEnd))}
                type="button"
              >
                <span className="block text-xs font-normal text-muted-foreground">
                  Start
                </span>
                <span className="text-base font-semibold">
                  {formatTime(trimStart)}
                </span>
              </button>
              <button
                className="rounded-2xl border border-border bg-card px-3 py-3 text-left"
                onClick={() => onSeek(Math.max(0, currentTime - 1))}
                type="button"
              >
                <span className="block text-xs font-normal text-muted-foreground">
                  Playhead
                </span>
                <span className="text-base font-semibold">
                  {formatTime(currentTime)}
                </span>
              </button>
              <button
                className="rounded-2xl border border-border bg-card px-3 py-3 text-left"
                onClick={() => onTrimEndChange(Math.max(currentTime, trimStart))}
                type="button"
              >
                <span className="block text-xs font-normal text-muted-foreground">
                  End
                </span>
                <span className="text-base font-semibold">
                  {formatTime(trimEnd || duration)}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                className="h-11 rounded-xl bg-muted text-sm font-semibold"
                onClick={() => onSeek(Math.max(trimStart, currentTime - 0.5))}
                type="button"
              >
                -0.5s
              </button>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-muted text-sm font-semibold"
                onClick={() => {
                  onTrimStartChange(0);
                  onTrimEndChange(duration);
                  onSeek(0);
                }}
                type="button"
              >
                <RotateCcw className="size-4" />
                Reset
              </button>
              <button
                className="h-11 rounded-xl bg-muted text-sm font-semibold"
                onClick={() =>
                  onSeek(Math.min(trimEnd || duration, currentTime + 0.5))
                }
                type="button"
              >
                +0.5s
              </button>
            </div>
          </div>
        ) : null}

        {activeSheet === "adjust" ? (
          <div className="space-y-5">
            <RangeControl
              label="Brightness"
              max={140}
              min={60}
              onChange={onBrightnessChange}
              value={brightness}
            />
            <RangeControl
              label="Contrast"
              max={140}
              min={60}
              onChange={onContrastChange}
              value={contrast}
            />
            <button
              className="h-11 rounded-xl bg-muted px-4 text-sm font-semibold"
              onClick={() => {
                onBrightnessChange(100);
                onContrastChange(100);
              }}
              type="button"
            >
              Reset adjustments
            </button>
          </div>
        ) : null}

        {activeSheet === "cover" ? (
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {coverFrames.length ? (
                coverFrames.map((frame) => (
                  <button
                    className={cn(
                      "relative h-32 w-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-muted",
                      Math.abs(coverTime - frame.time) < 0.2
                        ? "border-primary"
                        : "border-transparent",
                    )}
                    key={frame.time}
                    onClick={() => onCoverTimeChange(frame.time)}
                    type="button"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- Canvas-generated data URL thumbnails are not remote/image-loader assets. */}
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      src={frame.src}
                    />
                    <span className="absolute inset-x-1 bottom-1 rounded bg-black/65 py-1 text-[10px] font-semibold text-white">
                      {formatTime(frame.time)}
                    </span>
                    {Math.abs(coverTime - frame.time) < 0.2 ? (
                      <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-4" />
                      </span>
                    ) : null}
                  </button>
                ))
              ) : (
                <div className="rounded-2xl bg-muted px-4 py-3 text-sm font-normal text-muted-foreground">
                  Loading cover frames...
                </div>
              )}
            </div>
            <div className="rounded-2xl bg-muted px-4 py-3 text-sm font-normal text-muted-foreground">
              Selected cover: {formatTime(coverTime)}
            </div>
          </div>
        ) : null}

        {activeSheet === "settings" ? (
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            <SettingRow label="Canvas" value={modeLabels[previewMode]} />
            <SettingRow label="Quality" value="HD export" />
            <SettingRow label="Visibility" value="Public" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RangeControl({
  label,
  max,
  min,
  onChange,
  suffix = "%",
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  suffix?: string;
  value: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-sm font-semibold">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {value}
          {suffix}
        </span>
      </span>
      <input
        className="w-full accent-primary"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
        value={value}
      />
    </label>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-14 items-center justify-between px-4 text-sm">
      <span className="font-semibold">{label}</span>
      <span className="font-normal text-muted-foreground">{value}</span>
    </div>
  );
}

function PostScreen({
  caption,
  error,
  isSaving,
  onBack,
  onCaptionChange,
  onDraft,
  onPost,
  sound,
  videoUrl,
}: {
  caption: string;
  error: string | null;
  isSaving: boolean;
  onBack: () => void;
  onCaptionChange: (value: string) => void;
  onDraft: () => void;
  onPost: () => void;
  sound: Sound;
  videoUrl: string | null;
}) {
  return (
      <div className="mx-auto flex h-dvh min-h-0 w-full flex-1 flex-col bg-background text-foreground sm:max-w-[430px]">
      <div className="flex h-16 shrink-0 items-center border-b border-border px-3">
        <button
          aria-label="Back to editor"
          className="grid size-10 place-items-center rounded-full hover:bg-muted"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-semibold">Post</h1>
        <span className="size-10" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="flex gap-3">
          <textarea
            className="min-h-32 flex-1 resize-none rounded-2xl border border-border bg-card p-3 text-sm outline-none focus:border-primary"
            maxLength={1000}
            onChange={(event) => onCaptionChange(event.target.value)}
            placeholder="Describe this property reel..."
            value={caption}
          />
          <div className="h-32 w-24 overflow-hidden rounded-2xl bg-black">
            {videoUrl ? (
              <video
                className="h-full w-full object-cover"
                muted
                playsInline
                src={videoUrl}
              />
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <PostChip icon={Hash} label="Hashtags" />
          <PostChip icon={Music2} label={sound.title} />
        </div>

        <div className="mt-5 divide-y divide-border rounded-2xl border border-border bg-card">
          {["Tag people", "Add listing link", "Everyone can view", "More options"].map(
            (item) => (
              <button
                className="flex h-14 w-full items-center justify-between px-4 text-sm font-bold"
                key={item}
                type="button"
              >
                {item}
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            ),
          )}
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
            {error}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-3 border-t border-border bg-background p-4">
        <Button
          className="h-12 flex-1 rounded-xl"
          disabled={isSaving}
          onClick={onDraft}
          variant="outline"
          type="button"
        >
          Drafts
        </Button>
        <Button
          className="h-12 flex-1 rounded-xl bg-[#ff315f] text-white hover:bg-[#f02a56]"
          disabled={isSaving}
          onClick={onPost}
          type="button"
        >
          {isSaving ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Send className="size-5" />
          )}
          Post
        </Button>
      </div>
    </div>
  );
}

function PostChip({ icon: Icon, label }: { icon: typeof Hash; label: string }) {
  return (
    <button
      className="inline-flex h-9 items-center gap-2 rounded-full bg-muted px-3 text-xs font-semibold"
      type="button"
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
