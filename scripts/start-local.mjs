import { spawn, spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const setup = spawnSync(npmCommand, ["run", "db:setup"], {
  stdio: "inherit",
});

if (setup.status !== 0) {
  process.exit(setup.status || 1);
}

const worker = spawn(npmCommand, ["run", "worker:reels"], {
  stdio: "inherit",
});
const messages = spawn(npmCommand, ["run", "start:messages"], {
  stdio: "inherit",
});
const web = spawn(npmCommand, ["run", "dev:web"], {
  stdio: "inherit",
});
const studio = spawn(npmCommand, ["run", "db:studio"], {
  stdio: "inherit",
});

let isShuttingDown = false;

function shutdown(code = 0) {
  if (isShuttingDown) return;

  isShuttingDown = true;
  worker.kill("SIGTERM");
  messages.kill("SIGTERM");
  web.kill("SIGTERM");
  studio.kill("SIGTERM");
  process.exit(code);
}

worker.on("exit", (code) => {
  if (!isShuttingDown) {
    shutdown(code || 0);
  }
});

messages.on("exit", (code) => {
  if (!isShuttingDown) {
    shutdown(code || 0);
  }
});

web.on("exit", (code) => {
  if (!isShuttingDown) {
    shutdown(code || 0);
  }
});

studio.on("exit", (code) => {
  if (!isShuttingDown) {
    shutdown(code || 0);
  }
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
