import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Music } from "lucide-react";
import { asc } from "drizzle-orm";

import { db } from "@/db";
import { musicTracks } from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import { deleteMusicTrack, toggleMusicTrackActive } from "./actions";
import { AdminMusicForm } from "./admin-music-form";

export const metadata: Metadata = {
  title: "Music Library | Admin | Homzie",
};

export default async function AdminMusicPage() {
  const tracks = await db
    .select()
    .from(musicTracks)
    .orderBy(asc(musicTracks.sortOrder), asc(musicTracks.createdAt));

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-muted"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-black">Music Library</h1>
          <p className="text-sm text-muted-foreground">
            Upload royalty-free tracks for reel creators.
          </p>
        </div>
      </div>

      <AdminMusicForm />

      {tracks.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-base font-black">Tracks ({tracks.length})</h2>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {tracks.map((track) => {
              const coverUrl = toPublicMediaUrl(track.coverPath);
              const audioUrl = toPublicMediaUrl(track.audioPath);
              const minutes = Math.floor(track.durationSeconds / 60);
              const seconds = track.durationSeconds % 60;
              const duration = `${minutes}:${String(seconds).padStart(2, "0")}`;

              return (
                <div key={track.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                    {coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <Music className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{track.title}</p>
                    <p className="truncate text-xs font-semibold text-muted-foreground">
                      {track.artist}
                      {track.genre ? ` · ${track.genre}` : ""}
                      {track.durationSeconds > 0 ? ` · ${duration}` : ""}
                    </p>
                  </div>
                  {audioUrl ? (
                    <audio
                      src={audioUrl}
                      controls
                      className="h-8 w-32 shrink-0"
                      preload="none"
                    />
                  ) : null}
                  <form>
                    <input type="hidden" name="id" value={track.id} />
                    <button
                      type="submit"
                      formAction={async () => {
                        "use server";
                        await toggleMusicTrackActive(track.id, !track.isActive);
                      }}
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-black transition ${
                        track.isActive
                          ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      }`}
                    >
                      {track.isActive ? "Active" : "Inactive"}
                    </button>
                  </form>
                  <form>
                    <button
                      type="submit"
                      formAction={async () => {
                        "use server";
                        await deleteMusicTrack(track.id);
                      }}
                      className="shrink-0 rounded-full px-3 py-1 text-xs font-black text-destructive transition hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Music className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-muted-foreground">No tracks yet</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Upload a track above to get started.
          </p>
        </div>
      )}
    </div>
  );
}
