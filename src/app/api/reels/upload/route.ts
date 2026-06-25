import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { getServerSession } from "next-auth";

import { getMediaStorageRoot } from "@/media/storage";
import { authOptions } from "@/modules/auth/config";

export const runtime = "nodejs";

const maxVideoBytes = 1024 * 1024 * 1024;
const maxAudioBytes = 50 * 1024 * 1024;
const extensionByType: Record<string, string> = {
  "audio/aac": "aac",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/x-wav": "wav",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return Response.json({ error: "Sign in to upload a reel." }, { status: 401 });
  }

  const formData = await request.formData();
  const videoFile = formData.get("video");
  const audioFile = formData.get("audio");
  const file = videoFile instanceof File ? videoFile : audioFile;
  const mediaType = videoFile instanceof File ? "video" : "audio";

  if (!(file instanceof File)) {
    return Response.json(
      { error: "Choose a video or audio file." },
      { status: 400 },
    );
  }

  if (mediaType === "video" && file.size > maxVideoBytes) {
    return Response.json(
      { error: "Videos must be 1GB or smaller." },
      { status: 400 },
    );
  }

  if (mediaType === "audio" && file.size > maxAudioBytes) {
    return Response.json(
      { error: "Audio files must be 50MB or smaller." },
      { status: 400 },
    );
  }

  const extension = extensionByType[file.type];

  if (!extension || !file.type.startsWith(`${mediaType}/`)) {
    return Response.json(
      {
        error:
          mediaType === "video"
            ? "Upload an MP4 or MOV video."
            : "Upload an MP3, M4A, WAV, AAC, OGG, or WebM audio file.",
      },
      { status: 400 },
    );
  }

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const folder = mediaType === "video" ? "reels" : "reels-audio";
  const fileName = `${randomUUID()}.${extension}`;
  const relativePath = [folder, year, month, fileName].join("/");
  const storagePath = path.join(
    /*turbopackIgnore: true*/ getMediaStorageRoot(),
    folder,
    year,
    month,
    fileName,
  );
  const bytes = Buffer.from(await file.arrayBuffer());

  await mkdir(path.dirname(storagePath), { recursive: true });
  await writeFile(storagePath, bytes);

  return Response.json({
    mediaPath: relativePath,
    mediaUrl: `/media/${relativePath}`,
  });
}
