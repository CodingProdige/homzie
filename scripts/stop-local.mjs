import { spawnSync } from "node:child_process";

if (process.platform !== "win32") {
  spawnSync("pkill", ["-f", "next dev"], { stdio: "ignore" });
}

process.exit(0);
