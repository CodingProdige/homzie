import { spawnSync } from "node:child_process";

const envFile = process.env.HOMZIE_ENV_FILE || "/mnt/c/Homzie/config/homzie.env";

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run("npm", ["ci"]);
run("npm", ["run", "lint"]);
run("npm", ["run", "build"]);
run("node", [`--env-file=${envFile}`, "scripts/migrate.mjs"]);
run("docker", [
  "compose",
  "--env-file",
  envFile,
  "-p",
  "homzie_selfhost",
  "--profile",
  "selfhost",
  "--profile",
  "tunnel",
  "up",
  "--build",
  "-d",
]);
