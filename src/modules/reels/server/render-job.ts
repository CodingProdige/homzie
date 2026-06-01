import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { reels } from "@/db/schema";
import { recordReelHashtagUsage } from "@/modules/hashtags/server";

import { renderReelMedia, type RenderPayload } from "./render-reel";

export type ReelRenderJob = {
  baseMetadata: Record<string, unknown>;
  id: string;
  payload: RenderPayload;
  reelId: string;
  targetStatus: "draft" | "published";
};

export function createReelRenderJob({
  baseMetadata,
  payload,
  reelId,
  targetStatus,
}: Omit<ReelRenderJob, "id">): ReelRenderJob {
  return {
    baseMetadata,
    id: randomUUID(),
    payload,
    reelId,
    targetStatus,
  };
}

export async function setReelRenderState({
  baseMetadata,
  reelId,
  render,
  targetStatus,
  values = {},
}: {
  baseMetadata: Record<string, unknown>;
  reelId: string;
  render: Record<string, unknown>;
  targetStatus: "draft" | "published";
  values?: Partial<typeof reels.$inferInsert>;
}) {
  await db
    .update(reels)
    .set({
      ...values,
      editMetadata: {
        ...baseMetadata,
        render: {
          targetStatus,
          ...render,
        },
      },
      updatedAt: new Date(),
    })
    .where(eq(reels.id, reelId));
}

export async function runReelRenderJob(job: ReelRenderJob) {
  try {
    await setReelRenderState({
      baseMetadata: job.baseMetadata,
      reelId: job.reelId,
      render: { jobId: job.id, progress: 15, status: "rendering" },
      targetStatus: job.targetStatus,
    });

    const rendered = await renderReelMedia(job.payload);

    await setReelRenderState({
      baseMetadata: job.baseMetadata,
      reelId: job.reelId,
      render: {
        jobId: job.id,
        mediaPath: rendered.mediaPath,
        mediaUrl: rendered.mediaUrl,
        progress: 100,
        status: "complete",
      },
      targetStatus: job.targetStatus,
      values: {
        status: job.targetStatus,
        videoPath: rendered.mediaPath,
      },
    });

    if (job.targetStatus === "published") {
      await recordReelHashtagUsage(job.reelId);
    }
  } catch (error) {
    await setReelRenderState({
      baseMetadata: job.baseMetadata,
      reelId: job.reelId,
      render: {
        error:
          error instanceof Error ? error.message : "Could not render this reel.",
        jobId: job.id,
        progress: 100,
        status: "failed",
      },
      targetStatus: job.targetStatus,
      values: {
        status: "failed",
      },
    });

    throw error;
  }
}
