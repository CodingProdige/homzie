import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { Trash2 } from "lucide-react";

import { db } from "@/db";
import { reels, users } from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import { authOptions } from "@/modules/auth/config";
import {
  ReelMvpEditor,
  type InitialReelDraft,
} from "@/modules/reels/components/reel-mvp-editor";
import {
  PublishedReelDetailsEditor,
  type PublishedReelDetailsDraft,
} from "@/modules/reels/components/published-reel-details-editor";
import { deleteReel } from "@/modules/reels/actions";

type EditReelPageProps = {
  params: Promise<{
    reelId: string;
  }>;
};

function metadataObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function boolValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function coverFrameValue(value: unknown) {
  const frame = metadataObject(value);
  const clipId = stringValue(frame.clipId);
  const src = stringValue(frame.src);

  if (!clipId || !src) return null;

  return {
    clipId,
    src,
    time: numberValue(frame.time),
  };
}

function parseDraft(reel: {
  caption: string | null;
  editMetadata: unknown;
  id: string;
  listingReference: string | null;
  videoPath: string;
}): InitialReelDraft | null {
  const metadata = metadataObject(reel.editMetadata);
  const rawClips = Array.isArray(metadata.clips) ? metadata.clips : [];
  const clips = rawClips
    .map((rawClip, index) => {
      const clip = metadataObject(rawClip);
      const mediaUrl = toPublicMediaUrl(stringValue(clip.mediaPath));

      if (!mediaUrl) return null;

      return {
        baseTrimStart: numberValue(clip.baseTrimStart),
        duration: numberValue(clip.duration),
        frames: Array.isArray(clip.frames) ? clip.frames : undefined,
        id: stringValue(clip.id) || `draft-clip-${index}`,
        mediaUrl,
        muted: boolValue(clip.muted),
        timelineStart: numberValue(clip.timelineStart),
        trimEnd: numberValue(clip.trimEnd, numberValue(clip.duration)),
        trimStart: numberValue(clip.trimStart),
        volume: numberValue(clip.volume, 1),
      };
    })
    .filter((clip) => clip !== null);

  if (!clips.length) {
    const mediaUrl = toPublicMediaUrl(reel.videoPath);

    if (!mediaUrl) return null;

    clips.push({
      baseTrimStart: 0,
      duration: 0,
      frames: undefined,
      id: "draft-clip-0",
      mediaUrl,
      muted: false,
      timelineStart: 0,
      trimEnd: numberValue(metadata.totalDuration),
      trimStart: 0,
      volume: 1,
    });
  }

  const music = metadataObject(metadata.music);
  const audioMediaUrl = toPublicMediaUrl(stringValue(music.mediaPath));
  const options = metadataObject(metadata.options);
  const coverFrame = metadataObject(metadata.coverFrame);

  return {
    audioClips: Array.isArray(metadata.audioClips)
      ? (metadata.audioClips as InitialReelDraft["audioClips"])
      : [],
    audioMedia: audioMediaUrl
      ? {
          artist: stringValue(music.artist) || "Imported audio",
          duration:
            typeof music.duration === "number" ? music.duration : undefined,
          id: stringValue(music.id) || "draft-audio",
          mediaUrl: audioMediaUrl,
          title: stringValue(music.title) || "Draft audio",
        }
      : null,
    audioVolume: numberValue(metadata.audioVolume, 1),
    caption: reel.caption,
    clips,
    coverFrame:
      stringValue(coverFrame.src) && stringValue(coverFrame.clipId)
        ? (coverFrame as InitialReelDraft["coverFrame"])
        : null,
    location: stringValue(metadata.location) || reel.listingReference,
    options: {
      aiGenerated: boolValue(options.aiGenerated),
      allowComments: boolValue(options.allowComments, true),
      allowReuse: boolValue(options.allowReuse, true),
      autoCheckSound: boolValue(options.autoCheckSound, true),
    },
    privacy: stringValue(metadata.privacy) || "Everyone",
    reelId: reel.id,
    splitMarkers: Array.isArray(metadata.splitMarkers)
      ? (metadata.splitMarkers as number[])
      : [],
  };
}

