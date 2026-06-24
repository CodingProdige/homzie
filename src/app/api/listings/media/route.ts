import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getServerSession } from "next-auth";

import { getMediaStorageRoot } from "@/media/storage";
import { authOptions } from "@/modules/auth/config";

export const runtime = "nodejs";

const maxListingImageBytes = 15 * 1024 * 1024;
const maxListingVideoBytes = 80 * 1024 * 1024;
const listingImageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const listingVideoTypes: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return Response.json(
      { error: "Sign in to upload listing media." },
      { status: 401 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size <= 0) {
    return Response.json(
      { error: "Choose a listing image or video." },
      { status: 400 },
    );
  }

  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");

  if (isImage && file.size > maxListingImageBytes) {
    return Response.json(
      { error: "Listing images must be 15MB or smaller after optimization." },
      { status: 400 },
    );
  }

  if (isVideo && file.size > maxListingVideoBytes) {
    return Response.json(
      { error: "Listing videos must be 80MB or smaller after optimization." },
      { status: 400 },
    );
  }

  const extension = isVideo
    ? listingVideoTypes[file.type]
    : listingImageTypes[file.type];

  if (!extension) {
    return Response.json(
      { error: "Upload JPG, PNG, WebP, MP4, MOV, or WebM listing media." },
      { status: 400 },
    );
  }

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const fileName = `${randomUUID()}.${extension}`;
  const relativePath = ["listings", year, month, fileName].join("/");
  const storagePath = path.join(
    /*turbopackIgnore: true*/ getMediaStorageRoot(),
    relativePath,
  );
  const bytes = Buffer.from(await file.arrayBuffer());

  await mkdir(path.dirname(storagePath), { recursive: true });
  await writeFile(storagePath, bytes);

  return Response.json({
    media: {
      name: file.name,
      path: relativePath,
      size: file.size,
      type: file.type,
    },
  });
}
