import { sql } from "../src/db";
import { sendDueBroadcastCampaigns } from "../src/modules/broadcasts/server";

const defaultIntervalMs = 60 * 1000;
const minimumIntervalMs = 60 * 1000;

let isShuttingDown = false;
let wakeTimer: NodeJS.Timeout | null = null;
let wakeSleepingLoop: (() => void) | null = null;

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const intervalMs = Math.max(
  minimumIntervalMs,
  numberFromEnv("BROADCAST_CRON_INTERVAL_MS", defaultIntervalMs),
);
const batchLimit = Math.max(
  1,
  Math.floor(numberFromEnv("BROADCAST_CRON_BATCH_LIMIT", 3)),
);

function log(message: string, context?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      context,
      message,
      service: "cron-worker",
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
      service: "cron-worker",
    }),
  );
}

function sleep(ms: number) {
  if (isShuttingDown) return Promise.resolve();

  return new Promise<void>((resolve) => {
    wakeSleepingLoop = resolve;
    wakeTimer = setTimeout(() => {
      wakeSleepingLoop = null;
      wakeTimer = null;
      resolve();
    }, ms);
  });
}

function requestShutdown() {
  if (isShuttingDown) return;

  isShuttingDown = true;
  log("Shutdown requested");

  if (wakeTimer) {
    clearTimeout(wakeTimer);
    wakeTimer = null;
  }

  wakeSleepingLoop?.();
  wakeSleepingLoop = null;
}

process.on("SIGINT", requestShutdown);
process.on("SIGTERM", requestShutdown);

async function runScheduledBroadcasts() {
  const startedAt = Date.now();
  const results = await sendDueBroadcastCampaigns(batchLimit);
  const elapsedMs = Date.now() - startedAt;

  if (!results.length) {
    log("No due broadcast campaigns", { elapsedMs });
    return;
  }

  log("Processed due broadcast campaigns", {
    elapsedMs,
    results,
  });
}

async function run() {
  log("Cron worker started", {
    batchLimit,
    intervalMs,
  });

  while (!isShuttingDown) {
    try {
      await runScheduledBroadcasts();
    } catch (error) {
      logError("Cron job failed", error);
    }

    await sleep(intervalMs);
  }
}

run()
  .catch((error) => {
    logError("Cron worker crashed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    log("Cron worker stopped");
    await sql.end({ timeout: 5 });
  });
