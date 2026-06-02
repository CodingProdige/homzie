import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { toStoredMediaPath } from "@/media/paths";
import { getMediaStorageRoot } from "@/media/storage";
import type { RenderPayload } from "./render-schema";

const outputWidth = 1080;
const outputHeight = 1920;
const outputFps = 30;
const outputVideoBitrate = "8M";
const outputVideoMaxrate = "12M";
const outputVideoBufferSize = "16M";
const outputAudioBitrate = "192k";
const outputAudioSampleRate = "44100";

const ffmpegBinary = process.env.FFMPEG_PATH || "ffmpeg";

function seconds(value: number) {
  return Math.max(0, Number.isFinite(value) ? value : 0).toFixed(3);
}

function mediaStoragePath(mediaPath: string) {
  const storedPath = toStoredMediaPath(mediaPath);

  if (!storedPath) return null;

  return path.join(/*turbopackIgnore: true*/ getMediaStorageRoot(), storedPath);
}

async function runFfmpeg(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegBinary, args, { stdio: ["ignore", "ignore", "pipe"] });
    const errors: Buffer[] = [];

    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          Buffer.concat(errors).toString("utf8") || `FFmpeg exited with ${code}`,
        ),
      );
    });
  });
}

async function hasAudioStream(inputPath: string) {
  return await new Promise<boolean>((resolve, reject) => {
    const child = spawn(ffmpegBinary, ["-hide_banner", "-i", inputPath], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    const errors: Buffer[] = [];

    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    child.on("error", reject);
    child.on("close", () => {
      resolve(Buffer.concat(errors).toString("utf8").includes("Audio:"));
    });
  });
}

export async function renderReelMedia(payload: RenderPayload) {
  const clips = [...payload.clips].sort((a, b) => a.order - b.order);
  const clipPaths = clips.map((clip) => mediaStoragePath(clip.mediaPath));

  if (clipPaths.some((clipPath) => !clipPath)) {
    throw new Error("One or more clips are invalid.");
  }

  const audioPath = payload.audioMediaPath
    ? mediaStoragePath(payload.audioMediaPath)
    : null;

  if (payload.audioMediaPath && !audioPath) {
    throw new Error("Audio path is invalid.");
  }

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const fileName = `${randomUUID()}.mp4`;
  const relativePath = ["reels-rendered", year, month, fileName].join("/");
  const outputPath = path.join(
    /*turbopackIgnore: true*/ getMediaStorageRoot(),
    "reels-rendered",
    year,
    month,
    fileName,
  );

  await mkdir(path.dirname(outputPath), { recursive: true });

  const clipAudioPresence = await Promise.all(
    clipPaths.map((clipPath) => hasAudioStream(clipPath as string)),
  );
  const args = ["-y"];
  const clipInputs = clips.map((clip, index) => {
    const videoInputIndex = args.filter((arg) => arg === "-i").length;
    const trimStart = Math.min(clip.trimStart, clip.duration);
    const trimEnd = Math.max(trimStart + 0.1, Math.min(clip.trimEnd, clip.duration));
    const duration = Math.max(0.1, trimEnd - trimStart);

    args.push("-i", clipPaths[index] as string);

    if (clipAudioPresence[index]) {
      return { audioInputIndex: videoInputIndex, trimEnd, trimStart, videoInputIndex };
    }

    const audioInputIndex = args.filter((arg) => arg === "-i").length;
    args.push(
      "-f",
      "lavfi",
      "-t",
      seconds(duration),
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=44100",
    );

    return { audioInputIndex, trimEnd: duration, trimStart: 0, videoInputIndex };
  });
  const audioInputIndex = audioPath ? args.filter((arg) => arg === "-i").length : null;

  if (audioPath) {
    args.push("-i", audioPath);
  }

  const filterParts: string[] = [];
  const concatInputs: string[] = [];

  clips.forEach((clip, index) => {
    const input = clipInputs[index];
    const volume = clip.muted ? 0 : clip.volume;

    filterParts.push(
      `[${input.videoInputIndex}:v]trim=start=${seconds(input.trimStart)}:end=${seconds(input.trimEnd)},setpts=PTS-STARTPTS,scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=increase:flags=lanczos,crop=${outputWidth}:${outputHeight},setsar=1,fps=${outputFps},format=yuv420p[v${index}]`,
    );
    filterParts.push(
      `[${input.audioInputIndex}:a]atrim=start=${seconds(input.trimStart)}:end=${seconds(input.trimEnd)},asetpts=PTS-STARTPTS,volume=${volume.toFixed(3)}[a${index}]`,
    );
    concatInputs.push(`[v${index}][a${index}]`);
  });

  filterParts.push(
    `${concatInputs.join("")}concat=n=${clips.length}:v=1:a=1[basev][basea]`,
  );

  let audioOutput = "[basea]";

  if (audioPath && payload.audioClips.length && audioInputIndex !== null) {
    const musicLabels: string[] = [];

    payload.audioClips.forEach((clip, index) => {
      const duration = Math.max(0.1, clip.trimEnd - clip.trimStart);
      const start = Math.max(0, clip.timelineStart + clip.trimStart - clip.baseTrimStart);
      const fadeIn = Math.min(clip.fadeIn, duration / 2);
      const fadeOut = Math.min(clip.fadeOut, duration / 2);
      const fadeFilters = [
        `atrim=start=${seconds(clip.trimStart)}:end=${seconds(clip.trimEnd)}`,
        "asetpts=PTS-STARTPTS",
        `volume=${payload.audioVolume.toFixed(3)}`,
      ];

      if (fadeIn > 0) {
        fadeFilters.push(`afade=t=in:st=0:d=${seconds(fadeIn)}`);
      }

      if (fadeOut > 0) {
        fadeFilters.push(
          `afade=t=out:st=${seconds(Math.max(0, duration - fadeOut))}:d=${seconds(fadeOut)}`,
        );
      }

      fadeFilters.push(`adelay=${Math.round(start * 1000)}:all=1`);
      filterParts.push(
        `[${audioInputIndex}:a]${fadeFilters.join(",")}[music${index}]`,
      );
      musicLabels.push(`[music${index}]`);
    });

    if (musicLabels.length) {
      filterParts.push(
        `[basea]${musicLabels.join("")}amix=inputs=${musicLabels.length + 1}:duration=first:normalize=0[mixa]`,
      );
      audioOutput = "[mixa]";
    }
  }

  args.push(
    "-filter_complex",
    filterParts.join(";"),
    "-map",
    "[basev]",
    "-map",
    audioOutput,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-profile:v",
    "high",
    "-level",
    "4.1",
    "-b:v",
    outputVideoBitrate,
    "-maxrate",
    outputVideoMaxrate,
    "-bufsize",
    outputVideoBufferSize,
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    outputAudioBitrate,
    "-ar",
    outputAudioSampleRate,
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    "-shortest",
    outputPath,
  );

  await runFfmpeg(args);

  return {
    mediaPath: relativePath,
    mediaUrl: `/media/${relativePath}`,
  };
}
