import { spawnSync } from "node:child_process";

if (process.platform !== "win32") {
  spawnSync("pkill", ["-f", "next dev"], { stdio: "ignore" });
  spawnSync("pkill", ["-f", "message-realtime-server"], { stdio: "ignore" });
  spawnSync("pkill", ["-f", "reel-render-worker"], { stdio: "ignore" });
  spawnSync("pkill", ["-f", "drizzle-kit"], { stdio: "ignore" });
}

process.exit(0);
