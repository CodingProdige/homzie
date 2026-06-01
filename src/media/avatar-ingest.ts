import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getMediaStorageRoot } from "./storage";

const maxAvatarBytes = 5 * 1024 * 1024;

const extensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function getAvatarExtension(contentType: string | null) {
  const normalizedType = contentType?.split(";")[0]?.trim().toLowerCase();
  return normalizedType ? extensionByType[normalizedType] || null : null;
}

function isAllowedRemoteAvatarUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "lh3.googleusercontent.com" ||
        url.hostname.endsWith(".googleusercontent.com"))
    );
  } catch {
    return false;
  }
}

export async function ingestGoogleAvatar(remoteUrl: string | null | undefined) {
  if (!remoteUrl || !isAllowedRemoteAvatarUrl(remoteUrl)) {
    return null;
  }

  try {
    const response = await fetch(remoteUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg;q=0.9",
      },
    });

    if (!response.ok) {
      return null;
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > maxAvatarBytes) {
      return null;
    }

    const extension = getAvatarExtension(response.headers.get("content-type"));
    if (!extension) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxAvatarBytes) {
      return null;
    }

    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const relativePath = `avatars/${year}/${month}/${randomUUID()}.${extension}`;
    const storagePath = path.join(getMediaStorageRoot(), relativePath);

    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, Buffer.from(arrayBuffer));

    return relativePath;
  } catch {
    return null;
  }
}
