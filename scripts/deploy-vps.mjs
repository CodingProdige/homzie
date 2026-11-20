import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const envFile = path.resolve(process.argv[2] || "/srv/homzie/config/homzie.env");

function fail(message) {
  throw new Error(message);
}

try {
  if (process.argv.length > 3) fail("Usage: node scripts/deploy-vps.mjs [absolute-env-file]");
  const relativeEnvPath = path.relative(projectRoot, envFile);
  if (!relativeEnvPath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeEnvPath)) {
    fail("Keep the production environment file outside the application directory.");
  }
  const settings = parseEnv(readFileSync(envFile, "utf8"));
  if ((statSync(envFile).mode & 0o077) !== 0) {
    fail("Protect the production environment file with chmod 600 before deploying.");
  }
  for (const key of ["DOMAIN", "APP_URL", "AUTH_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_SITE_URL", "AUTH_SECRET", "POSTGRES_PASSWORD", "DATABASE_URL", "REDIS_URL", "CADDY_EMAIL"]) {
    if (!settings[key]?.trim()) fail(`Missing required setting: ${key}`);
  }
  const domain = settings.DOMAIN;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(domain)) {
    fail("DOMAIN must be a DNS hostname without a scheme, path, or port.");
  }
  for (const key of ["APP_URL", "AUTH_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_SITE_URL"]) {
    if (settings[key].replace(/\/$/, "") !== `https://${domain}`) {
      fail(`${key} must match https://DOMAIN for production login and links.`);
    }
  }
  for (const [key, minimum] of [["AUTH_SECRET", 32], ["POSTGRES_PASSWORD", 24]]) {
    if (settings[key].length < minimum || /replace|change-me|example|local-password/i.test(settings[key])) {
      fail(`${key} must be a strong generated secret (at least ${minimum} characters).`);
    }
  }
  const database = new URL(settings.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || database.hostname !== "postgres" || database.port !== "5432" ||
      decodeURIComponent(database.username) !== (settings.POSTGRES_USER || "homzie") ||
      decodeURIComponent(database.password) !== settings.POSTGRES_PASSWORD ||
      decodeURIComponent(database.pathname.slice(1)) !== (settings.POSTGRES_DB || "homzie")) {
    fail("DATABASE_URL must use the VPS postgres:5432 service and match POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB.");
  }
  if (settings.REDIS_URL !== "redis://redis:6379") {
    fail("REDIS_URL must be redis://redis:6379 for this VPS stack.");
  }
  const storageRoot = settings.HOMZIE_STORAGE_ROOT || "/srv/homzie/storage";
  if (!path.isAbsolute(storageRoot)) fail("HOMZIE_STORAGE_ROOT must be an absolute path.");
  for (const directory of ["media", "videos", "thumbnails", "exports", "backups"]) {
    const target = path.join(storageRoot, directory);
    if (!existsSync(target) || !statSync(target).isDirectory()) {
      fail(`Create the persistent storage directory before deploying: ${target}`);
    }
  }
  // Nested bind targets must exist before Caddy mounts the parent media directory read-only.
  for (const directory of ["videos", "thumbnails", "exports", "backups"]) {
    mkdirSync(path.join(storageRoot, "media", directory), { recursive: true, mode: 0o755 });
  }

  const environment = {
    ...process.env,
    ...settings,
    HOMZIE_ENV_FILE: envFile,
    NEXT_DEPLOYMENT_ID: process.env.NEXT_DEPLOYMENT_ID || settings.NEXT_DEPLOYMENT_ID || "",
  };
  const baseArgs = ["compose", "--env-file", envFile, "-f", "docker-compose.vps.yml", "-p", "homzie_vps"];
  function compose(args, options = {}) {
    const result = spawnSync("docker", [...baseArgs, ...args], {
      cwd: projectRoot,
      env: environment,
      stdio: "inherit",
      shell: false,
      ...options,
    });
    if (result.error) fail(`Could not run Docker: ${result.error.message}`);
    if (result.status !== 0) fail(`Docker operation failed (${args[0]}). Deployment stopped.`);
  }

  compose(["config", "--quiet"]);
  // Build targets sequentially so a small VPS can reuse the common builder cache.
  for (const service of ["web", "worker", "realtime"]) {
    compose(["build", service]);
  }
  compose(["up", "-d", "--wait", "--wait-timeout", "120", "postgres", "redis"]);

  // Always retain a database snapshot before the schema migration, including on first install.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(storageRoot, "backups", `pre-deploy-${stamp}-${process.pid}.dump`);
  const backupFd = openSync(backup, "wx", 0o600);
  try {
    compose(["exec", "-T", "postgres", "sh", "-c", 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom'], {
      stdio: ["ignore", backupFd, "inherit"],
    });
  } catch (error) {
    unlinkSync(backup);
    throw error;
  } finally {
    closeSync(backupFd);
  }
  if (statSync(backup).size === 0) fail("Database backup is empty. Migration was not started.");
  console.log(`Database backup saved: ${backup}`);

  compose(["run", "--rm", "--no-deps", "-T", "worker", "node", "scripts/migrate.mjs"], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  compose(["up", "-d", "--no-build", "postgres", "redis", "web", "worker", "realtime", "caddy"]);
  compose(["ps"]);
  console.log(`Containers started for https://${domain}. Verify HTTPS, login, and media before the meeting.`);
  console.log("Cron and TURN remain opt-in; see docs/deployment.md for the VPS commands.");
} catch (error) {
  // Do not print URLs from environment parsing errors: they may contain credentials.
  console.error(error instanceof TypeError ? "Invalid configuration value. Check the production environment file." : error.message);
  process.exitCode = 1;
}
