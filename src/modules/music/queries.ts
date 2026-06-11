import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { musicTracks } from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import type { LibraryTrack } from "./types";

export async function getActiveMusicTracks(): Promise<LibraryTrack[]> {
  const rows = await db
    .select({
      id: musicTracks.id,
      title: musicTracks.title,
      artist: musicTracks.artist,
      audioPath: musicTracks.audioPath,
      coverPath: musicTracks.coverPath,
      durationSeconds: musicTracks.durationSeconds,
      genre: musicTracks.genre,
    })
    .from(musicTracks)
    .where(eq(musicTracks.isActive, true))
    .orderBy(asc(musicTracks.sortOrder), asc(musicTracks.createdAt));

  return rows.flatMap((row) => {
    const audioUrl = toPublicMediaUrl(row.audioPath);
    if (!audioUrl) return [];
    return [
      {
        id: row.id,
        title: row.title,
        artist: row.artist,
        audioUrl,
        coverUrl: toPublicMediaUrl(row.coverPath),
        durationSeconds: row.durationSeconds,
        genre: row.genre,
      },
    ];
  });
}
