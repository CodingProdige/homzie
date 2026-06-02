import { getServerSession } from "next-auth";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { reels } from "@/db/schema";
import { toStoredMediaPath } from "@/media/paths";
import {
  getAgentProfileForUser,
  hasActiveAgentSubscription,
} from "@/modules/agents/queries";
import { authOptions } from "@/modules/auth/config";
import { recordReelHashtagUsage } from "@/modules/hashtags/server";
import {
  createReelRenderJob,
  setReelRenderState,
} from "@/modules/reels/server/render-job-state";
import { enqueueReelRenderJob } from "@/modules/reels/server/render-queue";
import { renderPayloadSchema } from "@/modules/reels/server/render-schema";

export const runtime = "nodejs";

const reelPayloadSchema = z.object({
  caption: z.string().max(1000).optional(),
  editMetadata: z.unknown().optional(),
  coverTime: z.number().min(0).optional(),
  hashtags: z.string().max(280).optional(),
  listing: z.string().max(180).optional(),
  previewMode: z.enum(["fit", "fill", "stretch"]).default("fit"),
  reelId: z.string().uuid().optional(),
  renderPayload: renderPayloadSchema.optional(),
  soundId: z.string().max(80).default("original"),
  status: z.enum(["draft", "published"]),
  splitMarkers: z.array(z.number().min(0)).default([]),
  trimEnd: z.number().min(0).optional(),
  trimStart: z.number().min(0).optional(),
  videoPath: z.string(),
});

function metadataObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function reelSaveErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Could not save this reel.";
  }

  if (/view_count/i.test(error.message)) {
    return "The reels database needs the latest migration. Please run the database migration and try again.";
  }

  if (/failed query/i.test(error.message)) {
    return "Could not save this reel because the database rejected the request. Please try again.";
  }

  return "Could not save this reel.";
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return Response.json({ error: "Sign in to save a reel." }, { status: 401 });
    }

    if (!(await hasActiveAgentSubscription(session.user.id))) {
      return Response.json(
        { error: "An active agent subscription is required." },
        { status: 403 },
      );
    }

    const parsed = reelPayloadSchema.safeParse(await request.json());

    if (!parsed.success) {
      return Response.json({ error: "Check your reel details." }, { status: 400 });
    }

    const videoPath = toStoredMediaPath(parsed.data.videoPath);

    if (!videoPath) {
      return Response.json({ error: "Video path is invalid." }, { status: 400 });
    }

    const agentProfile = await getAgentProfileForUser(session.user.id);

    if (!agentProfile) {
      return Response.json(
        { error: "Create your agent profile before posting reels." },
        { status: 400 },
      );
    }

    const baseMetadata = metadataObject(parsed.data.editMetadata);
    const shouldRender = Boolean(parsed.data.renderPayload);
    const renderBaseMetadata =
      shouldRender && parsed.data.renderPayload
        ? { ...baseMetadata, renderPayload: parsed.data.renderPayload }
        : baseMetadata;
    const initialStatus = shouldRender ? "processing" : parsed.data.status;
    const reelValues = {
      userId: session.user.id,
      agentProfileId: agentProfile.id,
      status: initialStatus,
      videoPath,
      caption: parsed.data.caption || null,
      hashtags: parsed.data.hashtags || null,
      listingReference: parsed.data.listing || null,
      soundId: parsed.data.soundId,
      trimStartSeconds: Math.round(parsed.data.trimStart || 0),
      trimEndSeconds: Math.round(parsed.data.trimEnd || 0),
      coverTimeSeconds: Math.round(parsed.data.coverTime || 0),
      editMetadata: shouldRender
        ? {
            ...renderBaseMetadata,
            render: {
              progress: 5,
              status: "queued",
              targetStatus: parsed.data.status,
            },
          }
        : parsed.data.editMetadata || null,
      updatedAt: new Date(),
    };
    let reel: { id: string } | undefined;

    if (parsed.data.reelId) {
      [reel] = await db
        .update(reels)
        .set(reelValues)
        .where(
          and(eq(reels.id, parsed.data.reelId), eq(reels.userId, session.user.id)),
        )
        .returning({ id: reels.id });

      if (!reel) {
        return Response.json({ error: "Reel not found." }, { status: 404 });
      }
    } else {
      [reel] = await db
        .insert(reels)
        .values(reelValues)
        .returning({ id: reels.id });
    }

    if (parsed.data.renderPayload) {
      const job = createReelRenderJob({
        baseMetadata: renderBaseMetadata,
        payload: parsed.data.renderPayload,
        reelId: reel.id,
        targetStatus: parsed.data.status,
      });

      try {
        await enqueueReelRenderJob(job);
      } catch (error) {
        await setReelRenderState({
          baseMetadata: renderBaseMetadata,
          reelId: reel.id,
          render: {
            error:
              error instanceof Error
                ? error.message
                : "Could not queue this reel for processing.",
            jobId: job.id,
            progress: 100,
            status: "failed",
          },
          targetStatus: parsed.data.status,
          values: { status: "failed" },
        });

        return Response.json(
          { error: "Could not queue this reel for processing." },
          { status: 500 },
        );
      }
    } else if (parsed.data.status === "published") {
      await recordReelHashtagUsage(reel.id);
    }

    return Response.json({
      reelId: reel.id,
      status: initialStatus,
      renderProgress: shouldRender ? 5 : 100,
    });
  } catch (error) {
    console.error("[reels] save failed", error);

    return Response.json(
      { error: reelSaveErrorMessage(error) },
      { status: 500 },
    );
  }
}
