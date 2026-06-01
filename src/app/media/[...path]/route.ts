import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { notFound } from "next/navigation";

import { getMediaStorageRoot } from "@/media/storage";
import { isSafeMediaPath } from "@/media/paths";

export const runtime = "nodejs";

const contentTypeByExtension: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export async function GET(
  _request: Request,
  context: RouteContext<"/media/[...path]">,
) {
  const params = await context.params;
  const relativePath = params.path.join("/");

  if (!isSafeMediaPath(relativePath)) {
    notFound();
  }

  const mediaRoot = getMediaStorageRoot();
  const filePath = path.resolve(mediaRoot, relativePath);

  if (!filePath.startsWith(`${mediaRoot}${path.sep}`)) {
    notFound();
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      notFound();
    }

    const file = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();

    return new Response(file, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(file.byteLength),
        "Content-Type":
          contentTypeByExtension[extension] || "application/octet-stream",
      },
    });
  } catch {
    notFound();
  }
}
