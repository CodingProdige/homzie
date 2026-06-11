"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { desc, eq } from "drizzle-orm";

import { db, sql } from "@/db";
import { musicTracks } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const [row] = await sql<[{ role: string; status: string }?]>`
    SELECT role, status FROM users WHERE id = ${session.user.id} LIMIT 1
  `;
  if (row?.role !== "admin" || row?.status !== "active") throw new Error("Forbidden");
  return session.user.id;
}

export async function createMusicTrack(data: {
  title: string;
  artist: string;
  audioPath: string;
  coverPath: string | null;
  durationSeconds: number;
  genre: string | null;
}) {
  await requireAdmin();

  const [maxRow] = await db
    .select({ maxOrder: musicTracks.sortOrder })
    .from(musicTracks)
    .orderBy(desc(musicTracks.sortOrder))
    .limit(1);

  const sortOrder = (maxRow?.maxOrder ?? -1) + 1;

  await db.insert(musicTracks).values({
    title: data.title.trim(),
    artist: data.artist.trim(),
    audioPath: data.audioPath,
    coverPath: data.coverPath,
    durationSeconds: data.durationSeconds,
    genre: data.genre?.trim() || null,
    isActive: true,
    sortOrder,
  });

  revalidatePath("/admin/music");
}

export async function toggleMusicTrackActive(id: string, isActive: boolean) {
  await requireAdmin();
  await db.update(musicTracks).set({ isActive, updatedAt: new Date() }).where(eq(musicTracks.id, id));
  revalidatePath("/admin/music");
}

export async function deleteMusicTrack(id: string) {
  await requireAdmin();
  await db.delete(musicTracks).where(eq(musicTracks.id, id));
  revalidatePath("/admin/music");
}

export async function updateMusicTrackOrder(ids: string[]) {
  await requireAdmin();
  await Promise.all(
    ids.map((id, index) =>
      db.update(musicTracks).set({ sortOrder: index, updatedAt: new Date() }).where(eq(musicTracks.id, id)),
    ),
  );
  revalidatePath("/admin/music");
}
