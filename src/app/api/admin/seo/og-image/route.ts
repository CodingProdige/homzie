import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getServerSession } from "next-auth";

import { sql } from "@/db";
import { getMediaStorageRoot } from "@/media/storage";
import { authOptions } from "@/modules/auth/config";

export const runtime = "nodejs";

const maxOgImageBytes = 2 * 1024 * 1024;
const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function isAdmin(userId: string) {
  const [row] = await sql<[{ role: string; status: string }?]>`
    SELECT role, status FROM users WHERE id = ${userId} LIMIT 1
  `;

  return row?.role === "admin" && row?.status === "active";
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!(await isAdmin(session.user.id))) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("image");

  if (!(file instanceof File)) {
    return Response.json({ error: "Image file required." }, { status: 400 });
  }

  const extension = imageExtensions[file.type];

  if (!extension) {
    return Response.json(
      { error: "Upload a JPG, PNG, or WebP image." },
      { status: 400 },
    );
  }

  if (file.size > maxOgImageBytes) {
    return Response.json(
      { error: "OG images must be 2MB or smaller after compression." },
      { status: 400 },
    );
  }

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const fileName = `${randomUUID()}.${extension}`;
  const relativePath = ["seo", "og", year, month, fileName].join("/");
  const storagePath = path.join(
    /*turbopackIgnore: true*/ getMediaStorageRoot(),
    "seo",
    "og",
    year,
    month,
    fileName,
  );

  await mkdir(path.dirname(storagePath), { recursive: true });
  await writeFile(storagePath, Buffer.from(await file.arrayBuffer()));

  return Response.json({
    imagePath: relativePath,
    imageUrl: `/media/${relativePath}`,
  });
}