function parsePublishedDetailsDraft(
  reel: {
    caption: string | null;
    editMetadata: unknown;
    id: string;
    listingReference: string | null;
    videoPath: string;
  },
  profilePath: string,
): PublishedReelDetailsDraft {
  const metadata = metadataObject(reel.editMetadata);
  const rawClips = Array.isArray(metadata.clips) ? metadata.clips : [];
  const frames = rawClips.flatMap((rawClip) => {
    const clip = metadataObject(rawClip);
    const rawFrames = Array.isArray(clip.frames) ? clip.frames : [];

    return rawFrames
      .map(coverFrameValue)
      .filter((frame) => frame !== null);
  });
  const coverFrame = coverFrameValue(metadata.coverFrame) || frames[0] || null;
  const options = metadataObject(metadata.options);

  return {
    caption: reel.caption || "",
    coverFrame,
    frames,
    location: stringValue(metadata.location) || reel.listingReference || "",
    options: {
      aiGenerated: boolValue(options.aiGenerated),
      allowComments: boolValue(options.allowComments, true),
      allowReuse: boolValue(options.allowReuse, true),
      autoCheckSound: boolValue(options.autoCheckSound, true),
    },
    privacy: stringValue(metadata.privacy) || "Everyone",
    profilePath,
    reelId: reel.id,
    videoUrl: toPublicMediaUrl(reel.videoPath) || "",
  };
}

export default async function EditReelPage({ params }: EditReelPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const { reelId } = await params;
  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.username) {
    redirect("/onboarding/username");
  }

  const [reel] = await db
    .select({
      caption: reels.caption,
      editMetadata: reels.editMetadata,
      id: reels.id,
      listingReference: reels.listingReference,
      status: reels.status,
      videoPath: reels.videoPath,
    })
    .from(reels)
    .where(and(eq(reels.id, reelId), eq(reels.userId, session.user.id)))
    .limit(1);

  if (!reel) {
    notFound();
  }

  const profilePath = `/users/${user.username}`;

  if (reel.status === "published") {
    return (
      <PublishedReelDetailsEditor
        draft={parsePublishedDetailsDraft(reel, profilePath)}
      />
    );
  }

  if (reel.status === "processing") {
    const render = metadataObject(metadataObject(reel.editMetadata).render);
    const progress =
      typeof render.progress === "number"
        ? Math.max(0, Math.min(100, Math.round(render.progress)))
        : 5;

    return (
      <main className="grid min-h-dvh place-items-center bg-black px-5 text-white">
        <section className="w-full max-w-sm rounded-xl border border-white/10 bg-white/10 p-5 text-center shadow-2xl backdrop-blur">
          <p className="text-xs font-black uppercase tracking-wide text-violet-200">
            Processing {progress}%
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
            <span
              className="block h-full rounded-full bg-violet-400"
              style={{ width: `${progress}%` }}
            />
          </div>
          <h1 className="mt-5 text-xl font-black">Your reel is still processing</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-white/65">
            You can leave this page. If processing stalls, the reel card will show a
            failure state once the render queue times out.
          </p>
          <Link
            href={profilePath}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-white px-4 text-sm font-black text-black"
          >
            Back to profile
          </Link>
        </section>
      </main>
    );
  }

  const draft = parseDraft(reel);

  if (!draft) {
    notFound();
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-black text-foreground">
      <form action={deleteReel} className="absolute right-4 top-5 z-50">
        <input type="hidden" name="reelId" value={reel.id} />
        <button
          type="submit"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-black/55 px-3 text-xs font-black text-red-100 shadow-lg backdrop-blur transition hover:bg-red-500/20"
        >
          <Trash2 className="size-4" />
          Delete reel
        </button>
      </form>
      <ReelMvpEditor initialDraft={draft} profilePath={profilePath} />
    </main>
  );
}
