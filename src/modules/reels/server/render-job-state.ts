import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { reels } from "@/db/schema";

import type { RenderPayload } from "./render-schema";

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
