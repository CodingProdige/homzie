"use server";

import { and, eq, ilike, isNotNull } from "drizzle-orm";
import { getServerSession } from "next-auth";

import { db } from "@/db";
import { reels, users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { getHashtagSuggestions } from "@/modules/hashtags/server";
import {
  createReelRenderJob,
  setReelRenderState,
} from "@/modules/reels/server/render-job-state";
import { enqueueReelRenderJob } from "@/modules/reels/server/render-queue";
import { renderPayloadSchema } from "@/modules/reels/server/render-schema";

export async function getReelHashtagSuggestions(query: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return [];
  }

  return await getHashtagSuggestions(query);
}

export async function getReelMentionSuggestions(query: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return [];
  }

  const normalizedQuery = query.replace(/^@/, "").toLowerCase();
  const suggestions = await db
    .select({
      avatarUrl: users.avatarUrl,
      name: users.name,
      username: users.username,
    })
    .from(users)
    .where(
      normalizedQuery
        ? ilike(users.username, `${normalizedQuery}%`)
        : isNotNull(users.username),
    )
    .limit(8);

  return suggestions.filter((user) => user.username);
}

function metadataObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function getRenderTargetStatus(
  render: Record<string, unknown>,
): "draft" | "published" {
  return render.targetStatus === "draft" || render.targetStatus === "published"
    ? render.targetStatus
    : "published";
}

export async function retryReelRender(reelId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { error: "Sign in to retry this reel.", ok: false as const };
  }

  const [reel] = await db
    .select({
      editMetadata: reels.editMetadata,
      id: reels.id,
      status: reels.status,
    })
    .from(reels)
    .where(and(eq(reels.id, reelId), eq(reels.userId, session.user.id)))
    .limit(1);

  if (!reel) {
    return { error: "We could not find that reel.", ok: false as const };
  }

  const metadata = metadataObject(reel.editMetadata);
  const render = metadataObject(metadata.render);
  const parsedPayload = renderPayloadSchema.safeParse(metadata.renderPayload);

  if (!parsedPayload.success) {
    return {
      error: "This reel is missing the saved render details needed to retry.",
      ok: false as const,
    };
  }

  const targetStatus = getRenderTargetStatus(render);
  const baseMetadata = {
    ...metadata,
    renderPayload: parsedPayload.data,
  };
  const job = createReelRenderJob({
    baseMetadata,
    payload: parsedPayload.data,
    reelId: reel.id,
    targetStatus,
  });

  await setReelRenderState({
    baseMetadata,
    reelId: reel.id,
    render: {
      jobId: job.id,
      progress: 5,
      status: "queued",
    },
    targetStatus,
    values: { status: "processing" },
  });

  try {
    await enqueueReelRenderJob(job);
  } catch (error) {
    await setReelRenderState({
      baseMetadata,
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
      targetStatus,
      values: { status: "failed" },
    });

    return {
      error: "We could not restart processing right now. Please try again.",
      ok: false as const,
    };
  }

  return {
    ok: true as const,
    progress: 5,
    reelId: reel.id,
    targetStatus,
  };
}
