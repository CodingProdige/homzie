import { sql } from "../src/db";
import {
  acknowledgeReelRenderJob,
  closeReelRenderQueueClient,
  recoverInterruptedReelRenderJobs,
  reserveReelRenderJob,
} from "../src/modules/reels/server/render-queue";
import { runReelRenderJob } from "../src/modules/reels/server/render-job";

let isShuttingDown = false;

function log(message: string, context?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      context,
      message,
      service: "reel-render-worker",
    }),
  );
}

function logError(message: string, error: unknown, context?: Record<string, unknown>) {
  console.error(
    JSON.stringify({
      at: new Date().toISOString(),
      context,
      error: error instanceof Error ? error.message : String(error),
      message,
      service: "reel-render-worker",
    }),
  );
}

async function shutdown() {
  if (isShuttingDown) return;

  isShuttingDown = true;
  log("Shutting down");
  await closeReelRenderQueueClient();
  await sql.end({ timeout: 5 });
}

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

async function run() {
  const recovered = await recoverInterruptedReelRenderJobs();

  if (recovered > 0) {
    log("Recovered interrupted render jobs", { recovered });
  }

  log("Worker started");

  while (!isShuttingDown) {
    const reserved = await reserveReelRenderJob(5);

    if (!reserved) {
      continue;
    }

    const { job, rawJob } = reserved;

    try {
      log("Rendering reel", { jobId: job.id, reelId: job.reelId });
      await runReelRenderJob(job);
      await acknowledgeReelRenderJob(rawJob);
      log("Rendered reel", { jobId: job.id, reelId: job.reelId });
    } catch (error) {
      await acknowledgeReelRenderJob(rawJob);
      logError("Render job failed", error, {
        jobId: job.id,
        reelId: job.reelId,
      });
    }
  }
}

run()
  .catch((error) => {
    logError("Worker crashed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await shutdown();
  });
