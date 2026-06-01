import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";

import { db } from "@/db";
import { reels, users } from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import { hasActiveAgentSubscription } from "@/modules/agents/queries";
import { authOptions } from "@/modules/auth/config";
import {
  ReelMvpEditor,
  type InitialReelDraft,
} from "@/modules/reels/components/reel-mvp-editor";

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

export default async function EditReelPage({ params }: EditReelPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  if (!(await hasActiveAgentSubscription(session.user.id))) {
    redirect("/become-agent");
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
      videoPath: reels.videoPath,
    })
    .from(reels)
    .where(and(eq(reels.id, reelId), eq(reels.userId, session.user.id)))
    .limit(1);

  if (!reel) {
    notFound();
  }

  const draft = parseDraft(reel);

  if (!draft) {
    notFound();
  }

  return (
    <main className="h-dvh overflow-hidden bg-black text-foreground">
      <ReelMvpEditor initialDraft={draft} profilePath={`/users/${user.username}`} />
    </main>
  );
}
