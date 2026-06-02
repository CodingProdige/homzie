import { createClient, type RedisClientType } from "redis";

import { renderPayloadSchema } from "./render-schema";
import type { ReelRenderJob } from "./render-job-state";

const QUEUE_KEY = "homzie:reel-render:queued";
const PROCESSING_KEY = "homzie:reel-render:processing";

let clientPromise: Promise<RedisClientType> | null = null;

function getRedisUrl() {
  return process.env.REDIS_URL || "redis://localhost:6380";
}

export async function getReelRenderQueueClient() {
  if (!clientPromise) {
    clientPromise = createClient({ url: getRedisUrl() })
      .on("error", (error) => {
        console.error("[reel-render-queue] Redis error", error);
      })
      .connect() as Promise<RedisClientType>;
  }

  return clientPromise;
}

export async function closeReelRenderQueueClient() {
  if (!clientPromise) return;

  const client = await clientPromise;
  clientPromise = null;
  await client.quit();
}

export function serializeReelRenderJob(job: ReelRenderJob) {
  return JSON.stringify(job);
}

export function parseReelRenderJob(value: string): ReelRenderJob {
  const parsed = JSON.parse(value) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid reel render job.");
  }

  const job = parsed as Record<string, unknown>;
  const payload = renderPayloadSchema.parse(job.payload);

  if (
    typeof job.id !== "string" ||
    typeof job.reelId !== "string" ||
    (job.targetStatus !== "draft" && job.targetStatus !== "published")
  ) {
    throw new Error("Invalid reel render job.");
  }

  return {
    baseMetadata:
      job.baseMetadata &&
      typeof job.baseMetadata === "object" &&
      !Array.isArray(job.baseMetadata)
        ? (job.baseMetadata as Record<string, unknown>)
        : {},
    id: job.id,
    payload,
    reelId: job.reelId,
    targetStatus: job.targetStatus,
  };
}

export async function enqueueReelRenderJob(job: ReelRenderJob) {
  const client = await getReelRenderQueueClient();
  await client.rPush(QUEUE_KEY, serializeReelRenderJob(job));
}

export async function reserveReelRenderJob(timeoutSeconds = 5) {
  const client = await getReelRenderQueueClient();
  const rawJob = await client.brPopLPush(
    QUEUE_KEY,
    PROCESSING_KEY,
    timeoutSeconds,
  );

  if (!rawJob) return null;

  return {
    job: parseReelRenderJob(rawJob),
    rawJob,
  };
}

export async function acknowledgeReelRenderJob(rawJob: string) {
  const client = await getReelRenderQueueClient();
  await client.lRem(PROCESSING_KEY, 1, rawJob);
}

export async function recoverInterruptedReelRenderJobs() {
  const client = await getReelRenderQueueClient();
  let recovered = 0;

  while (true) {
    const rawJob = await client.rPopLPush(PROCESSING_KEY, QUEUE_KEY);

    if (!rawJob) {
      return recovered;
    }

    recovered += 1;
  }
}
