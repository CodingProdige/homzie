import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [, , envFile, command, ...args] = process.argv;

if (!envFile || !command) {
  console.error("Usage: node scripts/run-with-env-file.mjs <env-file> <command> [...args]");
  process.exit(1);
}

function parseEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) return null;

  const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
  const separatorIndex = normalized.indexOf("=");

  if (separatorIndex < 1) return null;

  const key = normalized.slice(0, separatorIndex).trim();
  let value = normalized.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value.replace(/\\n/g, "\n")];
}

const env = { ...process.env };

for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const parsed = parseEnvLine(line);

  if (!parsed) continue;

  const [key, value] = parsed;
  env[key] = value;
}

if (command === "npm" && args[0] === "run" && args[1] === "build") {
  env.HOMZIE_SKIP_DATABASE_DURING_BUILD ??= "1";
}

const result = spawnSync(command, args, {
  env,
  shell: false,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
