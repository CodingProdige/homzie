import path from "node:path";

export function getMediaStorageRoot() {
  const configuredRoot = process.env.MEDIA_STORAGE_PATH || process.env.MEDIA_ROOT;

  if (configuredRoot) {
    return path.resolve(/*turbopackIgnore: true*/ configuredRoot);
  }

  return path.resolve(process.cwd(), "storage", "media");
}
