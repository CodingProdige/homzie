import { sql } from "@/db";
import {
  absoluteAppUrl,
  notifyUser,
} from "@/modules/email/server";
import { recordReelHashtagUsage } from "@/modules/hashtags/server";

import { renderReelMedia } from "./render-reel";
import { setReelRenderState, type ReelRenderJob } from "./render-job-state";

async function notifyFollowersAboutPublishedReel(reelId: string) {
  const [reel] = await sql<{
    caption: string | null;
    owner_name: string;
    owner_user_id: string;
    username: string | null;
  }[]>`
    SELECT
      r.caption,
      r.user_id AS owner_user_id,
      u.name AS owner_name,
      u.username
    FROM reels r
    JOIN users u ON u.id = r.user_id
    WHERE r.id = ${reelId}
      AND r.status = 'published'
    LIMIT 1
  `;

  if (!reel) return;

  const followers = await sql<{
    follower_id: string;
    name: string;
  }[]>`
    SELECT u.id AS follower_id, u.name
    FROM user_follows uf
    JOIN users u ON u.id = uf.follower_id
    WHERE uf.following_id = ${reel.owner_user_id}
      AND u.status = 'active'
      AND u.deleted_at IS NULL
  `;

  await Promise.allSettled(
    followers.map((follower) =>
      notifyUser({
        eventKey: "reel.new_from_followed_profile",
        preferenceCategory: "reelActivity",
        templateKey: "reel.new_from_followed_profile",
        userId: follower.follower_id,
        variables: {
          agent: {
            name: reel.owner_name,
            username: reel.username || "",
          },
          app: {
            name: "Homzie",
            url: absoluteAppUrl("/"),
          },
          reel: {
            caption: reel.caption || "A new property reel is live.",
            url: absoluteAppUrl(
              reel.username ? `/users/${reel.username}/reels` : "/reels",
            ),
          },
          user: {
            firstName: follower.name.split(/\s+/)[0] || follower.name,
            name: follower.name,
          },
        },
      }),
    ),
  );
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
      try {
        await recordReelHashtagUsage(job.reelId);
      } catch (error) {
        console.error("[reels] hashtag usage failed after render", {
          error: error instanceof Error ? error.message : String(error),
          reelId: job.reelId,
        });
      }
      await notifyFollowersAboutPublishedReel(job.reelId);
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
