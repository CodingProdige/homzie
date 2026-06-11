import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { getServerSession } from "next-auth";

import { sql } from "@/db";
import { getMediaStorageRoot } from "@/media/storage";
import { authOptions } from "@/modules/auth/config";

export const runtime = "nodejs";

const maxAudioBytes = 50 * 1024 * 1024;
const maxImageBytes = 5 * 1024 * 1024;

const audioExtensions: Record<string, string> = {
  "audio/aac": "aac",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/x-wav": "wav",
};

const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function isAdmin(userId: string): Promise<boolean> {
  const [row] = await sql<[{ role: string; status: string }?]>`
    SELECT role, status FROM users WHERE id = ${userId} LIMIT 1
  `;
  return row?.role === "admin" && row?.status === "active";
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!(await isAdmin(session.user.id))) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const formData = await request.formData();
  const audioFile = formData.get("audio");
  const coverFile = formData.get("cover");

  if (!(audioFile instanceof File)) {
    return Response.json({ error: "Audio file required." }, { status: 400 });
  }

  const audioExtension = audioExtensions[audioFile.type];

  if (!audioExtension) {
    return Response.json(
      { error: "Upload an MP3, M4A, WAV, AAC, OGG, or WebM audio file." },
      { status: 400 },
    );
  }

  if (audioFile.size > maxAudioBytes) {
    return Response.json(
      { error: "Audio files must be 50MB or smaller." },
      { status: 400 },
    );
  }

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");

  const audioFileName = `${randomUUID()}.${audioExtension}`;
  const audioRelativePath = ["music", "tracks", year, month, audioFileName].join("/");
  const audioStoragePath = path.join(
    /*turbopackIgnore: true*/ getMediaStorageRoot(),
    "music",
    "tracks",
    year,
    month,
    audioFileName,
  );

  await mkdir(path.dirname(audioStoragePath), { recursive: true });
  await writeFile(audioStoragePath, Buffer.from(await audioFile.arrayBuffer()));

  let coverRelativePath: string | null = null;

  if (coverFile instanceof File && coverFile.size > 0) {
    const coverExtension = imageExtensions[coverFile.type];

    if (coverExtension && coverFile.size <= maxImageBytes) {
      const coverFileName = `${randomUUID()}.${coverExtension}`;
      coverRelativePath = ["music", "covers", year, month, coverFileName].join("/");
      const coverStoragePath = path.join(
        /*turbopackIgnore: true*/ getMediaStorageRoot(),
        "music",
        "covers",
        year,
        month,
        coverFileName,
      );
      await mkdir(path.dirname(coverStoragePath), { recursive: true });
      await writeFile(coverStoragePath, Buffer.from(await coverFile.arrayBuffer()));
    }
  }

  return Response.json({
    audioPath: audioRelativePath,
    coverPath: coverRelativePath,
  });
}
