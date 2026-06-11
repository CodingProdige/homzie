"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  type UIEvent,
  type WheelEvent,
} from "react";
import {
  ArrowLeft,
  AtSign,
  Bot,
  Camera,
  Check,
  ChevronRight,
  Clapperboard,
  Globe2,
  GripVertical,
  Hash,
  ImageIcon,
  Loader2,
  MapPin,
  MessageCircle,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat2,
  RotateCcw,
  Scissors,
  Search,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getLibraryTracks,
  searchFreesoundTracks,
  searchJamendo,
} from "@/modules/music/actions";
import type { ExternalTrack, LibraryTrack } from "@/modules/music/types";

import {
  getReelHashtagSuggestions,
  getReelMentionSuggestions,
  retryReelRender,
} from "../actions";

type EditorStage = "capture" | "edit" | "post";
type Sheet = "music" | "cover" | "volume" | "fade" | null;

type ReelClip = {
  id: string;
  file: File;
  url: string;
  duration: number;
  timelineStart: number;
  trimStart: number;
  trimEnd: number;
  baseTrimStart: number;
  muted: boolean;
  volume: number;
  frames: CoverFrame[];
};

type CoverFrame = {
  clipId: string;
  src: string;
  time: number;
};

type Sound = {
  id: string;
  title: string;
  artist: string;
  duration?: number;
  file?: File;
  url?: string;
  storedMediaPath?: string;
};

type TimelineAudioClip = {
  id: string;
  timelineStart: number;
  trimStart: number;
  trimEnd: number;
  baseTrimStart: number;
  fadeIn: number;
  fadeOut: number;
};

type RenderState = {
  error?: string;
  progress: number;
  reelId: string | null;
  status: "idle" | "processing" | "complete" | "failed";
  targetStatus?: "draft" | "published";
};

type MediaProgressState = {
  label: string;
  progress: number;
};

type ReelPostOptions = {
  aiGenerated: boolean;
  allowComments: boolean;
  allowReuse: boolean;
  autoCheckSound: boolean;
};

export type InitialReelDraft = {
  audioClips?: TimelineAudioClip[];
  audioMedia?: {
    artist: string;
    duration?: number;
    id: string;
    mediaUrl: string;
    title: string;
  } | null;
  audioVolume?: number;
  caption?: string | null;
  clips: Array<
    Pick<
      ReelClip,
      | "baseTrimStart"
      | "duration"
      | "id"
      | "muted"
      | "timelineStart"
      | "trimEnd"
      | "trimStart"
      | "volume"
    > & {
      frames?: CoverFrame[];
      mediaUrl: string;
    }
  >;
  coverFrame?: CoverFrame | null;
  location?: string | null;
  options?: ReelPostOptions;
  privacy?: string;
  reelId: string;
  splitMarkers?: number[];
};

type GoogleAutocompletePrediction = {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  types?: string[];
};

type GoogleAutocompleteService = {
  getPlacePredictions: (
    request: {
      input: string;
      sessionToken?: unknown;
      types?: string[];
    },
    callback: (
      predictions: GoogleAutocompletePrediction[] | null,
      status: string,
    ) => void,
  ) => void;
};

declare global {
  interface Window {
    __homzieGoogleMapsPromise?: Promise<void>;
    google?: {
      maps?: {
        places?: {
          AutocompleteService: new () => GoogleAutocompleteService;
          AutocompleteSessionToken: new () => unknown;
          PlacesServiceStatus: {
            OK: string;
          };
        };
      };
    };
  }
}

const sounds: Sound[] = [
  { id: "none", title: "No music", artist: "Muted" },
];
const MIN_TIMELINE_CLIP_DURATION = 0.5;
const MAX_REEL_DESCRIPTION_LENGTH = 1000;
const MAX_REEL_UPLOAD_DURATION_SECONDS = 10 * 60;
const MAX_REEL_UPLOAD_BYTES = 1024 * 1024 * 1024;
const REEL_VIDEO_UPLOAD_ACCEPT = ".mp4,.mov,video/mp4,video/quicktime";
const googleMapsScriptId = "homzie-google-maps-places";
const mediaLoadTimeoutMs = 20000;

function uid() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function isAcceptedReelVideo(file: File) {
  const normalizedName = file.name.toLowerCase();

  return (
    file.type === "video/mp4" ||
    file.type === "video/quicktime" ||
    normalizedName.endsWith(".mp4") ||
    normalizedName.endsWith(".mov")
  );
}

function validateReelVideoFile(file: File) {
  if (!isAcceptedReelVideo(file)) {
    throw new Error("Upload an MP4 or MOV video.");
  }

  if (file.size > MAX_REEL_UPLOAD_BYTES) {
    throw new Error("Videos must be 1GB or smaller.");
  }
}

function withTimeout<T>(
  callback: (resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
  timeoutMs = mediaLoadTimeoutMs,
) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("Timed out while loading saved media."));
    }, timeoutMs);

    callback(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (reason) => {
        window.clearTimeout(timeoutId);
        reject(reason);
      },
    );
  });
}

async function fileFromMediaUrl(
  url: string,
  fileName: string,
  fallbackType: string,
  onProgress?: (progress: number) => void,
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 60000);
  const response = await fetch(url, { signal: controller.signal }).finally(() => {
    window.clearTimeout(timeoutId);
  });

  if (!response.ok) {
    throw new Error("Could not load saved media.");
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  const contentType = response.headers.get("content-type") || fallbackType;
  let blob: Blob;

  if (response.body && contentLength > 0) {
    const reader = response.body.getReader();
    const chunks: BlobPart[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await withTimeout<ReadableStreamReadResult<Uint8Array>>(
        (resolve, reject) => {
          reader.read().then(resolve).catch(reject);
        },
        mediaLoadTimeoutMs,
      );

      if (done) break;
      if (!value) continue;

      chunks.push(value.slice());
      received += value.byteLength;
      onProgress?.(Math.round((received / contentLength) * 100));
    }

    blob = new Blob(chunks, { type: contentType });
  } else {
    blob = await response.blob();
    onProgress?.(100);
  }

  return new File([blob], fileName, {
    type: blob.type || fallbackType,
  });
}

function uploadReelMedia(
  fieldName: "audio" | "video",
  file: File,
  onProgress: (progress: number) => void,
) {
  return new Promise<{
    mediaPath: string;
    mediaUrl?: string;
  }>((resolve, reject) => {
    const formData = new FormData();
    formData.append(fieldName, file);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("Could not upload this media."));
    xhr.onload = () => {
      let result: {
        error?: string;
        mediaPath?: string;
        mediaUrl?: string;
      } = {};

      try {
        result = JSON.parse(xhr.responseText || "{}") as typeof result;
      } catch {
        reject(new Error("Could not read the upload response."));
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300 || !result.mediaPath) {
        reject(new Error(result.error || "Could not upload this media."));
        return;
      }

      resolve({
        mediaPath: result.mediaPath,
        mediaUrl: result.mediaUrl,
      });
    };
    xhr.open("POST", "/api/reels/upload");
    xhr.send(formData);
  });
}

async function readJsonResponse<T>(response: Response, fallbackError: string) {
  const text = await response.text();

  if (!text) {
    return {
      error: response.ok ? undefined : fallbackError,
    } as T & { error?: string };
  }

  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    return {
      error: response.ok ? fallbackError : text.slice(0, 240) || fallbackError,
    } as T & { error?: string };
  }
}

function isMobileCaptureDevice() {
  if (typeof window === "undefined") return false;
  return (
    navigator.maxTouchPoints > 0 &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}

function getDeviceModeLabel(canRecord: boolean) {
  if (typeof window === "undefined") {
    return "Detecting device";
  }

  const touchPoints = navigator.maxTouchPoints || 0;
  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  return canRecord
    ? `Mobile record mode · touch ${touchPoints} · mobile browser`
    : `Desktop upload mode · touch ${touchPoints} · ${
        isMobileUA ? "mobile browser" : "desktop browser"
      }`;
}

function loadGooglePlaces() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Places is only available in browser."));
  }

  if (window.google?.maps?.places) {
    return Promise.resolve();
  }

  if (window.__homzieGoogleMapsPromise) {
    return window.__homzieGoogleMapsPromise;
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return Promise.reject(new Error("Google Places is not configured."));
  }

  window.__homzieGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(googleMapsScriptId);

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Could not load Google Places.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = googleMapsScriptId;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google Places."));
    document.head.appendChild(script);
  });

  return window.__homzieGoogleMapsPromise;
}

function isCityOrCountryPrediction(prediction: GoogleAutocompletePrediction) {
  return prediction.types?.some((type) =>
    ["country", "locality", "postal_town"].includes(type),
  );
}

async function readVideoDuration(url: string) {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.src = url;

  return await withTimeout<number>((resolve) => {
    video.onloadedmetadata = () => resolve(video.duration || 0);
    video.onerror = () => resolve(0);
  }).catch(() => 0);
}

async function readAudioDuration(url: string) {
  const audio = document.createElement("audio");
  audio.preload = "metadata";
  audio.src = url;

  return await new Promise<number>((resolve) => {
    audio.onloadedmetadata = () => resolve(audio.duration || 0);
    audio.onerror = () => resolve(0);
  });
}

function resolveAudioFetchUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.origin !== window.location.origin) {
      return `/api/audio/waveform?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // relative URL — same origin, fetch directly
  }
  return url;
}

async function createAudioWaveformPeaks(sound: Sound, peakCount = 2400) {
  const sourceBuffer = sound.file
    ? await sound.file.arrayBuffer()
    : sound.url
      ? await fetch(resolveAudioFetchUrl(sound.url)).then((response) => response.arrayBuffer())
      : null;

  if (!sourceBuffer) return [];

  const AudioContextConstructor =
    window.AudioContext ||
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;

  if (!AudioContextConstructor) return [];

  const audioContext = new AudioContextConstructor();

  try {
    const audioBuffer = await audioContext.decodeAudioData(sourceBuffer.slice(0));
    const channels = Array.from(
      { length: audioBuffer.numberOfChannels },
      (_, index) => audioBuffer.getChannelData(index),
    );
    const samplesPerPeak = Math.max(
      1,
      Math.floor(audioBuffer.length / peakCount),
    );

    return Array.from({ length: peakCount }, (_, peakIndex) => {
      const start = peakIndex * samplesPerPeak;
      const end = Math.min(audioBuffer.length, start + samplesPerPeak);
      let peak = 0;

      for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
        const sample =
          channels.reduce(
            (total, channel) => total + Math.abs(channel[sampleIndex] || 0),
            0,
          ) / channels.length;

        peak = Math.max(peak, sample);
      }

      return Math.max(8, Math.min(100, peak * 100));
    });
  } finally {
    void audioContext.close();
  }
}

function getFadeAdjustedVolume(
  segment: { clip: TimelineAudioClip; duration: number; start: number },
  playhead: number,
  baseVolume: number,
) {
  const elapsed = Math.max(0, playhead - segment.start);
  const remaining = Math.max(0, segment.duration - elapsed);
  const fadeInFactor =
    segment.clip.fadeIn > 0 ? Math.min(1, elapsed / segment.clip.fadeIn) : 1;
  const fadeOutFactor =
    segment.clip.fadeOut > 0 ? Math.min(1, remaining / segment.clip.fadeOut) : 1;

  return baseVolume * Math.min(fadeInFactor, fadeOutFactor);
}

async function captureFrames(url: string, clipId: string, duration: number) {
  if (duration <= 0) return [];

  const video = document.createElement("video");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) return [];

  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  await withTimeout<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Could not read clip."));
  }).catch(() => undefined);

  canvas.width = 120;
  canvas.height = 180;

  const frameTimes = Array.from({ length: 6 }, (_, index) =>
    Math.min(duration - 0.05, (duration / 5) * index),
  ).filter((time) => time >= 0);
  const frames: CoverFrame[] = [];

  for (const time of frameTimes) {
    const didSeek = await withTimeout<boolean>((resolve) => {
      video.onseeked = () => resolve(true);
      video.currentTime = time;
    }, 8000)
      .then(() => true)
      .catch(() => false);

    if (!didSeek) continue;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push({
      clipId,
      time,
      src: canvas.toDataURL("image/jpeg", 0.72),
    });
  }

  return frames;
}

export function ReelMvpEditor({
  initialDraft,
  profilePath,
}: {
  initialDraft?: InitialReelDraft;
  profilePath: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const didHydrateDraftRef = useRef(false);
  const [stage, setStage] = useState<EditorStage>("capture");
  const [clips, setClips] = useState<ReelClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [caption, setCaption] = useState("");
  const [postLocation, setPostLocation] = useState("");
  const [postPrivacy, setPostPrivacy] = useState("Everyone");
  const [postOptions, setPostOptions] = useState<ReelPostOptions>({
    aiGenerated: false,
    allowComments: true,
    allowReuse: true,
    autoCheckSound: true,
  });
  const [selectedSound, setSelectedSound] = useState<Sound>(sounds[0]);
  const [audioWaveform, setAudioWaveform] = useState<number[]>([]);
  const [audioClips, setAudioClips] = useState<TimelineAudioClip[]>([]);
  const [selectedAudioClipId, setSelectedAudioClipId] = useState<string | null>(
    null,
  );
  const [audioVolume, setAudioVolume] = useState(1);
  const [coverFrame, setCoverFrame] = useState<CoverFrame | null>(null);
  const [splitMarkers, setSplitMarkers] = useState<number[]>([]);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [volumeTarget, setVolumeTarget] = useState<"video" | "audio">("video");
  const [canRecord] = useState(() => isMobileCaptureDevice());
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [renderState, setRenderState] = useState<RenderState>({
    progress: 0,
    reelId: null,
    status: "idle",
  });
  const [mediaProgress, setMediaProgress] = useState<MediaProgressState | null>(
    null,
  );
  const [isRetryingRender, setIsRetryingRender] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClip = useMemo(
    () => clips.find((clip) => clip.id === selectedClipId) || clips[0] || null,
    [clips, selectedClipId],
  );
  const selectedAudioClip = useMemo(
    () =>
      audioClips.find((clip) => clip.id === selectedAudioClipId) ||
      audioClips[0] ||
      null,
    [audioClips, selectedAudioClipId],
  );
  const allFrames = clips.flatMap((clip) => clip.frames);
  const selectedCoverFrame = coverFrame || allFrames[0] || null;
  const totalDuration = clips.reduce(
    (total, clip) => total + Math.max(0, clip.trimEnd - clip.trimStart),
    0,
  );
  const sourceDuration = clips.reduce((total, clip) => total + clip.duration, 0);
  const effectiveAudioTrim = useMemo(() => {
    if (selectedSound.id === "none") {
      return { start: 0, end: 0 };
    }

    if (!selectedAudioClip) {
      return { start: 0, end: 0 };
    }

    const start =
      selectedAudioClip.timelineStart +
      selectedAudioClip.trimStart -
      selectedAudioClip.baseTrimStart;

    return {
      start,
      end:
        selectedAudioClip.timelineStart +
        selectedAudioClip.trimEnd -
        selectedAudioClip.baseTrimStart,
    };
  }, [selectedAudioClip, selectedSound.id]);
  const hasAddedMusic = selectedSound.id !== "none" && Boolean(selectedSound.url);

  useEffect(() => {
    if (!initialDraft || didHydrateDraftRef.current) {
      return;
    }

    didHydrateDraftRef.current = true;
    const draft = initialDraft;
    let isActive = true;
    const hydratedObjectUrls: string[] = [];

    async function hydrateDraft() {
      setError(null);
      setMediaProgress({ label: "Loading draft", progress: 8 });

      try {
        const nextClips: ReelClip[] = [];

        for (const [index, savedClip] of draft.clips.entries()) {
          setMediaProgress({
            label: `Loading clip ${index + 1} of ${draft.clips.length}`,
            progress: Math.round(((index + 0.25) / draft.clips.length) * 80),
          });

          const clipProgressStart = (index / draft.clips.length) * 80;
          const clipProgressSpan = 80 / draft.clips.length;
          const file = await fileFromMediaUrl(
            savedClip.mediaUrl,
            `draft-clip-${index + 1}.mp4`,
            "video/mp4",
            (downloadProgress) => {
              if (!isActive) return;

              setMediaProgress({
                label: `Downloading clip ${index + 1} of ${draft.clips.length}`,
                progress: Math.round(
                  clipProgressStart + clipProgressSpan * (downloadProgress / 100),
                ),
              });
            },
          );
          const url = URL.createObjectURL(file);
          hydratedObjectUrls.push(url);
          const duration = savedClip.duration || (await readVideoDuration(url));
          const frames =
            savedClip.frames && savedClip.frames.length
              ? savedClip.frames
              : await captureFrames(url, savedClip.id, duration);

          nextClips.push({
            ...savedClip,
            duration,
            file,
            frames,
            url,
          });
        }

        let nextSound = sounds[0];

        if (draft.audioMedia?.mediaUrl) {
          const audioFile = await fileFromMediaUrl(
            draft.audioMedia.mediaUrl,
            "draft-audio.mp3",
            "audio/mpeg",
          );
          const audioUrl = URL.createObjectURL(audioFile);
          hydratedObjectUrls.push(audioUrl);
          nextSound = {
            artist: draft.audioMedia.artist,
            duration: draft.audioMedia.duration,
            file: audioFile,
            id: draft.audioMedia.id,
            title: draft.audioMedia.title,
            url: audioUrl,
          };
        }

        if (!isActive) return;

        setClips(nextClips);
        setSelectedClipId(nextClips[0]?.id || null);
        setCaption(draft.caption || "");
        setPostLocation(draft.location || "");
        setPostPrivacy(draft.privacy || "Everyone");
        setPostOptions(
          draft.options || {
            aiGenerated: false,
            allowComments: true,
            allowReuse: true,
            autoCheckSound: true,
          },
        );
        setSelectedSound(nextSound);
        setAudioClips(draft.audioClips || []);
        setSelectedAudioClipId(draft.audioClips?.[0]?.id || null);
        setAudioVolume(draft.audioVolume ?? 1);
        setCoverFrame(draft.coverFrame || nextClips[0]?.frames[0] || null);
        setSplitMarkers(draft.splitMarkers || []);
        setStage("edit");
        setMediaProgress(null);
      } catch (hydrateError) {
        hydratedObjectUrls.forEach((url) => URL.revokeObjectURL(url));

        if (!isActive) return;

        setError(
          hydrateError instanceof Error
            ? hydrateError.message
            : "Could not load this draft.",
        );
        setMediaProgress(null);
      }
    }

    void hydrateDraft();

    return () => {
      isActive = false;
    };
  }, [initialDraft]);

  useEffect(() => {
    if (!renderState.reelId || renderState.status !== "processing") {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const pollRenderStatus = async () => {
      try {
        const response = await fetch(`/api/reels/${renderState.reelId}/status`, {
          cache: "no-store",
        });
        const result = (await response.json()) as {
          error?: string;
          renderProgress?: number;
          renderStatus?: string;
          status?: string;
          targetStatus?: "draft" | "published";
        };

        if (cancelled) return;

        if (!response.ok) {
          throw new Error(result.error || "Could not check render progress.");
        }

        const progress =
          typeof result.renderProgress === "number"
            ? Math.max(0, Math.min(100, result.renderProgress))
            : 10;

        if (result.status === "failed" || result.renderStatus === "failed") {
          setRenderState((current) => ({
            ...current,
            error: result.error || "Could not process this reel.",
            progress,
            status: "failed",
            targetStatus: result.targetStatus || current.targetStatus,
          }));
          return;
        }

        if (result.status && result.status !== "processing") {
          setRenderState((current) => ({
            ...current,
            progress: 100,
            status: "complete",
            targetStatus: result.targetStatus || current.targetStatus,
          }));
          router.refresh();
          return;
        }

        setRenderState((current) => ({
          ...current,
          progress: Math.max(current.progress, progress),
          targetStatus: result.targetStatus || current.targetStatus,
        }));
        timeoutId = setTimeout(pollRenderStatus, 1200);
      } catch (pollError) {
        if (cancelled) return;

        setRenderState((current) => ({
          ...current,
          error:
            pollError instanceof Error
              ? pollError.message
              : "Could not check render progress.",
          status: "failed",
        }));
      }
    };

    timeoutId = setTimeout(pollRenderStatus, 700);

    return () => {
      cancelled = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [profilePath, renderState.reelId, renderState.status, router]);

  useEffect(() => {
    if (renderState.status !== "processing") {
      return;
    }

    const intervalId = setInterval(() => {
      setRenderState((current) => {
        if (current.status !== "processing") {
          return current;
        }

        return {
          ...current,
          progress: Math.min(92, current.progress + 2),
        };
      });
    }, 900);

    return () => clearInterval(intervalId);
  }, [renderState.status]);

  async function retryRender() {
    if (!renderState.reelId) return;

    setIsRetryingRender(true);

    try {
      const result = await retryReelRender(renderState.reelId);

      if (!result.ok) {
        setRenderState((current) => ({
          ...current,
          error: result.error,
          status: "failed",
        }));
        return;
      }

      setRenderState({
        progress: result.progress,
        reelId: result.reelId,
        status: "processing",
        targetStatus: result.targetStatus,
      });
    } catch {
      setRenderState((current) => ({
        ...current,
        error: "We could not restart processing right now. Please try again.",
        status: "failed",
      }));
    } finally {
      setIsRetryingRender(false);
    }
  }

  useEffect(() => {
    let isActive = true;

    if (selectedSound.id === "none" || !selectedSound.url) return;

    void createAudioWaveformPeaks(selectedSound)
      .then((peaks) => {
        if (isActive) {
          setAudioWaveform(peaks);
        }
      })
      .catch(() => {
        if (isActive) {
          setAudioWaveform([]);
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedSound]);

  async function addFiles(files: FileList | File[]) {
    const nextFiles = Array.from(files).filter((file) =>
      file.type.startsWith("video/") || /\.(mp4|mov)$/i.test(file.name),
    );

    if (!nextFiles.length) {
      setError("Choose at least one MP4 or MOV video clip.");
      return;
    }

    setError(null);

    try {
      nextFiles.forEach(validateReelVideoFile);
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : "This video does not match the upload specs.",
      );
      return;
    }

    const nextClips: ReelClip[] = [];

    try {
      for (const [index, file] of nextFiles.entries()) {
        const fileProgressStart = (index / nextFiles.length) * 100;
        const fileProgressSpan = 100 / nextFiles.length;
        setMediaProgress({
          label: `Importing clip ${index + 1} of ${nextFiles.length}`,
          progress: Math.round(fileProgressStart + fileProgressSpan * 0.1),
        });
        const id = uid();
        const url = URL.createObjectURL(file);
        let duration = 0;
        let frames: CoverFrame[] = [];

        try {
          duration = await readVideoDuration(url);

          if (duration > MAX_REEL_UPLOAD_DURATION_SECONDS) {
            throw new Error("Uploaded reels can be up to 10 minutes long.");
          }

          setMediaProgress({
            label: `Reading preview frames ${index + 1} of ${nextFiles.length}`,
            progress: Math.round(fileProgressStart + fileProgressSpan * 0.55),
          });
          frames = await captureFrames(url, id, duration);
        } catch (importError) {
          URL.revokeObjectURL(url);
          throw importError;
        }

        nextClips.push({
          id,
          file,
          url,
          duration,
          frames,
          baseTrimStart: 0,
          timelineStart: 0,
          trimStart: 0,
          trimEnd: duration,
          muted: false,
          volume: 1,
        });

        setMediaProgress({
          label: `Imported clip ${index + 1} of ${nextFiles.length}`,
          progress: Math.round(fileProgressStart + fileProgressSpan * 0.95),
        });
      }
    } catch (importError) {
      nextClips.forEach((clip) => URL.revokeObjectURL(clip.url));
      setError(
        importError instanceof Error
          ? importError.message
          : "Could not import this video.",
      );
      setMediaProgress(null);
      return;
    }

    const nextTotalDuration =
      totalDuration +
      nextClips.reduce((total, clip) => total + Math.max(0, clip.duration), 0);

    if (nextTotalDuration > MAX_REEL_UPLOAD_DURATION_SECONDS) {
      nextClips.forEach((clip) => URL.revokeObjectURL(clip.url));
      setError("Reels can be up to 10 minutes long.");
      setMediaProgress(null);
      return;
    }

    setClips((current) => {
      const timelineEnd = current.reduce(
        (end, clip) =>
          Math.max(
            end,
            clip.timelineStart + clip.trimEnd - clip.baseTrimStart,
          ),
        0,
      );
      let cursor = timelineEnd;

      return [
        ...current,
        ...nextClips.map((clip) => {
          const nextClip = { ...clip, timelineStart: cursor };
          cursor += clip.trimEnd - clip.baseTrimStart;
          return nextClip;
        }),
      ];
    });
    setSelectedClipId(nextClips[0]?.id || null);
    setStage("edit");
    setMediaProgress(null);
  }

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (files) void addFiles(files);
    event.target.value = "";
  }

  async function chooseAudioFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      setError("Choose an audio file.");
      return;
    }

    if (selectedSound.url) {
      URL.revokeObjectURL(selectedSound.url);
    }

    setAudioWaveform([]);
    const url = URL.createObjectURL(file);
    const duration = await readAudioDuration(url);
    const title = file.name.replace(/\.[^.]+$/, "");

    setSelectedSound({
      id: `upload-${uid()}`,
      artist: "Imported audio",
      duration,
      file,
      title,
      url,
    });
    const audioClipId = uid();
    setAudioClips([
      {
        id: audioClipId,
        baseTrimStart: 0,
        timelineStart: 0,
        trimStart: 0,
        trimEnd: Math.max(0.25, duration || sourceDuration),
        fadeIn: 0,
        fadeOut: 0,
      },
    ]);
    setSelectedAudioClipId(audioClipId);
    setAudioVolume(1);
    setVolumeTarget("audio");
    setSheet(null);
  }

  function selectSound(sound: Sound) {
    if (selectedSound.url && selectedSound.id !== sound.id) {
      URL.revokeObjectURL(selectedSound.url);
    }

    setAudioWaveform([]);
    setSelectedSound(sound);
    if (sound.id === "none") {
      setAudioClips([]);
      setSelectedAudioClipId(null);
    } else {
      const audioClipId = uid();
      setAudioClips([
        {
          id: audioClipId,
          baseTrimStart: 0,
          timelineStart: 0,
          trimStart: 0,
          trimEnd: Math.max(0.25, sound.duration || sourceDuration),
          fadeIn: 0,
          fadeOut: 0,
        },
      ]);
      setSelectedAudioClipId(audioClipId);
    }
    if (sound.id === "none") {
      setVolumeTarget("video");
    }

    setSheet(null);
  }

  function moveAudioClip(clipId: string, start: number, end: number) {
    void end;
    const audioClip =
      audioClips.find((clip) => clip.id === clipId) || selectedAudioClip;

    if (!audioClip) return;

    setAudioClips((current) =>
      current.map((clip) =>
        clip.id === audioClip.id
          ? {
              ...clip,
              timelineStart: start - (clip.trimStart - clip.baseTrimStart),
            }
          : clip,
      ),
    );
  }

  async function startRecording() {
    if (!canRecord) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }

    const stream = await navigator.mediaDevices
      .getUserMedia({ audio: true, video: { facingMode: "environment" } })
      .catch(() => null);

    if (!stream) {
      cameraInputRef.current?.click();
      return;
    }

    const mimeType = [
      "video/mp4;codecs=avc1,mp4a.40.2",
      "video/mp4",
      "video/quicktime",
    ].find((type) => MediaRecorder.isTypeSupported(type));

    if (!mimeType) {
      stream.getTracks().forEach((track) => track.stop());
      cameraInputRef.current?.click();
      return;
    }

    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const isQuickTime = mimeType === "video/quicktime";
      const blob = new Blob(chunks, { type: mimeType });
      const file = new File([blob], `recording-${Date.now()}.${isQuickTime ? "mov" : "mp4"}`, {
        type: isQuickTime ? "video/quicktime" : "video/mp4",
      });
      void addFiles([file]);
    };
    recorder.start();
    setIsRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  function reorderClip(clipId: string, targetIndex: number) {
    setClips((current) => {
      const currentIndex = current.findIndex((clip) => clip.id === clipId);

      if (currentIndex < 0) return current;

      const movingClip = current[currentIndex];
      const remainingClips = current.filter((clip) => clip.id !== clipId);
      const nextIndex = Math.max(
        0,
        Math.min(targetIndex, remainingClips.length),
      );
      const reorderedClips = [
        ...remainingClips.slice(0, nextIndex),
        movingClip,
        ...remainingClips.slice(nextIndex),
      ];
      let cursor = 0;

      return reorderedClips.map((clip) => {
        const trimInset = Math.max(0, clip.trimStart - clip.baseTrimStart);
        const nextClip = { ...clip, timelineStart: cursor - trimInset };
        cursor += Math.max(MIN_TIMELINE_CLIP_DURATION, clip.trimEnd - clip.trimStart);
        return nextClip;
      });
    });
  }

  function alignFirstVideoClipToStart(clipId: string) {
    setClips((current) => {
      const firstClip = current[0];

      if (!firstClip || firstClip.id !== clipId) return current;

      const firstVisualStart =
        firstClip.timelineStart + firstClip.trimStart - firstClip.baseTrimStart;

      if (firstVisualStart === 0) return current;

      return current.map((clip) => ({
        ...clip,
        timelineStart: clip.timelineStart - firstVisualStart,
      }));
    });
  }

  function updateSelectedClip(update: Partial<ReelClip>) {
    if (!selectedClip) return;
    setClips((current) =>
      current.map((clip) =>
        clip.id === selectedClip.id ? { ...clip, ...update } : clip,
      ),
    );
  }

  function setSelectedTrim(edge: "start" | "end", time: number) {
    if (!selectedClip) return;
    const selectedIndex = clips.findIndex((clip) => clip.id === selectedClip.id);

    if (edge === "start") {
      const firstClip = clips[0];
      const isFirstClip =
        selectedIndex === 0 && firstClip?.id === selectedClip.id;
      const selectedVisualEnd =
        selectedClip.timelineStart +
        selectedClip.trimEnd -
        selectedClip.baseTrimStart;
      const previousClip = selectedIndex > 0 ? clips[selectedIndex - 1] : null;
      const previousClipEnd = previousClip
        ? previousClip.timelineStart +
          previousClip.trimEnd -
          previousClip.baseTrimStart
        : 0;
      const minTrimStartByPreviousClip =
        isFirstClip
          ? 0
          : selectedClip.trimEnd -
            Math.max(
              MIN_TIMELINE_CLIP_DURATION,
              selectedVisualEnd - previousClipEnd,
            );
      const nextTrimStart = Math.max(
        minTrimStartByPreviousClip,
        Math.min(time, selectedClip.trimEnd - MIN_TIMELINE_CLIP_DURATION),
      );

      updateSelectedClip({
        timelineStart: isFirstClip
          ? selectedClip.baseTrimStart - nextTrimStart
          : selectedClip.timelineStart,
        trimStart: nextTrimStart,
      });
      return;
    }

    const selectedVisualStart =
      selectedClip.timelineStart +
      selectedClip.trimStart -
      selectedClip.baseTrimStart;
    const nextClip = selectedIndex >= 0 ? clips[selectedIndex + 1] : null;
    const nextClipStart = nextClip
      ? nextClip.timelineStart + nextClip.trimStart - nextClip.baseTrimStart
      : Number.POSITIVE_INFINITY;
    const maxTrimEndByNextClip =
      Number.isFinite(nextClipStart)
        ? selectedClip.trimStart +
          Math.max(MIN_TIMELINE_CLIP_DURATION, nextClipStart - selectedVisualStart)
        : selectedClip.duration;

    updateSelectedClip({
      trimEnd: Math.min(
        selectedClip.duration,
        maxTrimEndByNextClip,
        Math.max(time, selectedClip.trimStart + MIN_TIMELINE_CLIP_DURATION),
      ),
    });
  }

  function setSelectedAudioTrim(edge: "start" | "end", time: number) {
    if (!selectedAudioClip) return;

    const selectedIndex = audioClips.findIndex(
      (clip) => clip.id === selectedAudioClip.id,
    );
    const knownAudioDuration =
      selectedSound.duration && selectedSound.duration > 0
        ? selectedSound.duration
        : null;

    const nextDuration =
      knownAudioDuration ??
      Math.max(selectedAudioClip.trimEnd, time, sourceDuration, 0.25);

    if (edge === "start") {
      const selectedVisualEnd =
        selectedAudioClip.timelineStart +
        selectedAudioClip.trimEnd -
        selectedAudioClip.baseTrimStart;
      const previousClip =
        selectedIndex > 0 ? audioClips[selectedIndex - 1] : null;
      const previousClipEnd = previousClip
        ? previousClip.timelineStart +
          previousClip.trimEnd -
          previousClip.baseTrimStart
        : 0;
      const minTrimStartByPreviousClip =
        selectedAudioClip.trimEnd -
        Math.max(MIN_TIMELINE_CLIP_DURATION, selectedVisualEnd - previousClipEnd);
      const nextTrimStart = Math.max(
        minTrimStartByPreviousClip,
        Math.min(
          selectedAudioClip.baseTrimStart + time - selectedAudioClip.timelineStart,
          selectedAudioClip.trimEnd - MIN_TIMELINE_CLIP_DURATION,
        ),
      );

      setAudioClips((current) =>
        current.map((clip) =>
          clip.id === selectedAudioClip.id
            ? {
                ...clip,
                fadeIn: Math.min(clip.fadeIn, (clip.trimEnd - nextTrimStart) / 2),
                fadeOut: Math.min(clip.fadeOut, (clip.trimEnd - nextTrimStart) / 2),
                trimStart: nextTrimStart,
              }
            : clip,
        ),
      );
      return;
    }

    const selectedVisualStart =
      selectedAudioClip.timelineStart +
      selectedAudioClip.trimStart -
      selectedAudioClip.baseTrimStart;
    const nextClip = selectedIndex >= 0 ? audioClips[selectedIndex + 1] : null;
    const nextClipStart = nextClip
      ? nextClip.timelineStart + nextClip.trimStart - nextClip.baseTrimStart
      : Number.POSITIVE_INFINITY;
    const maxTrimEndByNextClip =
      Number.isFinite(nextClipStart)
        ? selectedAudioClip.trimStart +
          Math.max(MIN_TIMELINE_CLIP_DURATION, nextClipStart - selectedVisualStart)
        : nextDuration;
    const nextTrimEnd = Math.max(
      selectedAudioClip.trimStart + MIN_TIMELINE_CLIP_DURATION,
      Math.min(
        selectedAudioClip.baseTrimStart + time - selectedAudioClip.timelineStart,
        maxTrimEndByNextClip,
        nextDuration,
      ),
    );

    setAudioClips((current) =>
      current.map((clip) =>
        clip.id === selectedAudioClip.id
          ? {
              ...clip,
              fadeIn: Math.min(clip.fadeIn, (nextTrimEnd - clip.trimStart) / 2),
              fadeOut: Math.min(clip.fadeOut, (nextTrimEnd - clip.trimStart) / 2),
              trimEnd: nextTrimEnd,
            }
          : clip,
      ),
    );
  }

  function splitClip() {
    if (!clips.length) return;

    const clipUnderPlayhead = clips.find((clip) => {
      const start = clip.timelineStart + clip.trimStart - clip.baseTrimStart;
      const end = clip.timelineStart + clip.trimEnd - clip.baseTrimStart;

      return playhead > start + 0.01 && playhead < end - 0.01;
    });
    const clipToSplit = clipUnderPlayhead || selectedClip;

    if (!clipToSplit) return;

    const selectedClipTimelineStart =
      clipToSplit.timelineStart +
      clipToSplit.trimStart -
      clipToSplit.baseTrimStart;
    const splitAt = clipToSplit.trimStart + playhead - selectedClipTimelineStart;

    if (
      splitAt <= clipToSplit.trimStart + MIN_TIMELINE_CLIP_DURATION ||
      splitAt >= clipToSplit.trimEnd - MIN_TIMELINE_CLIP_DURATION
    ) {
      return;
    }

    const firstClip: ReelClip = {
      ...clipToSplit,
      id: uid(),
      baseTrimStart: clipToSplit.baseTrimStart,
      timelineStart: clipToSplit.timelineStart,
      trimEnd: splitAt,
    };
    const secondClip: ReelClip = {
      ...clipToSplit,
      id: uid(),
      baseTrimStart: clipToSplit.baseTrimStart,
      timelineStart: clipToSplit.timelineStart,
      trimStart: splitAt,
    };

    setClips((current) =>
      current.flatMap((clip) =>
        clip.id === clipToSplit.id ? [firstClip, secondClip] : [clip],
      ),
    );
    setSelectedClipId(secondClip.id);
    setSplitMarkers([]);
  }

  function splitAudioClip() {
    if (!audioClips.length) return;

    const audioClipUnderPlayhead = audioClips.find((clip) => {
      const start = clip.timelineStart + clip.trimStart - clip.baseTrimStart;
      const end = clip.timelineStart + clip.trimEnd - clip.baseTrimStart;

      return playhead > start + 0.01 && playhead < end - 0.01;
    });
    const clipToSplit = audioClipUnderPlayhead || selectedAudioClip;

    if (!clipToSplit) return;

    const selectedAudioClipTimelineStart =
      clipToSplit.timelineStart + clipToSplit.trimStart - clipToSplit.baseTrimStart;
    const splitAt =
      clipToSplit.trimStart + playhead - selectedAudioClipTimelineStart;

    if (
      splitAt <= clipToSplit.trimStart + MIN_TIMELINE_CLIP_DURATION ||
      splitAt >= clipToSplit.trimEnd - MIN_TIMELINE_CLIP_DURATION
    ) {
      return;
    }

    const firstClip: TimelineAudioClip = {
      ...clipToSplit,
      id: uid(),
      trimEnd: splitAt,
    };
    const secondClip: TimelineAudioClip = {
      ...clipToSplit,
      id: uid(),
      trimStart: splitAt,
    };

    setAudioClips((current) =>
      current.flatMap((clip) =>
        clip.id === clipToSplit.id ? [firstClip, secondClip] : [clip],
      ),
    );
    setSelectedAudioClipId(secondClip.id);
  }

  function deleteAudioClip() {
    if (!selectedAudioClip) return;

    setAudioClips((current) => {
      const deletedIndex = current.findIndex(
        (clip) => clip.id === selectedAudioClip.id,
      );
      const nextClips = current.filter((clip) => clip.id !== selectedAudioClip.id);
      const nextSelected =
        nextClips[Math.max(0, Math.min(deletedIndex, nextClips.length - 1))] ||
        null;

      setSelectedAudioClipId(nextSelected?.id || null);

      return nextClips;
    });
  }

  function updateSelectedAudioFade(update: Partial<Pick<TimelineAudioClip, "fadeIn" | "fadeOut">>) {
    if (!selectedAudioClip) return;

    setAudioClips((current) =>
      current.map((clip) => {
        if (clip.id !== selectedAudioClip.id) return clip;

        const duration = Math.max(
          MIN_TIMELINE_CLIP_DURATION,
          clip.trimEnd - clip.trimStart,
        );
        const maxFade = duration / 2;

        return {
          ...clip,
          fadeIn:
            update.fadeIn === undefined
              ? clip.fadeIn
              : Math.max(0, Math.min(update.fadeIn, maxFade)),
          fadeOut:
            update.fadeOut === undefined
              ? clip.fadeOut
              : Math.max(0, Math.min(update.fadeOut, maxFade)),
        };
      }),
    );
  }

  function deleteClip() {
    if (!selectedClip) return;
    const deletedClipId = selectedClip.id;
    const deletedClipUrl = selectedClip.url;

    setClips((current) => {
      const deletedIndex = current.findIndex((clip) => clip.id === deletedClipId);
      const nextClips = current.filter((clip) => clip.id !== deletedClipId);
      const nextSelected =
        nextClips[Math.max(0, Math.min(deletedIndex, nextClips.length - 1))];
      const nextSelectedIndex = nextSelected
        ? nextClips.findIndex((clip) => clip.id === nextSelected.id)
        : -1;
      const nextPlayhead =
        nextSelectedIndex > 0
          ? nextClips
              .slice(0, nextSelectedIndex)
              .reduce(
                (duration, clip) =>
                  duration + Math.max(0, clip.trimEnd - clip.trimStart),
                0,
              )
          : 0;

      setSelectedClipId(nextSelected?.id || null);
      setPlayhead(nextPlayhead);

      if (!nextClips.some((clip) => clip.url === deletedClipUrl)) {
        URL.revokeObjectURL(deletedClipUrl);
      }

      return nextClips;
    });
  }

  async function publishReel(status: "draft" | "published") {
    if (!clips.length) {
      setError("Add at least one clip.");
      return;
    }

    if (totalDuration > MAX_REEL_UPLOAD_DURATION_SECONDS) {
      setError("Reels can be up to 10 minutes long.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const uploads: Array<{
        clipId: string;
        mediaPath: string;
        mediaUrl?: string;
      }> = [];
      const uploadItemCount = clips.length + (selectedSound.file ? 1 : 0);
      let uploadedItems = 0;

      for (const [index, clip] of clips.entries()) {
        const upload = await uploadReelMedia("video", clip.file, (progress) => {
          setMediaProgress({
            label: `Uploading clip ${index + 1} of ${clips.length}`,
            progress: Math.round(
              ((uploadedItems + progress / 100) / uploadItemCount) * 100,
            ),
          });
        });

        uploads.push({
          clipId: clip.id,
          mediaPath: upload.mediaPath,
          mediaUrl: upload.mediaUrl,
        });
        uploadedItems += 1;
      }

      const primaryClip = clips[0];
      let audioUpload:
        | {
            mediaPath?: string;
            mediaUrl?: string;
          }
        | undefined;

      if (selectedSound.storedMediaPath) {
        audioUpload = { mediaPath: selectedSound.storedMediaPath };
      } else if (selectedSound.file) {
        audioUpload = await uploadReelMedia(
          "audio",
          selectedSound.file,
          (progress) => {
            setMediaProgress({
              label: "Uploading audio",
              progress: Math.round(
                ((uploadedItems + progress / 100) / uploadItemCount) * 100,
              ),
            });
          },
        );
        uploadedItems += 1;
      }

      setMediaProgress({
        label: "Preparing reel",
        progress: 100,
      });

      const clipEdits = clips.map((clip, index) => ({
        id: clip.id,
        order: index,
        duration: clip.duration,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
        baseTrimStart: clip.baseTrimStart,
        timelineStart: clip.timelineStart,
        muted: clip.muted,
        volume: clip.volume,
        mediaPath:
          uploads.find((upload) => upload.clipId === clip.id)?.mediaPath ||
          "",
      }));
      const renderPayload = {
        audioClips,
        audioMediaPath: audioUpload?.mediaPath,
        audioVolume,
        clips: clipEdits,
      };

      const response = await fetch("/api/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption,
          coverTime: selectedCoverFrame?.time || 0,
          editMetadata: {
            version: 1,
            clips: clipEdits,
            coverFrame: selectedCoverFrame,
            music: {
              artist: selectedSound.artist,
              duration: selectedSound.duration,
              id: selectedSound.id,
              mediaPath: audioUpload?.mediaPath,
              title: selectedSound.title,
            },
            audioTrim: hasAddedMusic ? effectiveAudioTrim : { start: 0, end: 0 },
            audioClips,
            audioVolume,
            location: postLocation || null,
            options: postOptions,
            privacy: postPrivacy,
            splitMarkers,
            totalDuration,
          },
          hashtags: Array.from(caption.matchAll(/#([a-z0-9_]{2,40})/gi))
            .map((match) => `#${match[1].toLowerCase()}`)
            .join(" "),
          listing: postLocation || undefined,
          previewMode: "fill",
          reelId: initialDraft?.reelId,
          renderPayload,
          soundId: selectedSound.id,
          splitMarkers,
          status,
          trimEnd: primaryClip?.trimEnd || 0,
          trimStart: primaryClip?.trimStart || 0,
          videoPath: clipEdits[0]?.mediaPath || "",
        }),
      });
      const result = await readJsonResponse<{
        error?: string;
        reelId?: string;
        renderProgress?: number;
        status?: string;
      }>(response, "Could not save this reel.");

      if (!response.ok) {
        throw new Error(result.error || "Could not save this reel.");
      }

      setMediaProgress(null);

      if (result.status === "processing" && result.reelId) {
        setRenderState({
          progress:
            typeof result.renderProgress === "number"
              ? result.renderProgress
              : 5,
          reelId: result.reelId,
          status: "processing",
          targetStatus: status,
        });
        setStage("post");
        return;
      }

      setRenderState({
        progress: 100,
        reelId: result.reelId || null,
        status: "complete",
        targetStatus: status,
      });
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this reel.",
      );
    } finally {
      setIsSaving(false);
      setMediaProgress(null);
    }
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black text-white">
      <input
        ref={fileInputRef}
        accept={REEL_VIDEO_UPLOAD_ACCEPT}
        className="hidden"
        multiple
        onChange={chooseFiles}
        type="file"
      />
      <input
        ref={audioInputRef}
        accept="audio/mpeg,audio/mp4,audio/wav,audio/x-wav,audio/aac,audio/ogg,audio/webm"
        className="hidden"
        onChange={chooseAudioFile}
        type="file"
      />
      <input
        ref={cameraInputRef}
        accept={REEL_VIDEO_UPLOAD_ACCEPT}
        capture="environment"
        className="hidden"
        onChange={chooseFiles}
        type="file"
      />

      {stage === "capture" ? (
        <CaptureScreen
          canRecord={canRecord}
          deviceModeLabel={getDeviceModeLabel(canRecord)}
          error={error}
          isRecording={isRecording}
          onBack={() => router.replace(profilePath)}
          onRecordEnd={stopRecording}
          onRecordStart={startRecording}
          onUpload={() => fileInputRef.current?.click()}
        />
      ) : null}

      {stage === "edit" ? (
        <TimelineScreen
          clips={clips}
          audioClips={audioClips}
          audioRef={audioRef}
          draggedClipId={draggedClipId}
          fileInputRef={fileInputRef}
          onAddClips={() => fileInputRef.current?.click()}
          onBack={() => setStage("capture")}
          onDeleteClip={deleteClip}
          onDeleteAudioClip={deleteAudioClip}
          onDragEnd={() => setDraggedClipId(null)}
          onDragStart={setDraggedClipId}
          onFade={() => setSheet("fade")}
          onMusic={() => setSheet("music")}
          onMoveAudio={moveAudioClip}
          onNext={() => setStage("post")}
          onNormalizeFirstVideoClip={alignFirstVideoClipToStart}
          onReorderClip={reorderClip}
          onCover={() => setSheet("cover")}
          onPlayheadChange={setPlayhead}
          onReplace={() => fileInputRef.current?.click()}
          onSelectClip={setSelectedClipId}
          onSelectAudioClip={setSelectedAudioClipId}
          onSplit={splitClip}
          onSplitAudio={splitAudioClip}
          onVolume={(target) => {
            setVolumeTarget(target);
            setSheet("volume");
          }}
          onTrimChange={setSelectedTrim}
          onTrimAudio={setSelectedAudioTrim}
          audioVolume={audioVolume}
          audioWaveform={audioWaveform}
          playhead={playhead}
          selectedClip={selectedClip}
          selectedAudioClip={selectedAudioClip}
          selectedSound={selectedSound}
          totalDuration={totalDuration}
          videoRef={videoRef}
        />
      ) : null}

      {stage === "post" ? (
        <PostScreen
          caption={caption}
          coverFrame={selectedCoverFrame}
          error={error}
          isSaving={isSaving}
          location={postLocation}
          onBack={() => setStage("edit")}
          onCaptionChange={setCaption}
          onCover={() => setSheet("cover")}
          onDraft={() => publishReel("draft")}
          onLocationChange={setPostLocation}
          onOptionsChange={setPostOptions}
          onPost={() => publishReel("published")}
          onPrivacyChange={setPostPrivacy}
          options={postOptions}
          privacy={postPrivacy}
          totalDuration={totalDuration}
        />
      ) : null}

      {sheet ? (
        <div className="absolute inset-0 z-50 flex justify-center">
          <div className="relative h-full w-full max-w-[430px]">
            {sheet === "music" ? (
              <MusicSheet
                onClose={() => setSheet(null)}
                onSelect={selectSound}
                onUpload={() => audioInputRef.current?.click()}
                selectedSound={selectedSound}
              />
            ) : null}

            {sheet === "cover" ? (
              <CoverSheet
                frames={allFrames}
                onClose={() => setSheet(null)}
                onSelect={(frame) => {
                  setCoverFrame(frame);
                  setSheet(null);
                }}
                selectedFrame={coverFrame}
              />
            ) : null}

            {sheet === "volume" ? (
              <VolumeSheet
                audioVolume={audioVolume}
                onAudioVolumeChange={setAudioVolume}
                onClose={() => setSheet(null)}
                onClipVolumeChange={(volume) =>
                  updateSelectedClip({ muted: false, volume })
                }
                selectedClip={selectedClip}
                selectedTimelineItem={volumeTarget}
                selectedSound={selectedSound}
              />
            ) : null}

            {sheet === "fade" ? (
              <AudioFadeSheet
                onClose={() => setSheet(null)}
                onFadeChange={updateSelectedAudioFade}
                selectedAudioClip={selectedAudioClip}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {renderState.status !== "idle" ? (
        <ReelProcessingOverlay
          error={renderState.error}
          onDismiss={() =>
            setRenderState({ progress: 0, reelId: null, status: "idle" })
          }
          onOpenProfile={() => {
            router.replace(profilePath);
            router.refresh();
          }}
          onRetry={retryRender}
          progress={renderState.progress}
          retrying={isRetryingRender}
          status={renderState.status}
          targetStatus={renderState.targetStatus}
        />
      ) : null}

      {mediaProgress ? (
        <MediaProgressOverlay
          label={mediaProgress.label}
          progress={mediaProgress.progress}
        />
      ) : null}
    </div>
  );
}

function MediaProgressOverlay({
  label,
  progress,
}: {
  label: string;
  progress: number;
}) {
  const normalizedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className="absolute inset-0 z-[60] grid place-items-center bg-black/72 px-6 backdrop-blur-sm">
      <div className="w-full max-w-[300px] rounded-[26px] border border-white/12 bg-[#111116] p-6 text-center shadow-2xl">
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-white/10">
          <Loader2 className="size-8 animate-spin text-white" />
        </div>
        <h2 className="mt-5 text-xl font-black">{label}</h2>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#5b35ff] to-[#f13eb8] transition-[width] duration-300 ease-out"
            style={{ width: `${normalizedProgress}%` }}
          />
        </div>
        <p className="mt-3 text-sm font-black text-white/60">
          {Math.round(normalizedProgress)}%
        </p>
      </div>
    </div>
  );
}

function ReelProcessingOverlay({
  error,
  onDismiss,
  onOpenProfile,
  onRetry,
  progress,
  retrying,
  status,
  targetStatus,
}: {
  error?: string;
  onDismiss: () => void;
  onOpenProfile: () => void;
  onRetry: () => void;
  progress: number;
  retrying: boolean;
  status: RenderState["status"];
  targetStatus?: RenderState["targetStatus"];
}) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const normalizedProgress = Math.max(0, Math.min(100, progress));
  const dashOffset = circumference * (1 - normalizedProgress / 100);
  const isFailed = status === "failed";
  const isComplete = status === "complete";
  const isDraft = targetStatus === "draft";
  const title = isFailed
    ? "Processing failed"
    : isComplete
      ? isDraft
        ? "Draft saved"
        : "Reel is live"
      : "Reel is processing";
  const description = isFailed
    ? "We saved your reel, but processing did not finish. This can happen if a video file is temporarily unavailable or the render worker hits a media issue."
    : isComplete
      ? isDraft
        ? "Your reel has been processed and saved to drafts."
        : "Your reel has been processed and published."
      : "Your reel is safely saved and rendering in the background. You can leave this page and check your profile later.";
  const friendlyReason = error
    ? error
        .replace(/FFmpeg/gi, "video processor")
        .replace(/exited with \d+/gi, "stopped unexpectedly")
    : null;

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/78 px-6 backdrop-blur-md">
      <div className="w-full max-w-[340px] rounded-[28px] border border-white/12 bg-[#111116] p-7 text-center shadow-2xl">
        <div className="mx-auto grid size-32 place-items-center">
          <svg className="size-32 -rotate-90" viewBox="0 0 120 120">
            <circle
              className="stroke-white/10"
              cx="60"
              cy="60"
              fill="none"
              r={radius}
              strokeWidth="10"
            />
            <circle
              className={cn(
                "transition-[stroke-dashoffset] duration-500 ease-out",
                isFailed
                  ? "stroke-red-400"
                  : isComplete
                    ? "stroke-[#22c55e]"
                    : "stroke-[#7c5cff]",
              )}
              cx="60"
              cy="60"
              fill="none"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeWidth="10"
            />
          </svg>
          <div className="absolute text-2xl font-black">
            {isFailed ? (
              "!"
            ) : isComplete ? (
              <Check className="size-10 text-[#22c55e]" />
            ) : (
              `${Math.round(normalizedProgress)}%`
            )}
          </div>
        </div>
        <h2 className="mt-5 text-2xl font-black">{title}</h2>
        <p className="mt-2 text-sm font-bold leading-6 text-white/62">
          {description}
        </p>
        {isFailed && friendlyReason ? (
          <p className="mt-4 rounded-2xl bg-red-500/12 px-4 py-3 text-left text-xs font-bold leading-5 text-red-100">
            Reason: {friendlyReason}
          </p>
        ) : null}
        {isFailed ? (
          <div className="mt-6 grid gap-3">
            <button
              className="h-12 w-full rounded-2xl bg-white text-sm font-black text-black disabled:opacity-60"
              disabled={retrying}
              onClick={onRetry}
              type="button"
            >
              {retrying ? "Retrying..." : "Retry processing"}
            </button>
            <button
              className="h-12 w-full rounded-2xl bg-white/10 text-sm font-black text-white"
              onClick={onDismiss}
              type="button"
            >
              Close
            </button>
          </div>
        ) : null}
        {!isFailed ? (
          <button
            className="mt-6 h-12 w-full rounded-2xl bg-white text-sm font-black text-black"
            onClick={onOpenProfile}
            type="button"
          >
            {isComplete ? "Open my profile" : "Leave and view profile"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CaptureScreen({
  canRecord,
  deviceModeLabel,
  error,
  isRecording,
  onBack,
  onRecordEnd,
  onRecordStart,
  onUpload,
}: {
  canRecord: boolean;
  deviceModeLabel: string;
  error: string | null;
  isRecording: boolean;
  onBack: () => void;
  onRecordEnd: () => void;
  onRecordStart: () => void;
  onUpload: () => void;
}) {
  return (
    <div className="relative mx-auto flex h-dvh max-w-[430px] flex-col overflow-hidden bg-[#07070b]">
      <button
        className="absolute left-4 top-5 z-20 grid size-11 place-items-center rounded-full bg-black/45"
        onClick={onBack}
        type="button"
      >
        <X className="size-6" />
      </button>
      <div className="absolute inset-x-0 top-5 z-10 flex justify-center px-16">
        <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-center text-[11px] font-black text-white/70 backdrop-blur">
          {deviceModeLabel}
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center px-8 text-center">
        <div>
          <div className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-white/10">
            <Clapperboard className="size-9" />
          </div>
          <h1 className="text-3xl font-black">Create reel</h1>
          <p className="mt-2 text-sm font-semibold text-white/55">
            Upload multiple clips, arrange them, trim them, and add music.
          </p>
          <p className="mx-auto mt-3 max-w-[280px] text-[11px] font-black leading-5 text-white/38">
            MP4 or MOV · up to 10 minutes · 1GB max · 1080 x 1920 recommended
          </p>
          {error ? (
            <p className="mt-4 rounded-xl bg-red-500/15 px-3 py-2 text-sm font-bold text-red-100">
              {error}
            </p>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 px-5 pb-7">
        {canRecord ? (
          <div className="mb-5 flex items-end justify-center gap-9">
            <button
              className="flex flex-col items-center gap-2 text-xs font-black text-white"
              onClick={onUpload}
              type="button"
            >
              <span className="grid size-14 place-items-center rounded-2xl bg-white/10">
                <Upload className="size-7" />
              </span>
              Upload
            </button>
            <button
              className={cn(
                "grid size-24 place-items-center rounded-full border-4 border-white",
                isRecording && "border-[#ff315f]",
              )}
              onPointerDown={onRecordStart}
              onPointerUp={onRecordEnd}
              type="button"
            >
              <span
                className={cn(
                  "size-16 rounded-full bg-white",
                  isRecording && "bg-[#ff315f]",
                )}
              />
            </button>
            <div className="flex flex-col items-center gap-2 text-xs font-black text-white/35">
              <span className="grid size-14 place-items-center rounded-2xl bg-white/5">
                <Camera className="size-7" />
              </span>
              Hold
            </div>
          </div>
        ) : (
          <div className="mb-5 flex justify-center">
            <button
              className="flex h-14 w-full max-w-xs items-center justify-center gap-3 rounded-full bg-white text-base font-black text-black"
              onClick={onUpload}
              type="button"
            >
              <Upload className="size-5" />
              Upload clips
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineScreen({
  clips,
  audioClips,
  audioRef,
  draggedClipId,
  fileInputRef,
  onCover,
  onAddClips,
  onBack,
  onDeleteClip,
  onDeleteAudioClip,
  onDragEnd,
  onDragStart,
  onFade,
  onMusic,
  onMoveAudio,
  onNext,
  onNormalizeFirstVideoClip,
  onPlayheadChange,
  onReorderClip,
  onReplace,
  onSelectClip,
  onSelectAudioClip,
  onSplit,
  onSplitAudio,
  onTrimAudio,
  onTrimChange,
  onVolume,
  audioVolume,
  audioWaveform,
  playhead,
  selectedClip,
  selectedAudioClip,
  selectedSound,
  totalDuration,
  videoRef,
}: {
  clips: ReelClip[];
  audioClips: TimelineAudioClip[];
  audioRef: RefObject<HTMLAudioElement | null>;
  draggedClipId: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAddClips: () => void;
  onBack: () => void;
  onDeleteClip: () => void;
  onDeleteAudioClip: () => void;
  onDragEnd: () => void;
  onDragStart: (clipId: string) => void;
  onFade: () => void;
  onMusic: () => void;
  onMoveAudio: (clipId: string, start: number, end: number) => void;
  onNext: () => void;
  onNormalizeFirstVideoClip: (clipId: string) => void;
  onCover: () => void;
  onPlayheadChange: (value: number) => void;
  onReorderClip: (clipId: string, targetIndex: number) => void;
  onReplace: () => void;
  onSelectClip: (clipId: string) => void;
  onSelectAudioClip: (clipId: string) => void;
  onSplit: () => void;
  onSplitAudio: () => void;
  onTrimAudio: (edge: "start" | "end", time: number) => void;
  onTrimChange: (edge: "start" | "end", time: number) => void;
  onVolume: (target: "video" | "audio") => void;
  audioVolume: number;
  audioWaveform: number[];
  playhead: number;
  selectedClip: ReelClip | null;
  selectedAudioClip: TimelineAudioClip | null;
  selectedSound: Sound;
  totalDuration: number;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTimelineItem, setSelectedTimelineItem] = useState<
    "video" | "audio"
  >("video");
  const [playbackClipId, setPlaybackClipId] = useState<string | null>(null);
  const [dragOverClipId, setDragOverClipId] = useState<string | null>(null);
  const [clipDragOffset, setClipDragOffset] = useState<{
    clipId: string;
    x: number;
  } | null>(null);
  const timelineScrollerRef = useRef<HTMLDivElement | null>(null);
  const timelineContentRef = useRef<HTMLDivElement | null>(null);
  const videoTrackRef = useRef<HTMLDivElement | null>(null);
  const actionToolbarRef = useRef<HTMLDivElement | null>(null);
  const isTimelineDraggingRef = useRef(false);
  const timelinePointerStartXRef = useRef(0);
  const timelineScrollStartRef = useRef(0);
  const didDragTimelineRef = useRef(false);
  const isActionToolbarDraggingRef = useRef(false);
  const actionToolbarPointerStartXRef = useRef(0);
  const actionToolbarScrollStartRef = useRef(0);
  const didDragActionToolbarRef = useRef(false);
  const resumePlaybackRef = useRef(false);
  const draggedClipIdRef = useRef<string | null>(null);
  const videoTrimGestureRef = useRef<{
    clipId: string;
    edge: "start" | "end";
    startX: number;
    scrollLeft: number;
    trimStart: number;
    trimEnd: number;
    duration: number;
  } | null>(null);
  const clipMoveGestureRef = useRef<{
    clipId: string;
    startX: number;
    scrollLeft: number;
    timelineStart: number;
    trimInset: number;
    duration: number;
    minVisualStart: number;
    maxVisualStart: number;
    startIndex: number;
    targetIndex: number;
  } | null>(null);
  const audioTrimGestureRef = useRef<{
    edge: "start" | "end";
    startX: number;
    scrollLeft: number;
    trimStart: number;
    trimEnd: number;
    duration: number;
  } | null>(null);
  const audioMoveGestureRef = useRef<{
    clipId: string;
    startX: number;
    scrollLeft: number;
    trimStart: number;
    trimEnd: number;
    duration: number;
  } | null>(null);
  const clipPixelsPerSecond = 34;
  const timelineSideSpacer = "calc((min(100vw, 430px) - 24px) / 2)";
  const sourceTimelineDuration = Math.max(
    1,
    clips.reduce((duration, clip) => duration + clip.duration, 0),
  );
  const hasMusic = selectedSound.id !== "none" && Boolean(selectedSound.url);
  const timelineSegments = useMemo(
    () =>
      clips.map((clip) => {
        const trimInset = Math.max(0, clip.trimStart - clip.baseTrimStart);
        const start = clip.timelineStart + trimInset;
        const duration = Math.max(0.25, clip.trimEnd - clip.trimStart);

        return {
          clip,
          duration,
          trimInset,
          start,
          end: start + duration,
        };
      }),
    [clips],
  );
  const audioSegments = useMemo(
    () =>
      audioClips.map((clip) => {
        const trimInset = Math.max(0, clip.trimStart - clip.baseTrimStart);
        const start = clip.timelineStart + trimInset;
        const duration = Math.max(0.25, clip.trimEnd - clip.trimStart);

        return {
          clip,
          duration,
          trimInset,
          start,
          end: start + duration,
        };
      }),
    [audioClips],
  );
  const playbackClip =
    clips.find((clip) => clip.id === playbackClipId) || selectedClip;
  const playbackSegment = timelineSegments.find(
    (segment) => segment.clip.id === playbackClip?.id,
  );
  const mediaTrackEnd = Math.max(
    0,
    ...timelineSegments.map((segment) => segment.end),
  );
  const timelineScaleDuration = Math.max(sourceTimelineDuration, totalDuration);
  const audioTrackEnd = hasMusic
    ? Math.max(0, ...audioSegments.map((segment) => segment.end))
    : 0;
  const audioEditDuration = Math.max(
    timelineScaleDuration,
    mediaTrackEnd,
    audioTrackEnd,
  ) + 30;
  const visualTimelineDuration = Math.max(
    timelineScaleDuration,
    mediaTrackEnd,
    audioTrackEnd,
  );
  const timelineTrackWidth = Math.max(
    340,
    visualTimelineDuration * clipPixelsPerSecond,
  );
  const rulerTicks = useMemo(() => {
    const tickStep = 2;
    const tickCount = Math.floor(visualTimelineDuration / tickStep);
    const ticks = Array.from(
      { length: tickCount + 1 },
      (_, index) => index * tickStep,
    );
    const finalTick = Math.ceil(visualTimelineDuration);

    return ticks.includes(finalTick) ? ticks : [...ticks, finalTick];
  }, [visualTimelineDuration]);
  const selectedAudioSegment = audioSegments.find(
    (segment) => segment.clip.id === selectedAudioClip?.id,
  );
  const maxAudioSegmentDuration = Math.max(
    0.25,
    ...audioSegments.map((segment) => segment.duration),
  );
  const maxAudioInset = Math.max(
    0,
    ...audioSegments.map((segment) => segment.trimInset),
  );
  const audioStripDuration = Math.max(
    selectedSound.duration || maxAudioSegmentDuration,
    maxAudioInset + maxAudioSegmentDuration,
  );
  const audioStripWidth = Math.max(
    maxAudioSegmentDuration * clipPixelsPerSecond,
    audioStripDuration * clipPixelsPerSecond,
  );
  const waveformBars = useMemo(() => {
    const barCount = Math.max(56, Math.ceil(audioStripWidth / 5));

    if (audioWaveform.length) {
      return Array.from({ length: barCount }, (_, index) => {
        const waveformIndex = Math.min(
          audioWaveform.length - 1,
          Math.floor((index / Math.max(1, barCount - 1)) * audioWaveform.length),
        );

        return audioWaveform[waveformIndex] || 8;
      });
    }

    return Array.from({ length: barCount }, (_, index) => {
      const value = Math.sin(index * 1.73) * 0.5 + Math.cos(index * 0.49) * 0.5;
      return 24 + Math.abs(value) * 58;
    });
  }, [audioStripWidth, audioWaveform]);
  const syncAudioForPlayhead = useCallback(
    (nextPlayhead: number, shouldPlay = false) => {
      const audio = audioRef.current;

      if (!hasMusic || !audio) return;

      const activeAudioSegment = audioSegments.find(
        (segment) =>
          nextPlayhead >= segment.start && nextPlayhead < segment.end,
      );
      const nextAudioTime = activeAudioSegment
        ? activeAudioSegment.clip.trimStart + nextPlayhead - activeAudioSegment.start
        : 0;

      if (audio.readyState === 0) {
        audio.load();
      }

      if (Math.abs(audio.currentTime - nextAudioTime) > 0.08) {
        audio.currentTime = nextAudioTime;
      }

      audio.muted = false;
      audio.volume = activeAudioSegment
        ? getFadeAdjustedVolume(activeAudioSegment, nextPlayhead, audioVolume)
        : audioVolume;

      if (!activeAudioSegment || audioVolume <= 0) {
        audio.pause();
        return;
      }

      if (shouldPlay) {
        void audio.play().catch(() => undefined);
      }
    },
    [
      audioRef,
      audioSegments,
      audioVolume,
      hasMusic,
    ],
  );

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !playbackClip) return;

    const shouldMute = playbackClip.muted || playbackClip.volume === 0;
    video.muted = shouldMute;
    video.defaultMuted = shouldMute;
    video.volume = shouldMute ? 0 : playbackClip.volume;

    if (
      resumePlaybackRef.current &&
      Math.abs(video.currentTime - playbackClip.trimStart) > 0.08
    ) {
      video.currentTime = playbackClip.trimStart;
    }

    if (resumePlaybackRef.current) {
      resumePlaybackRef.current = false;
      syncAudioForPlayhead(playhead, true);
      void video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [
    audioRef,
    audioVolume,
    hasMusic,
    playbackClip,
    playhead,
    syncAudioForPlayhead,
    videoRef,
  ]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = audioVolume;
    }
  }, [audioRef, audioVolume]);

  useEffect(() => {
    if (!isPlaying || !playbackSegment) return;

    let animationFrame = 0;
    const timelineContent = timelineContentRef.current;

    const syncTimelineDuringPlayback = () => {
      const video = videoRef.current;
      const audio = audioRef.current;

      if (video) {
        const nextPlayhead = Math.max(
          0,
          Math.min(
            totalDuration,
            playbackSegment.start +
              video.currentTime -
              playbackSegment.clip.trimStart,
          ),
        );

        onPlayheadChange(nextPlayhead);

        if (hasMusic && audio) {
          const activeAudioSegment = audioSegments.find(
            (segment) =>
              nextPlayhead >= segment.start && nextPlayhead < segment.end,
          );
          const nextAudioTime = activeAudioSegment
            ? activeAudioSegment.clip.trimStart + nextPlayhead - activeAudioSegment.start
            : 0;

          if (!activeAudioSegment || audioVolume <= 0) {
            audio.pause();
          } else {
            audio.muted = false;
            audio.volume = getFadeAdjustedVolume(
              activeAudioSegment,
              nextPlayhead,
              audioVolume,
            );

            if (Math.abs(audio.currentTime - nextAudioTime) > 0.2) {
              audio.currentTime = nextAudioTime;
            }

            if (audio.paused) {
              void audio.play().catch(() => undefined);
            }
          }
        }

        if (timelineScrollerRef.current) {
          const desiredScrollLeft = nextPlayhead * clipPixelsPerSecond;
          const wholePixelScrollLeft = Math.floor(desiredScrollLeft);
          const subpixelOffset = desiredScrollLeft - wholePixelScrollLeft;

          timelineScrollerRef.current.scrollLeft = wholePixelScrollLeft;

          if (timelineContent) {
            timelineContent.style.transform = `translate3d(${-subpixelOffset}px, 0, 0)`;
          }
        }
      }

      animationFrame = requestAnimationFrame(syncTimelineDuringPlayback);
    };

    animationFrame = requestAnimationFrame(syncTimelineDuringPlayback);

    return () => {
      cancelAnimationFrame(animationFrame);

      if (timelineContent) {
        timelineContent.style.transform = "translate3d(0, 0, 0)";
      }
    };
  }, [
    audioRef,
    audioSegments,
    audioVolume,
    clipPixelsPerSecond,
    hasMusic,
    isPlaying,
    onPlayheadChange,
    playbackSegment,
    totalDuration,
    videoRef,
  ]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      const activeSegment =
        timelineSegments.find(
          (segment) =>
            playhead >= segment.start && playhead < segment.end,
        ) || timelineSegments[0];

      if (activeSegment && activeSegment.clip.id !== playbackClip?.id) {
        resumePlaybackRef.current = true;
        setPlaybackClipId(activeSegment.clip.id);
        onPlayheadChange(activeSegment.start);
        scrollTimelineToPlayhead(activeSegment.start);
        return;
      }

      syncAudioForPlayhead(playhead, true);
      syncPreviewToTimeline(playhead);
      void video.play();
      setIsPlaying(true);
      return;
    }

    video.pause();
    audioRef.current?.pause();
    setIsPlaying(false);
  }

  function getTimelineTimeFromScroll(scroller: HTMLDivElement) {
    return Math.max(
      0,
      Math.min(
        visualTimelineDuration,
        scroller.scrollLeft / clipPixelsPerSecond,
      ),
    );
  }

  function syncPreviewToTimeline(nextPlayhead: number) {
    const activeSegment =
      timelineSegments.find(
        (segment) =>
          nextPlayhead >= segment.start && nextPlayhead < segment.end,
      ) || timelineSegments[timelineSegments.length - 1];

    if (!activeSegment) return;

    const isDifferentPlaybackClip = activeSegment.clip.id !== playbackClip?.id;

    if (isDifferentPlaybackClip) {
      setPlaybackClipId(activeSegment.clip.id);
    }

    const localTime = Math.max(
      activeSegment.clip.trimStart,
      Math.min(
        activeSegment.clip.trimEnd,
        activeSegment.clip.trimStart + nextPlayhead - activeSegment.start,
      ),
    );

    const video = videoRef.current;
    syncAudioForPlayhead(nextPlayhead);

    if (
      video &&
      !isDifferentPlaybackClip &&
      Math.abs(video.currentTime - localTime) > 0.08
    ) {
      video.currentTime = localTime;
    }
  }

  function scrollTimelineToPlayhead(nextPlayhead: number) {
    if (!timelineScrollerRef.current) return;

    const desiredScrollLeft = nextPlayhead * clipPixelsPerSecond;
    const wholePixelScrollLeft = Math.floor(desiredScrollLeft);
    const subpixelOffset = desiredScrollLeft - wholePixelScrollLeft;

    timelineScrollerRef.current.scrollLeft = wholePixelScrollLeft;

    if (timelineContentRef.current) {
      timelineContentRef.current.style.transform = `translate3d(${-subpixelOffset}px, 0, 0)`;
    }
  }

  function handleTimelineScroll(event: UIEvent<HTMLDivElement>) {
    const activeTrimGesture =
      videoTrimGestureRef.current ||
      audioTrimGestureRef.current ||
      audioMoveGestureRef.current ||
      clipMoveGestureRef.current;

    if (activeTrimGesture) {
      event.currentTarget.scrollLeft = activeTrimGesture.scrollLeft;
      return;
    }

    if (isPlaying && !isTimelineDraggingRef.current) return;

    if (timelineContentRef.current) {
      timelineContentRef.current.style.transform = "translate3d(0, 0, 0)";
    }

    const nextPlayhead = getTimelineTimeFromScroll(event.currentTarget);
    onPlayheadChange(nextPlayhead);
    syncPreviewToTimeline(nextPlayhead);
  }

  function handleTimelinePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest(
        "[data-timeline-control='true'], [data-timeline-item='true']",
      )
    ) {
      return;
    }

    isTimelineDraggingRef.current = true;
    videoRef.current?.pause();
    didDragTimelineRef.current = false;
    timelinePointerStartXRef.current = event.clientX;
    timelineScrollStartRef.current = event.currentTarget.scrollLeft;
    if (timelineContentRef.current) {
      timelineContentRef.current.style.transform = "translate3d(0, 0, 0)";
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleTimelinePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isTimelineDraggingRef.current) return;

    const dragOffset = timelinePointerStartXRef.current - event.clientX;

    if (Math.abs(dragOffset) > 3) {
      didDragTimelineRef.current = true;
    }

    event.currentTarget.scrollLeft = timelineScrollStartRef.current + dragOffset;
  }

  function handleTimelinePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!isTimelineDraggingRef.current) return;

    isTimelineDraggingRef.current = false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleTimelinePointerCancel(event: PointerEvent<HTMLDivElement>) {
    isTimelineDraggingRef.current = false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function beginVideoTrim(
    event: PointerEvent<HTMLButtonElement>,
    edge: "start" | "end",
  ) {
    if (!selectedClip) return;

    event.preventDefault();
    event.stopPropagation();
    videoRef.current?.pause();
    isTimelineDraggingRef.current = false;
    didDragTimelineRef.current = true;
    setSelectedTimelineItem("video");
    event.currentTarget.setPointerCapture(event.pointerId);
    videoTrimGestureRef.current = {
      clipId: selectedClip.id,
      edge,
      startX: event.clientX,
      scrollLeft: timelineScrollerRef.current?.scrollLeft || 0,
      trimStart: selectedClip.trimStart,
      trimEnd: selectedClip.trimEnd,
      duration: selectedClip.duration,
    };
  }

  function moveVideoTrim(event: PointerEvent<HTMLButtonElement>) {
    const gesture = videoTrimGestureRef.current;

    if (!gesture) return;

    event.preventDefault();
    event.stopPropagation();

    const deltaSeconds = (event.clientX - gesture.startX) / clipPixelsPerSecond;

    if (gesture.edge === "start") {
      const nextTrimStart = Math.max(
        0,
        Math.min(
          gesture.trimStart + deltaSeconds,
          gesture.trimEnd - MIN_TIMELINE_CLIP_DURATION,
        ),
      );

      onTrimChange(
        "start",
        nextTrimStart,
      );
      if (timelineScrollerRef.current) {
        timelineScrollerRef.current.scrollLeft = gesture.scrollLeft;
      }
      return;
    }

    onTrimChange(
      "end",
      Math.max(
        gesture.trimStart + MIN_TIMELINE_CLIP_DURATION,
        Math.min(gesture.trimEnd + deltaSeconds, gesture.duration),
      ),
    );

    if (timelineScrollerRef.current) {
      timelineScrollerRef.current.scrollLeft = gesture.scrollLeft;
    }
  }

  function endVideoTrim(event: PointerEvent<HTMLButtonElement>) {
    const gesture = videoTrimGestureRef.current;
    if (!gesture) return;

    event.preventDefault();
    event.stopPropagation();
    videoTrimGestureRef.current = null;
    didDragTimelineRef.current = false;

    if (gesture.edge === "start") {
      onNormalizeFirstVideoClip(gesture.clipId);
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function beginAudioTrim(
    event: PointerEvent<HTMLSpanElement>,
    edge: "start" | "end",
  ) {
    if (!selectedAudioSegment) return;

    event.preventDefault();
    event.stopPropagation();
    videoRef.current?.pause();
    isTimelineDraggingRef.current = false;
    didDragTimelineRef.current = true;
    setSelectedTimelineItem("audio");
    event.currentTarget.setPointerCapture(event.pointerId);
    audioTrimGestureRef.current = {
      edge,
      startX: event.clientX,
      scrollLeft: timelineScrollerRef.current?.scrollLeft || 0,
      trimStart: selectedAudioSegment.start,
      trimEnd: selectedAudioSegment.end,
      duration: audioEditDuration,
    };
  }

  function moveAudioTrim(event: PointerEvent<HTMLSpanElement>) {
    const gesture = audioTrimGestureRef.current;

    if (!gesture) return;

    event.preventDefault();
    event.stopPropagation();

    const deltaSeconds = (event.clientX - gesture.startX) / clipPixelsPerSecond;

    if (gesture.edge === "start") {
      onTrimAudio(
        "start",
        Math.max(
          0,
          Math.min(
            gesture.trimStart + deltaSeconds,
            gesture.trimEnd - MIN_TIMELINE_CLIP_DURATION,
          ),
        ),
      );
    } else {
      onTrimAudio(
        "end",
        Math.max(
          gesture.trimStart + MIN_TIMELINE_CLIP_DURATION,
          Math.min(gesture.trimEnd + deltaSeconds, gesture.duration),
        ),
      );
    }

    if (timelineScrollerRef.current) {
      timelineScrollerRef.current.scrollLeft = gesture.scrollLeft;
    }
  }

  function endAudioTrim(event: PointerEvent<HTMLSpanElement>) {
    if (!audioTrimGestureRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    audioTrimGestureRef.current = null;
    didDragTimelineRef.current = false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function beginAudioMove(
    event: PointerEvent<HTMLButtonElement>,
    clipId = selectedAudioClip?.id,
  ) {
    const segment =
      audioSegments.find((item) => item.clip.id === clipId) ||
      selectedAudioSegment;

    if (!segment) return;

    event.preventDefault();
    event.stopPropagation();
    videoRef.current?.pause();
    audioRef.current?.pause();
    setIsPlaying(false);
    isTimelineDraggingRef.current = false;
    didDragTimelineRef.current = true;
    setSelectedTimelineItem("audio");
    event.currentTarget.setPointerCapture(event.pointerId);
    audioMoveGestureRef.current = {
      clipId: segment.clip.id,
      startX: event.clientX,
      scrollLeft: timelineScrollerRef.current?.scrollLeft || 0,
      trimStart: segment.start,
      trimEnd: segment.end,
      duration: audioEditDuration,
    };
  }

  function moveAudioClip(event: PointerEvent<HTMLButtonElement>) {
    const gesture = audioMoveGestureRef.current;

    if (!gesture) return;

    event.preventDefault();
    event.stopPropagation();

    const deltaSeconds = (event.clientX - gesture.startX) / clipPixelsPerSecond;
    const clipDuration = Math.max(0.25, gesture.trimEnd - gesture.trimStart);
    const nextStart = Math.max(
      0,
      Math.min(gesture.trimStart + deltaSeconds, gesture.duration - clipDuration),
    );

    onMoveAudio(gesture.clipId, nextStart, nextStart + clipDuration);

    if (timelineScrollerRef.current) {
      timelineScrollerRef.current.scrollLeft = gesture.scrollLeft;
    }
  }

  function endAudioMove(event: PointerEvent<HTMLButtonElement>) {
    if (!audioMoveGestureRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    audioMoveGestureRef.current = null;
    didDragTimelineRef.current = false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function beginClipMove(event: PointerEvent<HTMLElement>, clipId: string) {
    const segment = timelineSegments.find((item) => item.clip.id === clipId);
    if (!segment) return;

    const clipIndex = timelineSegments.findIndex(
      (item) => item.clip.id === clipId,
    );

    event.preventDefault();
    event.stopPropagation();
    videoRef.current?.pause();
    audioRef.current?.pause();
    setIsPlaying(false);
    isTimelineDraggingRef.current = false;
    didDragTimelineRef.current = false;
    setSelectedTimelineItem("video");
    onSelectClip(clipId);
    setPlaybackClipId(clipId);
    setDragOverClipId(clipId);
    draggedClipIdRef.current = clipId;
    onDragStart(clipId);
    event.currentTarget.setPointerCapture(event.pointerId);
    clipMoveGestureRef.current = {
      clipId,
      startX: event.clientX,
      scrollLeft: timelineScrollerRef.current?.scrollLeft || 0,
      timelineStart: segment.clip.timelineStart,
      trimInset: segment.trimInset,
      duration: segment.duration,
      minVisualStart: 0,
      maxVisualStart: Math.max(0, audioEditDuration - segment.duration),
      startIndex: Math.max(0, clipIndex),
      targetIndex: Math.max(0, clipIndex),
    };
    setClipDragOffset({
      clipId,
      x: 0,
    });
  }

  function moveClipHandle(event: PointerEvent<HTMLElement>) {
    const gesture = clipMoveGestureRef.current;

    if (!gesture) return;

    event.preventDefault();
    event.stopPropagation();

    const deltaSeconds = (event.clientX - gesture.startX) / clipPixelsPerSecond;
    const hasMoved = Math.abs(event.clientX - gesture.startX) > 4;

    if (!hasMoved) return;

    didDragTimelineRef.current = true;
    setClipDragOffset((current) =>
      current?.clipId === gesture.clipId
        ? {
            ...current,
            x: event.clientX - gesture.startX,
          }
        : current,
    );

    const draggedCenter =
      gesture.timelineStart +
      gesture.trimInset +
      gesture.duration / 2 +
      deltaSeconds;
    const otherSegments = timelineSegments.filter(
      (segment) => segment.clip.id !== gesture.clipId,
    );
    const nextIndex = otherSegments.reduce((index, segment) => {
      const segmentCenter = segment.start + segment.duration / 2;
      return draggedCenter > segmentCenter ? index + 1 : index;
    }, 0);

    if (nextIndex !== gesture.targetIndex) {
      gesture.targetIndex = nextIndex;
    }

    if (timelineScrollerRef.current) {
      timelineScrollerRef.current.scrollLeft = gesture.scrollLeft;
    }
  }

  function endClipMove(event: PointerEvent<HTMLElement>) {
    const gesture = clipMoveGestureRef.current;

    if (!gesture) return;

    event.preventDefault();
    event.stopPropagation();
    clipMoveGestureRef.current = null;
    draggedClipIdRef.current = null;
    didDragTimelineRef.current = false;
    setDragOverClipId(null);
    setClipDragOffset(null);
    if (gesture.targetIndex !== gesture.startIndex) {
      onReorderClip(gesture.clipId, gesture.targetIndex);
    }
    onDragEnd();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function beginActionToolbarScroll(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-toolbar-action='true']")) {
      return;
    }

    isActionToolbarDraggingRef.current = true;
    didDragActionToolbarRef.current = false;
    actionToolbarPointerStartXRef.current = event.clientX;
    actionToolbarScrollStartRef.current = event.currentTarget.scrollLeft;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveActionToolbarScroll(event: PointerEvent<HTMLDivElement>) {
    if (!isActionToolbarDraggingRef.current) return;

    const dragOffset = event.clientX - actionToolbarPointerStartXRef.current;

    if (Math.abs(dragOffset) > 3) {
      didDragActionToolbarRef.current = true;
      event.preventDefault();
    }

    event.currentTarget.scrollLeft =
      actionToolbarScrollStartRef.current - dragOffset;
  }

  function endActionToolbarScroll(event: PointerEvent<HTMLDivElement>) {
    if (!isActionToolbarDraggingRef.current) return;

    isActionToolbarDraggingRef.current = false;
    didDragActionToolbarRef.current = false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleActionToolbarClick(event: MouseEvent<HTMLDivElement>) {
    if (!didDragActionToolbarRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    didDragActionToolbarRef.current = false;
  }

  function handleActionToolbarWheel(event: WheelEvent<HTMLDivElement>) {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    event.currentTarget.scrollLeft += event.deltaY;
  }

  return (
    <div className="relative mx-auto flex h-dvh max-w-[430px] flex-col overflow-hidden bg-black text-white">
      <div className="absolute left-4 top-5 z-20">
        <button
          className="grid size-12 place-items-center rounded-full bg-white/12"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft className="size-6" />
        </button>
      </div>
      <div className="absolute right-4 top-5 z-20 flex flex-col gap-3">
        <button
          className="grid size-12 place-items-center rounded-full bg-[#ff315f]"
          onClick={onNext}
          type="button"
        >
          <ChevronRight className="size-7" />
        </button>
        <button
          className="grid size-12 place-items-center rounded-full bg-white/12"
          onClick={onMusic}
          type="button"
        >
          <Music2 className="size-6" />
        </button>
      </div>

      <div className="shrink-0 px-16 pb-3 pt-16">
        <div className="relative mx-auto aspect-[9/14] max-h-[48dvh] overflow-hidden rounded-[28px] border border-white/30 bg-[#101014]">
          {selectedSound.url ? (
            <audio preload="metadata" ref={audioRef} src={selectedSound.url} />
          ) : null}
          {playbackClip ? (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted={playbackClip.muted || playbackClip.volume === 0}
              onLoadedMetadata={(event) => {
                const localTime =
                  playbackSegment &&
                  playhead >= playbackSegment.start &&
                  playhead <= playbackSegment.end
                    ? playbackSegment.clip.trimStart +
                      playhead -
                      playbackSegment.start
                    : playbackClip.trimStart;

                event.currentTarget.currentTime = Math.max(
                  playbackClip.trimStart,
                  Math.min(playbackClip.trimEnd, localTime),
                );
                const shouldMute =
                  playbackClip.muted || playbackClip.volume === 0;
                event.currentTarget.muted = shouldMute;
                event.currentTarget.defaultMuted = shouldMute;
                event.currentTarget.volume = shouldMute ? 0 : playbackClip.volume;
              }}
              onPause={() => {
                if (resumePlaybackRef.current) return;
                setIsPlaying(false);
              }}
              onPlay={() => {
                syncAudioForPlayhead(playhead, true);
                setIsPlaying(true);
              }}
              onTimeUpdate={(event) => {
                if (!isPlaying) return;

                const time = event.currentTarget.currentTime;
                const nextPlayhead = playbackSegment
                  ? playbackSegment.start + time - playbackSegment.clip.trimStart
                  : time;

                onPlayheadChange(
                  Math.max(0, Math.min(totalDuration, nextPlayhead)),
                );
                scrollTimelineToPlayhead(nextPlayhead);
                if (time >= playbackClip.trimEnd) {
                  const currentSegmentIndex = timelineSegments.findIndex(
                    (segment) => segment.clip.id === playbackClip.id,
                  );
                  const nextSegment = timelineSegments[currentSegmentIndex + 1];

                  if (nextSegment) {
                    resumePlaybackRef.current = true;
                    event.currentTarget.pause();
                    setPlaybackClipId(nextSegment.clip.id);
                    onPlayheadChange(nextSegment.start);
                    scrollTimelineToPlayhead(nextSegment.start);
                    return;
                  }

                  event.currentTarget.pause();
                  event.currentTarget.currentTime = playbackClip.trimStart;
                  audioRef.current?.pause();
                  setIsPlaying(false);
                }
              }}
              playsInline
              src={playbackClip.url}
            />
          ) : null}
        </div>
      </div>

      <div className="flex h-11 shrink-0 items-center justify-between px-4 text-sm font-bold text-white/70">
        <span>
          {formatTime(playhead)}/{formatTime(totalDuration)}
        </span>
        <button
          className="grid size-10 place-items-center rounded-full"
          onClick={togglePlay}
          type="button"
        >
          {isPlaying ? (
            <Pause className="size-7 fill-white text-white" />
          ) : (
            <Play className="ml-0.5 size-7 fill-white text-white" />
          )}
        </button>
        <span>{formatTime(totalDuration)}</span>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden px-3">
        <div className="pointer-events-none absolute left-1/2 top-7 z-20 h-[calc(100%-1.75rem)] w-0.5 -translate-x-1/2 bg-white" />
        <div
          className="h-full cursor-grab overflow-x-auto overflow-y-hidden pb-1 active:cursor-grabbing [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onPointerCancel={handleTimelinePointerCancel}
          onPointerDown={handleTimelinePointerDown}
          onPointerMove={handleTimelinePointerMove}
          onPointerUp={handleTimelinePointerUp}
          onScroll={handleTimelineScroll}
          ref={timelineScrollerRef}
        >
          <div className="flex will-change-transform" ref={timelineContentRef}>
            <div className="shrink-0" style={{ width: timelineSideSpacer }} />
            <div
              className="relative shrink-0"
              style={{ width: timelineTrackWidth }}
            >
              <div className="pointer-events-none absolute left-0 top-7 z-10 flex items-center">
                <span className="h-32 w-0.5 bg-[#ff315f]" />
              </div>
              <div className="relative mb-1 h-4 text-xs font-semibold text-white/45">
                {rulerTicks.map((tick) => (
                  <span
                    className="absolute top-0 -translate-x-1/2 whitespace-nowrap first:translate-x-0"
                    key={tick}
                    style={{ left: tick * clipPixelsPerSecond }}
                  >
                    {formatTime(tick)}
                  </span>
                ))}
              </div>
              <div className="relative h-20" ref={videoTrackRef}>
                {timelineSegments.map((segment) => {
                  const clip = segment.clip;
                  const isSelected =
                    selectedTimelineItem === "video" &&
                    selectedClip?.id === clip.id;
                  const dragOffset =
                    clipDragOffset?.clipId === clip.id ? clipDragOffset.x : 0;
                  const stripDuration = Math.max(
                    0.25,
                    clip.duration - clip.baseTrimStart,
                  );
                  const stripWidth = stripDuration * clipPixelsPerSecond;
                  const thumbnailCount = Math.max(
                    1,
                    Math.ceil(stripWidth / 42) + 1,
                  );
                  const timelineFrames = Array.from(
                    { length: thumbnailCount },
                    (_, index) => {
                      const progress =
                        thumbnailCount <= 1 ? 0 : index / (thumbnailCount - 1);
                      const sourceTime =
                        clip.baseTrimStart + progress * stripDuration;

                      return clip.frames.reduce<CoverFrame | null>(
                        (nearestFrame, frame) => {
                          if (!nearestFrame) return frame;

                          return Math.abs(frame.time - sourceTime) <
                            Math.abs(nearestFrame.time - sourceTime)
                            ? frame
                            : nearestFrame;
                        },
                        null,
                      );
                    },
                  ).filter((frame): frame is CoverFrame => Boolean(frame));

                  return (
                    <div
                      className={cn(
                        "relative h-16 shrink-0 touch-none overflow-hidden rounded-xl border-2 bg-white/10 transition-[left,opacity,border-color] duration-150",
                        isSelected
                          ? "border-[#8a62ff] shadow-[0_0_0_2px_rgba(255,255,255,0.95)]"
                          : "border-transparent",
                        draggedClipId === clip.id && "z-30 shadow-2xl",
                        dragOverClipId === clip.id &&
                          draggedClipId !== clip.id &&
                          "border-white/80",
                      )}
                      data-clip-id={clip.id}
                      data-timeline-item="true"
                      key={clip.id}
                      onDragStart={(event) => event.preventDefault()}
                      onClick={() => {
                        if (didDragTimelineRef.current) {
                          didDragTimelineRef.current = false;
                          return;
                        }

                        setSelectedTimelineItem("video");
                        onSelectClip(clip.id);
                        setPlaybackClipId(clip.id);
                      }}
                      style={{
                        left: segment.start * clipPixelsPerSecond,
                        position: "absolute",
                        top: 8,
                        transform: `translate3d(${dragOffset}px, 0, 0)`,
                        width: segment.duration * clipPixelsPerSecond,
                      }}
                    >
                      {isSelected ? (
                        <>
                          <button
                            aria-label="Trim start"
                            className="absolute inset-y-2 left-1 z-30 flex w-3 touch-none select-none items-center justify-center rounded-full text-black"
                            data-timeline-control="true"
                            draggable={false}
                            onPointerCancel={endVideoTrim}
                            onPointerDown={(event) =>
                              beginVideoTrim(event, "start")
                            }
                            onPointerMove={moveVideoTrim}
                            onPointerUp={endVideoTrim}
                            type="button"
                          >
                            <span className="flex h-9 w-2.5 items-center justify-center rounded-full bg-white text-[10px] font-black shadow-lg">
                              &#8249;
                            </span>
                          </button>
                          <button
                            aria-label="Trim end"
                            className="absolute inset-y-2 right-1 z-30 flex w-3 touch-none select-none items-center justify-center rounded-full text-black"
                            data-timeline-control="true"
                            draggable={false}
                            onPointerCancel={endVideoTrim}
                            onPointerDown={(event) =>
                              beginVideoTrim(event, "end")
                            }
                            onPointerMove={moveVideoTrim}
                            onPointerUp={endVideoTrim}
                            type="button"
                          >
                            <span className="flex h-9 w-2.5 items-center justify-center rounded-full bg-white text-[10px] font-black shadow-lg">
                              &#8250;
                            </span>
                          </button>
                        </>
                      ) : null}
                      <div
                        className="absolute inset-y-0 flex"
                        style={{
                          left: -segment.trimInset * clipPixelsPerSecond,
                          width: stripWidth,
                        }}
                      >
                        {timelineFrames.map((frame, index) => (
                          <span
                            className="h-full min-w-10 flex-1 overflow-hidden"
                            key={`${frame.clipId}-${frame.time}-${index}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- Canvas-generated data URL thumbnails are not remote/image-loader assets. */}
                            <img
                              alt=""
                              className="h-full w-full object-cover"
                              draggable={false}
                              src={frame.src}
                            />
                          </span>
                        ))}
                      </div>
                      {isSelected ? (
                        <span className="absolute left-9 top-1 rounded bg-[#8a62ff] px-1.5 py-0.5 text-[10px] font-black">
                          Selected
                        </span>
                      ) : null}
                      <span className="absolute bottom-1 left-1 z-20 flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-black text-white">
                        {clip.muted || clip.volume === 0 ? (
                          <>
                            <VolumeX className="size-3" />
                            Muted
                          </>
                        ) : (
                          <>
                            <Volume2 className="size-3" />
                            {Math.round(clip.volume * 100)}%
                          </>
                        )}
                      </span>
                      <span className="absolute bottom-1 right-8 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-black">
                        {formatTime(segment.duration)}
                      </span>
                      <span
                        aria-label="Move clip"
                        className="absolute right-1 top-1 z-30 grid size-8 cursor-grab place-items-center rounded-lg border border-black/15 bg-white text-black shadow-lg active:cursor-grabbing"
                        data-clip-draggable="true"
                        data-timeline-control="true"
                        draggable={false}
                        onClick={(event) => event.stopPropagation()}
                        onPointerCancel={endClipMove}
                        onPointerDown={(event) => beginClipMove(event, clip.id)}
                        onPointerMove={moveClipHandle}
                        onPointerUp={endClipMove}
                        role="button"
                        tabIndex={0}
                      >
                        <GripVertical className="size-5" />
                      </span>
                    </div>
                  );
                })}
                <button
                  className="absolute top-[13px] grid h-14 w-14 place-items-center rounded-2xl bg-white text-black"
                  data-timeline-control="true"
                  onClick={onAddClips}
                  style={{
                    left: mediaTrackEnd * clipPixelsPerSecond + 8,
                  }}
                  type="button"
                >
                  <Plus className="size-7" />
                </button>
              </div>
              <div
                className="relative mt-2 h-12"
                style={{ width: timelineTrackWidth }}
              >
                {hasMusic ? (
                  <>
                    {audioSegments.map((segment) => {
                      const isSelected =
                        selectedTimelineItem === "audio" &&
                        selectedAudioClip?.id === segment.clip.id;
                      const left = segment.start * clipPixelsPerSecond;
                      const width = segment.duration * clipPixelsPerSecond;
                      const fadeInWidth = Math.min(
                        width / 2,
                        segment.clip.fadeIn * clipPixelsPerSecond,
                      );
                      const fadeOutWidth = Math.min(
                        width / 2,
                        segment.clip.fadeOut * clipPixelsPerSecond,
                      );

                      return (
                        <div
                          className={cn(
                            "absolute inset-y-0 overflow-hidden rounded-lg bg-[#2d2d31] text-left",
                            isSelected &&
                              "border-2 border-[#8a62ff] shadow-[0_0_0_2px_rgba(255,255,255,0.92)]",
                          )}
                          key={segment.clip.id}
                          data-timeline-item="true"
                          onClick={() => {
                            if (didDragTimelineRef.current) {
                              didDragTimelineRef.current = false;
                              return;
                            }

                            setSelectedTimelineItem("audio");
                            onSelectAudioClip(segment.clip.id);
                          }}
                          role="button"
                          style={{ left, width }}
                          tabIndex={0}
                        >
                          <div
                            className="absolute inset-y-0 flex items-center gap-0.5 px-10"
                            style={{
                              left: -segment.trimInset * clipPixelsPerSecond,
                              width: audioStripWidth,
                            }}
                          >
                            {waveformBars.map((height, index) => (
                              <span
                                className="w-1 shrink-0 rounded-full bg-white/65"
                                key={index}
                                style={{ height: `${height}%` }}
                              />
                            ))}
                          </div>
                          {fadeInWidth > 0 ? (
                            <span
                              className="pointer-events-none absolute inset-y-0 left-0 z-10 border-r border-white/70 bg-gradient-to-r from-[#8a62ff]/80 to-transparent"
                              style={{
                                clipPath: "polygon(0 0, 100% 100%, 0 100%)",
                                width: fadeInWidth,
                              }}
                            >
                              <span className="absolute bottom-0.5 left-1 rounded bg-black/65 px-1 text-[9px] font-black text-white">
                                in {segment.clip.fadeIn.toFixed(1)}s
                              </span>
                            </span>
                          ) : null}
                          {fadeOutWidth > 0 ? (
                            <span
                              className="pointer-events-none absolute inset-y-0 right-0 z-10 border-l border-white/70 bg-gradient-to-l from-[#8a62ff]/80 to-transparent"
                              style={{
                                clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
                                width: fadeOutWidth,
                              }}
                            >
                              <span className="absolute bottom-0.5 right-1 rounded bg-black/65 px-1 text-[9px] font-black text-white">
                                out {segment.clip.fadeOut.toFixed(1)}s
                              </span>
                            </span>
                          ) : null}
                          <span className="absolute left-3 right-11 top-1/2 z-10 block -translate-y-1/2 truncate text-sm font-black">
                            {selectedSound.title}
                          </span>
                          <span className="absolute right-10 top-1/2 z-10 -translate-y-1/2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-black">
                            {formatTime(segment.duration)}
                          </span>
                          <button
                            aria-label="Move audio"
                            className="absolute right-1 top-1 z-20 grid size-7 touch-none place-items-center rounded-lg bg-black/70 text-white"
                            data-timeline-control="true"
                            onClick={(event) => event.stopPropagation()}
                            onPointerCancel={endAudioMove}
                            onPointerDown={(event) => {
                              onSelectAudioClip(segment.clip.id);
                              setSelectedTimelineItem("audio");
                              beginAudioMove(event, segment.clip.id);
                            }}
                            onPointerMove={moveAudioClip}
                            onPointerUp={endAudioMove}
                            type="button"
                          >
                            <GripVertical className="size-5" />
                          </button>
                        </div>
                      );
                    })}
                    {selectedTimelineItem === "audio" && selectedAudioSegment ? (
                      <>
                        <span
                          aria-label="Trim audio start"
                          className="absolute inset-y-2 z-20 flex w-3 touch-none select-none items-center justify-center rounded-full text-black"
                          data-timeline-control="true"
                          onPointerCancel={endAudioTrim}
                          onPointerDown={(event) =>
                            beginAudioTrim(event, "start")
                          }
                          onPointerMove={moveAudioTrim}
                          onPointerUp={endAudioTrim}
                          role="button"
                          style={{
                            left: selectedAudioSegment.start * clipPixelsPerSecond,
                          }}
                          tabIndex={0}
                        >
                          <span className="flex h-8 w-2.5 items-center justify-center rounded-full bg-white text-[10px] font-black shadow-lg">
                            &#8249;
                          </span>
                        </span>
                        <span
                          aria-label="Trim audio end"
                          className="absolute inset-y-2 z-20 flex w-3 -translate-x-full touch-none select-none items-center justify-center rounded-full text-black"
                          data-timeline-control="true"
                          onPointerCancel={endAudioTrim}
                          onPointerDown={(event) =>
                            beginAudioTrim(event, "end")
                          }
                          onPointerMove={moveAudioTrim}
                          onPointerUp={endAudioTrim}
                          role="button"
                          style={{
                            left: selectedAudioSegment.end * clipPixelsPerSecond,
                          }}
                          tabIndex={0}
                        >
                          <span className="flex h-8 w-2.5 items-center justify-center rounded-full bg-white text-[10px] font-black shadow-lg">
                            &#8250;
                          </span>
                        </span>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
            <div className="shrink-0" style={{ width: timelineSideSpacer }} />
          </div>
        </div>

      </div>

      <div
        className="flex h-28 w-full max-w-full shrink-0 cursor-grab touch-pan-x gap-2 overflow-x-auto overscroll-x-contain px-3 pb-4 pr-12 pt-2 active:cursor-grabbing [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onClickCapture={handleActionToolbarClick}
        onPointerCancel={endActionToolbarScroll}
        onPointerDown={beginActionToolbarScroll}
        onPointerMove={moveActionToolbarScroll}
        onPointerUp={endActionToolbarScroll}
        onWheel={handleActionToolbarWheel}
        ref={actionToolbarRef}
      >
        <TimelineTool
          icon={Scissors}
          label="Split"
          onClick={selectedTimelineItem === "audio" ? onSplitAudio : onSplit}
        />
        {selectedTimelineItem === "video" && selectedClip ? (
          <TimelineTool
            icon={Volume2}
            label={`${Math.round((selectedClip.muted ? 0 : selectedClip.volume) * 100)}%`}
            onClick={() => onVolume("video")}
          />
        ) : null}
        {selectedTimelineItem === "audio" && selectedSound.id !== "none" ? (
          <TimelineTool
            icon={Volume2}
            label={`${Math.round(audioVolume * 100)}%`}
            onClick={() => onVolume("audio")}
          />
        ) : null}
        {selectedTimelineItem === "audio" && selectedAudioClip ? (
          <TimelineTool icon={Sparkles} label="Fade" onClick={onFade} />
        ) : null}
        <TimelineTool icon={Upload} label="Replace" onClick={onReplace} />
        <TimelineTool
          icon={Trash2}
          label="Delete"
          onClick={
            selectedTimelineItem === "audio" ? onDeleteAudioClip : onDeleteClip
          }
        />
        <TimelineTool
          icon={RotateCcw}
          label="Reset"
          onClick={() => fileInputRef.current?.click()}
        />
        <TimelineTool icon={ImageIcon} label="Cover" onClick={onCover} />
      </div>
    </div>
  );
}

function TimelineTool({
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
      className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl bg-white/10 text-xs font-black"
      data-toolbar-action="true"
      onClick={onClick}
      type="button"
    >
      <Icon className="size-6" />
      {label}
    </button>
  );
}

function VolumeSheet({
  audioVolume,
  onAudioVolumeChange,
  onClipVolumeChange,
  onClose,
  selectedClip,
  selectedSound,
  selectedTimelineItem,
}: {
  audioVolume: number;
  onAudioVolumeChange: (volume: number) => void;
  onClipVolumeChange: (volume: number) => void;
  onClose: () => void;
  selectedClip: ReelClip | null;
  selectedSound: Sound;
  selectedTimelineItem: "video" | "audio";
}) {
  const isVideo = selectedTimelineItem === "video";
  const value = isVideo
    ? selectedClip?.muted
      ? 0
      : selectedClip?.volume ?? 1
    : audioVolume;
  const label = isVideo ? "Clip volume" : `${selectedSound.title} volume`;

  return (
    <div className="absolute inset-0 flex items-end bg-black/45">
      <div className="w-full rounded-t-[28px] bg-white px-5 pb-7 pt-3 text-black">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-black/15" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-black">Volume</h2>
          <button
            className="grid size-10 place-items-center rounded-full bg-black/5"
            onClick={onClose}
            type="button"
          >
            <X className="size-6" />
          </button>
        </div>
        <div className="rounded-2xl bg-black/[0.04] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-base font-black">{label}</span>
            <span className="text-sm font-black text-black/45">
              {Math.round(value * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <VolumeX className="size-5 text-black/45" />
            <input
              aria-label={label}
              className="h-2 flex-1 accent-[#8a62ff]"
              max={100}
              min={0}
              onChange={(event) => {
                const nextVolume = Number(event.target.value) / 100;

                if (isVideo) {
                  onClipVolumeChange(nextVolume);
                  return;
                }

                onAudioVolumeChange(nextVolume);
              }}
              type="range"
              value={Math.round(value * 100)}
            />
            <Volume2 className="size-5 text-black/45" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AudioFadeSheet({
  onClose,
  onFadeChange,
  selectedAudioClip,
}: {
  onClose: () => void;
  onFadeChange: (update: Partial<Pick<TimelineAudioClip, "fadeIn" | "fadeOut">>) => void;
  selectedAudioClip: TimelineAudioClip | null;
}) {
  const duration = selectedAudioClip
    ? Math.max(MIN_TIMELINE_CLIP_DURATION, selectedAudioClip.trimEnd - selectedAudioClip.trimStart)
    : MIN_TIMELINE_CLIP_DURATION;
  const maxFade = Math.max(0, duration / 2);

  return (
    <div className="absolute inset-0 flex items-end bg-black/45">
      <div className="w-full rounded-t-[28px] bg-white px-5 pb-7 pt-3 text-black">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-black/15" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-black">Audio fades</h2>
          <button
            className="grid size-10 place-items-center rounded-full bg-black/5"
            onClick={onClose}
            type="button"
          >
            <X className="size-6" />
          </button>
        </div>

        <div className="space-y-3">
          <AudioFadeControl
            label="Fade in"
            maxFade={maxFade}
            onChange={(fadeIn) => onFadeChange({ fadeIn })}
            value={selectedAudioClip?.fadeIn || 0}
          />
          <AudioFadeControl
            label="Fade out"
            maxFade={maxFade}
            onChange={(fadeOut) => onFadeChange({ fadeOut })}
            value={selectedAudioClip?.fadeOut || 0}
          />
        </div>
      </div>
    </div>
  );
}

function AudioFadeControl({
  label,
  maxFade,
  onChange,
  value,
}: {
  label: string;
  maxFade: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-black/[0.04] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-base font-black">{label}</span>
        <span className="text-sm font-black text-black/45">
          {value.toFixed(1)}s
        </span>
      </div>
      <input
        aria-label={label}
        className="h-2 w-full accent-[#8a62ff]"
        max={Math.max(0, maxFade)}
        min={0}
        onChange={(event) => onChange(Number(event.target.value))}
        step={0.1}
        type="range"
        value={Math.min(value, maxFade)}
      />
    </div>
  );
}

type MusicTab = "library" | "jamendo" | "freesound";

// Module-level cache — survives sheet close/reopen for the page session
const _musicCache: {
  library: LibraryTrack[] | null;
  jamendo: Map<string, ExternalTrack[]>;
  freesound: Map<string, ExternalTrack[]>;
} = { library: null, jamendo: new Map(), freesound: new Map() };

const JAMENDO_TAGS: Array<{ id: string; label: string }> = [
  { id: "", label: "All" },
  { id: "ambient", label: "Ambient" },
  { id: "electronic", label: "Electronic" },
  { id: "pop", label: "Pop" },
  { id: "rock", label: "Rock" },
  { id: "jazz", label: "Jazz" },
  { id: "classical", label: "Classical" },
  { id: "hiphop", label: "Hip-Hop" },
  { id: "soundtrack", label: "Soundtracks" },
  { id: "lounge", label: "Lounge" },
  { id: "folk", label: "Folk" },
];

const FREESOUND_TAGS: Array<{ id: string; label: string }> = [
  { id: "", label: "All" },
  { id: "ambient", label: "Ambient" },
  { id: "piano", label: "Piano" },
  { id: "electronic", label: "Electronic" },
  { id: "acoustic", label: "Acoustic" },
  { id: "guitar", label: "Guitar" },
  { id: "cinematic", label: "Cinematic" },
  { id: "lofi", label: "Lo-Fi" },
  { id: "nature", label: "Nature" },
  { id: "drums", label: "Drums" },
];

function MusicSheet({
  onClose,
  onSelect,
  onUpload,
  selectedSound,
}: {
  onClose: () => void;
  onSelect: (sound: Sound) => void;
  onUpload: () => void;
  selectedSound: Sound;
}) {
  const [tab, setTab] = useState<MusicTab>("library");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [libraryTracks, setLibraryTracks] = useState<LibraryTrack[]>(
    _musicCache.library ?? [],
  );
  const [externalTracks, setExternalTracks] = useState<ExternalTrack[]>([]);
  const [isLoading, setIsLoading] = useState(!_musicCache.library);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (_musicCache.library) return;
    getLibraryTracks()
      .then((tracks) => {
        _musicCache.library = tracks;
        setLibraryTracks(tracks);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "library") return;
    const cacheMap = tab === "jamendo" ? _musicCache.jamendo : _musicCache.freesound;
    const cacheKey = `${query}::${category}`;
    const cached = cacheMap.get(cacheKey);
    let isActive = true;
    const timer = setTimeout(async () => {
      if (cached) {
        setExternalTracks(cached);
        setHasSearched(true);
        setSearchError(null);
        setIsLoading(false);
        return;
      }

      setExternalTracks([]);
      setSearchError(null);
      setHasSearched(false);
      setIsLoading(true);

      try {
        const results =
          tab === "jamendo"
            ? await searchJamendo(query, category || undefined)
            : await searchFreesoundTracks(query, category || undefined);
        if (!isActive) return;
        cacheMap.set(cacheKey, results);
        setExternalTracks(results);
        setHasSearched(true);
      } catch (err) {
        if (!isActive) return;
        setSearchError(err instanceof Error ? err.message : "Search failed.");
        setHasSearched(true);
      } finally {
        if (!isActive) return;
        setIsLoading(false);
      }
    }, cached || !query ? 0 : 500);
    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [tab, query, category]);

  function togglePreview(id: string, url: string) {
    if (previewId === id) {
      audioRef.current?.pause();
      setPreviewId(null);
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.addEventListener("ended", () => setPreviewId(null));
      }
      audioRef.current.src = url;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      setPreviewId(id);
    }
  }

  function stopPreview() {
    audioRef.current?.pause();
    setPreviewId(null);
  }

  function handleSelectLibrary(track: LibraryTrack) {
    stopPreview();
    onSelect({
      id: `library_${track.id}`,
      title: track.title,
      artist: track.artist,
      url: track.audioUrl,
      duration: track.durationSeconds || undefined,
      storedMediaPath: track.audioUrl.startsWith("/media/")
        ? track.audioUrl.slice("/media/".length)
        : track.audioUrl,
    });
  }

  function handleSelectExternal(track: ExternalTrack) {
    stopPreview();
    onSelect({
      id: track.id,
      title: track.title,
      artist: track.artist,
      url: track.audioUrl,
      duration: track.durationSeconds || undefined,
    });
  }

  function handleNoMusic() {
    stopPreview();
    onSelect(sounds[0]);
  }

  const uploadedSound =
    selectedSound.id !== "none" &&
    selectedSound.url &&
    !selectedSound.id.startsWith("library_") &&
    !selectedSound.id.startsWith("jamendo_") &&
    !selectedSound.id.startsWith("freesound_")
      ? selectedSound
      : null;

  const tabs: Array<{ id: MusicTab; label: string }> = [
    { id: "library", label: "Library" },
    { id: "jamendo", label: "Jamendo" },
    { id: "freesound", label: "Freesound" },
  ];

  const externalTabActive = tab === "jamendo" || tab === "freesound";

  return (
    <div className="absolute inset-0 flex flex-col bg-black/55">
      <button
        aria-label="Close sounds"
        className="flex-1"
        onClick={() => {
          stopPreview();
          onClose();
        }}
        type="button"
      />
      <div className="flex max-h-[80dvh] flex-col rounded-t-[28px] bg-white text-black">
        <div className="mx-auto mt-3 h-1 w-12 shrink-0 rounded-full bg-black/15" />

        <div className="flex items-center justify-between px-5 py-4 shrink-0">
          <h2 className="text-2xl font-black">Sounds</h2>
          <button
            className="grid size-10 place-items-center rounded-full bg-black/5"
            onClick={() => {
              stopPreview();
              onClose();
            }}
            type="button"
          >
            <X className="size-6" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-black/10 px-5 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setQuery("");
                setCategory("");
                setExternalTracks([]);
                setSearchError(null);
                setHasSearched(false);
              }}
              className={cn(
                "pb-2 px-3 text-sm font-black transition border-b-2 -mb-px",
                tab === t.id
                  ? "border-[#8a62ff] text-[#8a62ff]"
                  : "border-transparent text-black/45 hover:text-black/70",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {externalTabActive ? (
          <div className="px-5 pt-3 pb-1 shrink-0 space-y-2">
            <div className="flex items-center gap-2 rounded-xl bg-black/[0.06] px-3 py-2.5">
              <Search className="size-4 shrink-0 text-black/40" />
              <input
                type="search"
                placeholder={`Search ${tab === "jamendo" ? "Jamendo" : "Freesound"}…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-black/35"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {(tab === "jamendo" ? JAMENDO_TAGS : FREESOUND_TAGS).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-black transition",
                    category === cat.id
                      ? "bg-[#8a62ff] text-white"
                      : "bg-black/[0.07] text-black/60 hover:bg-black/[0.12]",
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
          <div className="space-y-2">
            <button
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition",
                selectedSound.id === "none"
                  ? "border-2 border-[#8a62ff] bg-black/[0.04]"
                  : "bg-black/[0.04] hover:bg-black/[0.07]",
              )}
              onClick={handleNoMusic}
              type="button"
            >
              <span className="grid size-11 place-items-center rounded-full bg-black text-white">
                <Pause className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-black">No music</span>
                <span className="block truncate text-sm font-semibold text-black/40">
                  Muted
                </span>
              </span>
              {selectedSound.id === "none" ? (
                <Check className="size-6 text-[#ff315f]" />
              ) : null}
            </button>

            <button
              className="flex w-full items-center gap-3 rounded-2xl bg-[#8a62ff] px-3 py-3 text-left text-white transition hover:opacity-90"
              onClick={() => {
                stopPreview();
                onUpload();
              }}
              type="button"
            >
              <span className="grid size-11 place-items-center rounded-full bg-white/15">
                <Upload className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-black">
                  Upload your own
                </span>
                <span className="block truncate text-sm font-semibold text-white/65">
                  MP3, M4A, WAV, AAC, OGG
                </span>
              </span>
              <ChevronRight className="size-5" />
            </button>

            {uploadedSound ? (
              <MusicTrackRow
                id={uploadedSound.id}
                title={uploadedSound.title}
                artist={uploadedSound.artist}
                audioUrl={uploadedSound.url!}
                coverUrl={null}
                durationSeconds={uploadedSound.duration}
                isSelected={selectedSound.id === uploadedSound.id}
                isPreviewing={previewId === uploadedSound.id}
                onPreview={togglePreview}
                onSelect={() => {
                  stopPreview();
                  onSelect(uploadedSound);
                }}
              />
            ) : null}

            {tab === "library" ? (
              isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-black/30" />
                </div>
              ) : libraryTracks.length === 0 ? (
                <div className="py-8 text-center">
                  <Music2 className="mx-auto mb-2 size-7 text-black/20" />
                  <p className="text-sm font-semibold text-black/40">
                    No library tracks yet
                  </p>
                  <p className="mt-0.5 text-xs text-black/30">
                    Browse Jamendo or Freesound, or upload your own.
                  </p>
                </div>
              ) : (
                libraryTracks.map((track) => (
                  <MusicTrackRow
                    key={track.id}
                    id={`library_${track.id}`}
                    title={track.title}
                    artist={track.artist}
                    audioUrl={track.audioUrl}
                    coverUrl={track.coverUrl}
                    durationSeconds={track.durationSeconds}
                    genre={track.genre ?? undefined}
                    isSelected={selectedSound.id === `library_${track.id}`}
                    isPreviewing={previewId === `library_${track.id}`}
                    onPreview={togglePreview}
                    onSelect={() => handleSelectLibrary(track)}
                  />
                ))
              )
            ) : externalTabActive ? (
              isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-black/30" />
                </div>
              ) : searchError ? (
                <div className="py-6 text-center">
                  <p className="text-sm font-semibold text-red-500">{searchError}</p>
                  <p className="mt-1 text-xs text-black/40">Check your API key in Admin → Settings → Music APIs.</p>
                </div>
              ) : !hasSearched ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-black/30" />
                </div>
              ) : externalTracks.length === 0 ? (
                <div className="py-8 text-center">
                  <Search className="mx-auto mb-2 size-7 text-black/20" />
                  <p className="text-sm font-semibold text-black/40">No results found</p>
                  <p className="mt-0.5 text-xs text-black/30">Try a different search term.</p>
                </div>
              ) : (
                externalTracks.map((track) => (
                  <MusicTrackRow
                    key={track.id}
                    id={track.id}
                    title={track.title}
                    artist={track.artist}
                    audioUrl={track.audioUrl}
                    coverUrl={track.coverUrl}
                    durationSeconds={track.durationSeconds}
                    isSelected={selectedSound.id === track.id}
                    isPreviewing={previewId === track.id}
                    onPreview={togglePreview}
                    onSelect={() => handleSelectExternal(track)}
                  />
                ))
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function MusicTrackRow({
  id,
  title,
  artist,
  audioUrl,
  coverUrl,
  durationSeconds,
  genre,
  isSelected,
  isPreviewing,
  onPreview,
  onSelect,
}: {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  coverUrl: string | null | undefined;
  durationSeconds: number | undefined;
  genre?: string;
  isSelected: boolean;
  isPreviewing: boolean;
  onPreview: (id: string, url: string) => void;
  onSelect: () => void;
}) {
  const minutes = Math.floor((durationSeconds ?? 0) / 60);
  const seconds = (durationSeconds ?? 0) % 60;
  const durationLabel =
    durationSeconds && durationSeconds > 0
      ? `${minutes}:${String(seconds).padStart(2, "0")}`
      : null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-3 transition",
        isSelected
          ? "border-2 border-[#8a62ff] bg-[#8a62ff]/[0.06]"
          : "bg-black/[0.04] hover:bg-black/[0.07]",
      )}
    >
      <button
        type="button"
        aria-label={isPreviewing ? "Pause preview" : "Play preview"}
        onClick={() => onPreview(id, audioUrl)}
        className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-black text-white"
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover opacity-60" />
        ) : null}
        {isPreviewing ? (
          <span className="relative z-10 flex items-end gap-0.5 h-4">
            {[0, 0.2, 0.1].map((delay, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-white animate-bounce"
                style={{ height: "100%", animationDelay: `${delay}s` }}
              />
            ))}
          </span>
        ) : (
          <Play className="relative z-10 size-4 translate-x-0.5" />
        )}
      </button>

      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onSelect}
      >
        <span className="block truncate text-base font-black">{title}</span>
        <span className="block truncate text-sm font-semibold text-black/40">
          {artist}
          {genre ? ` · ${genre}` : ""}
          {durationLabel ? ` · ${durationLabel}` : ""}
        </span>
      </button>

      {isSelected ? (
        <Check className="size-6 shrink-0 text-[#ff315f]" />
      ) : null}
    </div>
  );
}

function CoverSheet({
  frames,
  onClose,
  onSelect,
  selectedFrame,
}: {
  frames: CoverFrame[];
  onClose: () => void;
  onSelect: (frame: CoverFrame) => void;
  selectedFrame: CoverFrame | null;
}) {
  return (
    <div className="absolute inset-0 flex items-end bg-black/45">
      <div className="w-full rounded-t-[28px] bg-white px-5 pb-6 pt-3 text-black">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-black/15" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-black">Edit cover</h2>
          <button
            className="grid size-10 place-items-center rounded-full bg-black/5"
            onClick={onClose}
            type="button"
          >
            <X className="size-6" />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {frames.map((frame) => (
            <button
              className={cn(
                "relative h-32 w-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-black/5",
                selectedFrame?.clipId === frame.clipId &&
                  Math.abs(selectedFrame.time - frame.time) < 0.1
                  ? "border-[#ff315f]"
                  : "border-transparent",
              )}
              key={`${frame.clipId}-${frame.time}`}
              onClick={() => onSelect(frame)}
              type="button"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Canvas-generated data URL thumbnails are not remote/image-loader assets. */}
              <img alt="" className="h-full w-full object-cover" src={frame.src} />
              <span className="absolute inset-x-1 bottom-1 rounded bg-black/65 py-1 text-[10px] font-black text-white">
                {formatTime(frame.time)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PostScreen({
  caption,
  coverFrame,
  error,
  isSaving,
  location,
  onBack,
  onCaptionChange,
  onCover,
  onDraft,
  onLocationChange,
  onOptionsChange,
  onPost,
  onPrivacyChange,
  options,
  privacy,
  totalDuration,
}: {
  caption: string;
  coverFrame: CoverFrame | null;
  error: string | null;
  isSaving: boolean;
  location: string;
  onBack: () => void;
  onCaptionChange: (value: string) => void;
  onCover: () => void;
  onDraft: () => void;
  onLocationChange: (value: string) => void;
  onOptionsChange: (value: ReelPostOptions) => void;
  onPost: () => void;
  onPrivacyChange: (value: string) => void;
  options: ReelPostOptions;
  privacy: string;
  totalDuration: number;
}) {
  const [expandedRow, setExpandedRow] = useState<
    "details" | "location" | "privacy" | "options" | null
  >(null);

  function appendToken(prefix: "#" | "@") {
    const needsSpace = caption.length > 0 && !/\s$/.test(caption);
    onCaptionChange(`${caption}${needsSpace ? " " : ""}${prefix}`);
  }

  const toggleExpandedRow = (
    row: "details" | "location" | "privacy" | "options",
  ) => setExpandedRow((current) => (current === row ? null : row));

  return (
    <div className="mx-auto h-dvh max-w-[430px] overflow-y-auto overscroll-y-contain bg-white text-black [-webkit-overflow-scrolling:touch]">
      <div className="flex h-16 items-center px-4">
        <button onClick={onBack} type="button">
          <ArrowLeft className="size-7" />
        </button>
      </div>
      <div className="px-5 pb-6">
        <div className="flex gap-4">
          <textarea
            className="min-h-36 flex-1 resize-none text-xl outline-none placeholder:text-black/30"
            maxLength={MAX_REEL_DESCRIPTION_LENGTH}
            onChange={(event) => onCaptionChange(event.target.value)}
            placeholder="Add description..."
            value={caption}
          />
          <button
            className="relative h-40 w-28 shrink-0 overflow-hidden rounded-2xl bg-black/10"
            onClick={onCover}
            type="button"
          >
            {coverFrame ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- Canvas-generated data URL thumbnails are not remote/image-loader assets. */}
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  src={coverFrame.src}
                />
                <span className="absolute inset-x-0 bottom-0 bg-black/55 py-2 text-sm font-black text-white">
                  Edit cover
                </span>
              </>
            ) : null}
          </button>
        </div>
        <div className="mt-2 text-right text-xs font-bold text-black/35">
          {caption.length}/{MAX_REEL_DESCRIPTION_LENGTH}
        </div>
        <div className="mt-5 flex gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-lg bg-black/5 px-3 py-2 text-base font-black"
            onClick={() => appendToken("#")}
            type="button"
          >
            <Hash className="size-4" />
            Hashtags
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-lg bg-black/5 px-3 py-2 text-base font-black"
            onClick={() => appendToken("@")}
            type="button"
          >
            <AtSign className="size-4" />
            Mention
          </button>
        </div>
        <ReelCaptionSuggestions
          caption={caption}
          onCaptionChange={onCaptionChange}
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
                onSelect={onLocationChange}
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
              <PrivacyPanel
                onSelect={onPrivacyChange}
                selectedPrivacy={privacy}
              />
            ) : null}
          </div>
          <div>
            <PostRow
              expanded={expandedRow === "details"}
              icon={Clapperboard}
              label="Reel details"
              onClick={() => toggleExpandedRow("details")}
              value={formatTime(totalDuration)}
            />
            {expandedRow === "details" ? (
              <ReelDetailsPanel totalDuration={totalDuration} />
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
              <MoreOptionsPanel onChange={onOptionsChange} options={options} />
            ) : null}
          </div>
        </div>
        {error ? (
          <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">
            {error}
          </div>
        ) : null}
      </div>
      <div className="sticky bottom-0 flex gap-3 bg-white px-5 pb-7 pt-3">
        <Button
          variant="secondary"
          className="h-14 flex-1 rounded-full bg-black/5 text-base text-black hover:bg-black/10"
          disabled={isSaving}
          onClick={onDraft}
          type="button"
        >
          Drafts
        </Button>
        <Button
          className="h-14 flex-1 rounded-full bg-[#ff315f] text-base text-white hover:bg-[#ef2454]"
          disabled={isSaving}
          onClick={onPost}
          type="button"
        >
          {isSaving ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
          Post
        </Button>
      </div>
    </div>
  );
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
      className="flex h-16 w-full items-center justify-between text-left text-lg font-black"
      onClick={onClick}
      type="button"
    >
      <span className="flex items-center gap-3">
        <Icon className="size-6" />
        {label}
      </span>
      <span className="flex items-center gap-2 text-sm font-bold text-black/45">
        {value}
        <ChevronRight
          className={cn("size-5 transition-transform", expanded && "rotate-90")}
        />
      </span>
    </button>
  );
}

function ReelDetailsPanel({ totalDuration }: { totalDuration: number }) {
  return (
    <div className="grid gap-2 pb-4">
      <div className="grid grid-cols-2 gap-2">
        <ReelDetailItem label="Duration" value={formatTime(totalDuration)} />
        <ReelDetailItem label="Canvas" value="9:16 vertical" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ReelDetailItem label="Output" value="1080 x 1920" />
        <ReelDetailItem label="Format" value="MP4" />
      </div>
      <p className="rounded-2xl bg-black/[0.03] px-4 py-3 text-xs font-bold leading-5 text-black/45">
        Reels are processed as H.264 video with AAC audio for reliable playback.
      </p>
    </div>
  );
}

function ReelDetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/[0.03] px-4 py-3">
      <span className="block text-xs font-bold text-black/40">{label}</span>
      <span className="mt-1 block text-sm font-black text-black">{value}</span>
    </div>
  );
}

export function ReelLocationPanel({
  onSelect,
  selectedLocation,
}: {
  onSelect: (value: string) => void;
  selectedLocation: string;
}) {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<GoogleAutocompletePrediction[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      return;
    }

    void loadGooglePlaces()
      .then(() => {
        if (!isActive) return;

        const places = window.google?.maps?.places;

        if (!places) {
          throw new Error("Google Places is not available.");
        }

        const service = new places.AutocompleteService();
        const sessionToken = new places.AutocompleteSessionToken();

        service.getPlacePredictions(
          {
            input: trimmedQuery,
            sessionToken,
            types: ["(regions)"],
          },
          (results, status) => {
            if (!isActive) return;

            setIsLoading(false);

            if (status !== places.PlacesServiceStatus.OK || !results?.length) {
              setPredictions([]);
              setPlacesError(null);
              return;
            }

            setPlacesError(null);
            setPredictions(results.filter(isCityOrCountryPrediction).slice(0, 6));
          },
        );
      })
      .catch((error) => {
        if (!isActive) return;

        setIsLoading(false);
        setPredictions([]);
        setPlacesError(
          error instanceof Error ? error.message : "Google Places is unavailable.",
        );
      });

    return () => {
      isActive = false;
    };
  }, [query]);

  const options = predictions.map((prediction) => ({
    id: prediction.place_id,
    label: prediction.structured_formatting?.main_text || prediction.description,
    secondary: prediction.structured_formatting?.secondary_text,
    value: prediction.description,
  }));

  return (
    <div className="pb-4">
      <input
        className="mb-4 h-12 w-full rounded-2xl bg-black/5 px-4 text-base font-bold outline-none"
        onChange={(event) => {
          const value = event.target.value;

          setQuery(value);

          if (value.trim().length < 2) {
            setPredictions([]);
            setPlacesError(null);
            setIsLoading(false);
          } else {
            setIsLoading(true);
          }
        }}
        placeholder="Search city or country"
        value={query}
      />
      {placesError ? (
        <p className="mb-3 rounded-2xl bg-black/5 px-4 py-3 text-xs font-bold text-black/50">
          {placesError}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-2xl bg-black/[0.03]">
        {options.map((option) => (
          <button
            className="flex h-14 w-full items-center justify-between px-4 text-left font-black"
            key={option.id}
            onClick={() => onSelect(option.value)}
            type="button"
          >
            <span className="min-w-0">
              <span className="block truncate">{option.label}</span>
              {option.secondary ? (
                <span className="block truncate text-xs font-bold text-black/40">
                  {option.secondary}
                </span>
              ) : null}
            </span>
            {selectedLocation === option.value ? (
              <Check className="size-5 text-[#ff315f]" />
            ) : null}
          </button>
        ))}
        {isLoading ? (
          <div className="flex h-14 items-center px-4 text-sm font-black text-black/45">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Searching places
          </div>
        ) : null}
        {!isLoading && !options.length && query.trim().length >= 2 ? (
          <div className="flex h-14 items-center px-4 text-sm font-black text-black/45">
            No city or country found
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-right text-[11px] font-black uppercase tracking-[0.18em] text-black/35">
        Powered by Google
      </p>
    </div>
  );
}

export function ReelCaptionSuggestions({
  caption,
  onCaptionChange,
}: {
  caption: string;
  onCaptionChange: (value: string) => void;
}) {
  const [hashtagSuggestions, setHashtagSuggestions] = useState<
    { count: number; tag: string }[]
  >([]);
  const [mentionSuggestions, setMentionSuggestions] = useState<
    { avatarUrl: string | null; name: string; username: string | null }[]
  >([]);
  const activeToken = caption.match(/(?:^|\s)([#@][a-z0-9_]*)$/i)?.[1] || "";
  const activeTokenType = activeToken.startsWith("#")
    ? "hashtag"
    : activeToken.startsWith("@")
      ? "mention"
      : null;

  useEffect(() => {
    let isActive = true;

    if (activeTokenType !== "hashtag") {
      return;
    }

    void getReelHashtagSuggestions(activeToken.slice(1))
      .then((suggestions) => {
        if (isActive) {
          setHashtagSuggestions(suggestions);
        }
      })
      .catch(() => {
        if (isActive) setHashtagSuggestions([]);
      });

    return () => {
      isActive = false;
    };
  }, [activeToken, activeTokenType]);

  useEffect(() => {
    let isActive = true;

    if (activeTokenType !== "mention") {
      return;
    }

    void getReelMentionSuggestions(activeToken.slice(1))
      .then((suggestions) => {
        if (isActive) {
          setMentionSuggestions(suggestions);
        }
      })
      .catch(() => {
        if (isActive) setMentionSuggestions([]);
      });

    return () => {
      isActive = false;
    };
  }, [activeToken, activeTokenType]);

  function replaceActiveToken(value: string) {
    const nextCaption = caption.replace(
      /(?:^|\s)([#@][a-z0-9_]*)$/i,
      (match) => `${match.startsWith(" ") ? " " : ""}${value} `,
    );

    onCaptionChange(nextCaption);
  }

  const hasSuggestions =
    (activeTokenType === "hashtag" && hashtagSuggestions.length > 0) ||
    (activeTokenType === "mention" && mentionSuggestions.length > 0);
  const visibleHashtagSuggestions =
    activeTokenType === "hashtag" ? hashtagSuggestions : [];
  const visibleMentionSuggestions =
    activeTokenType === "mention" ? mentionSuggestions : [];

  if (!hasSuggestions) return null;

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-lg">
      {activeTokenType === "hashtag"
        ? visibleHashtagSuggestions.map((suggestion) => (
            <button
              className="flex h-12 w-full items-center justify-between px-4 text-left"
              key={suggestion.tag}
              onClick={() => replaceActiveToken(`#${suggestion.tag}`)}
              type="button"
            >
              <span className="font-black">#{suggestion.tag}</span>
              <span className="text-xs font-bold text-black/40">
                {suggestion.count} posts
              </span>
            </button>
          ))
        : visibleMentionSuggestions.map((suggestion) => (
            <button
              className="flex h-14 w-full items-center gap-3 px-4 text-left"
              key={suggestion.username}
              onClick={() => replaceActiveToken(`@${suggestion.username || ""}`)}
              type="button"
            >
              <span className="grid size-9 place-items-center rounded-full bg-black text-xs font-black text-white">
                {suggestion.name.slice(0, 1)}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-black">
                  {suggestion.name}
                </span>
                <span className="block truncate text-xs font-bold text-black/45">
                  @{suggestion.username}
                </span>
              </span>
            </button>
          ))}
    </div>
  );
}

function PrivacyPanel({
  onSelect,
  selectedPrivacy,
}: {
  onSelect: (value: string) => void;
  selectedPrivacy: string;
}) {
  return (
    <div className="pb-4">
      {["Everyone", "Followers", "Only you"].map((privacy) => (
        <button
          className="flex h-16 w-full items-center justify-between rounded-2xl px-4 text-left text-lg font-black"
          key={privacy}
          onClick={() => onSelect(privacy)}
          type="button"
        >
          {privacy}
          <span
            className={cn(
              "grid size-7 place-items-center rounded-full border-2",
              selectedPrivacy === privacy
                ? "border-[#ff315f] bg-[#ff315f]"
                : "border-black/15",
            )}
          >
            {selectedPrivacy === privacy ? (
              <span className="size-2 rounded-full bg-white" />
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}

function MoreOptionsPanel({
  onChange,
  options,
}: {
  onChange: (value: ReelPostOptions) => void;
  options: ReelPostOptions;
}) {
  const update = (key: keyof ReelPostOptions) =>
    onChange({ ...options, [key]: !options[key] });

  return (
    <div className="pb-4">
      <ToggleRow
        checked={options.allowComments}
        icon={MessageCircle}
        label="Allow comments"
        onClick={() => update("allowComments")}
      />
      <ToggleRow
        checked={options.allowReuse}
        icon={Repeat2}
        label="Allow reuse of content"
        note="Duet, stitch, stickers, and shares."
        onClick={() => update("allowReuse")}
      />
      <ToggleRow
        checked={options.aiGenerated}
        icon={Bot}
        label="AI-generated content"
        note="Show viewers this was generated or edited with AI."
        onClick={() => update("aiGenerated")}
      />
      <ToggleRow
        checked={options.autoCheckSound}
        icon={Music2}
        label="Auto-check sound copyright"
        note="Check uploaded music before posting."
        onClick={() => update("autoCheckSound")}
      />
    </div>
  );
}

function ToggleRow({
  checked,
  icon: Icon,
  label,
  note,
  onClick,
}: {
  checked: boolean;
  icon: LucideIcon;
  label: string;
  note?: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex min-h-16 w-full items-center gap-3 py-3 text-left"
      onClick={onClick}
      type="button"
    >
      <Icon className="size-6 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-black">{label}</span>
        {note ? (
          <span className="block text-sm font-semibold leading-5 text-black/45">
            {note}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "flex h-8 w-14 items-center rounded-full p-1 transition-colors",
          checked ? "bg-cyan-400" : "bg-black/15",
        )}
      >
        <span
          className={cn(
            "size-6 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-6",
          )}
        />
      </span>
    </button>
  );
}
