import { readFileSync } from "node:fs";
import postgres from "postgres";

const [, , envFile] = process.argv;

if (!envFile) {
  console.error("Usage: node scripts/migrate-selfhost.mjs <env-file>");
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

for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const parsed = parseEnvLine(line);

  if (!parsed) continue;

  const [key, value] = parsed;
  process.env[key] = value;
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const databaseUrl = new URL(process.env.DATABASE_URL);

if (databaseUrl.hostname === "postgres") {
  databaseUrl.hostname = "127.0.0.1";
  databaseUrl.port = process.env.POSTGRES_HOST_PORT || "5433";
  process.env.DATABASE_URL = databaseUrl.toString();
}

async function waitForDatabase() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const sql = postgres(process.env.DATABASE_URL, {
      connect_timeout: 5,
      max: 1,
    });

    try {
      await sql`SELECT 1`;
      await sql.end();
      return;
    } catch (error) {
      await sql.end({ timeout: 1 }).catch(() => {});

      if (attempt === 30) throw error;

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

await waitForDatabase();
await import("./migrate.mjs");
