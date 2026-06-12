export function shouldSkipDatabaseDuringBuild() {
  return process.env.HOMZIE_SKIP_DATABASE_DURING_BUILD === "1";
}
