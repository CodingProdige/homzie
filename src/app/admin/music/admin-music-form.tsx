"use client";

import { useRef, useState } from "react";
import { Music, Upload } from "lucide-react";

import { createMusicTrack } from "./actions";

type UploadResult = {
  audioPath: string;
  coverPath: string | null;
};

export function AdminMusicForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);

  function handleAudioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const audio = document.createElement("audio");
    audio.src = URL.createObjectURL(file);
    audio.addEventListener("loadedmetadata", () => {
      setAudioDuration(Math.round(audio.duration || 0));
      URL.revokeObjectURL(audio.src);
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    try {
      const form = e.currentTarget;
      const data = new FormData(form);

      const title = (data.get("title") as string)?.trim();
      const artist = (data.get("artist") as string)?.trim();
      const genre = (data.get("genre") as string)?.trim() || null;
      const audioFile = data.get("audio") as File | null;

      if (!title || !artist || !audioFile || audioFile.size === 0) {
        setError("Title, artist, and audio file are required.");
        return;
      }

      const uploadData = new FormData();
      uploadData.append("audio", audioFile);
      const coverFile = data.get("cover") as File | null;
      if (coverFile && coverFile.size > 0) {
        uploadData.append("cover", coverFile);
      }

      const uploadRes = await fetch("/api/admin/music/upload", {
        method: "POST",
        body: uploadData,
      });
      const uploadResult = (await uploadRes.json()) as UploadResult & { error?: string };

      if (!uploadRes.ok || !uploadResult.audioPath) {
        throw new Error(uploadResult.error || "Upload failed.");
      }

      await createMusicTrack({
        title,
        artist,
        audioPath: uploadResult.audioPath,
        coverPath: uploadResult.coverPath,
        durationSeconds: audioDuration,
        genre,
      });

      formRef.current?.reset();
      setAudioDuration(0);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold">Add track</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-normal uppercase tracking-widest text-muted-foreground">
            Title *
          </label>
          <input
            name="title"
            type="text"
            required
            placeholder="Track title"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-normal uppercase tracking-widest text-muted-foreground">
            Artist *
          </label>
          <input
            name="artist"
            type="text"
            required
            placeholder="Artist name"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-normal uppercase tracking-widest text-muted-foreground">
            Genre
          </label>
          <input
            name="genre"
            type="text"
            placeholder="e.g. Ambient, Pop"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-normal uppercase tracking-widest text-muted-foreground">
            Cover image
          </label>
          <input
            name="cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="w-full text-sm font-normal text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-normal"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-normal uppercase tracking-widest text-muted-foreground">
          Audio file * (MP3, M4A, WAV, AAC — max 50MB)
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-4 transition hover:bg-muted/50">
          <Music className="size-5 shrink-0 text-muted-foreground" />
          <span className="text-sm font-normal text-muted-foreground">
            {audioDuration > 0
              ? `Audio selected (${Math.floor(audioDuration / 60)}:${String(audioDuration % 60).padStart(2, "0")})`
              : "Click to choose audio file"}
          </span>
          <input
            name="audio"
            type="file"
            accept="audio/mpeg,audio/mp4,audio/wav,audio/aac,audio/ogg,audio/webm,audio/x-wav"
            required
            className="sr-only"
            onChange={handleAudioChange}
          />
        </label>
      </div>

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="rounded-lg bg-green-100 px-3 py-2 text-sm font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Track added successfully.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        <Upload className="size-4" />
        {isSubmitting ? "Uploading…" : "Add track"}
      </button>
    </form>
  );
}
