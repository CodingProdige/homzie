import { recordReelHashtagUsage } from "@/modules/hashtags/server";

import { renderReelMedia } from "./render-reel";
import { setReelRenderState, type ReelRenderJob } from "./render-job-state";

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
      try {
        await recordReelHashtagUsage(job.reelId);
      } catch (error) {
        console.error("[reels] hashtag usage failed after render", {
          error: error instanceof Error ? error.message : String(error),
          reelId: job.reelId,
        });
      }
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
