import { and, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";

import { db } from "@/db";
import { reels } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";

export const runtime = "nodejs";

function renderMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const render = (value as Record<string, unknown>).render;

  if (!render || typeof render !== "object" || Array.isArray(render)) {
    return null;
  }

  return render as Record<string, unknown>;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reelId: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return Response.json({ error: "Sign in to view this reel." }, { status: 401 });
  }

  const { reelId } = await params;
  const [reel] = await db
    .select({
      editMetadata: reels.editMetadata,
      id: reels.id,
      status: reels.status,
      videoPath: reels.videoPath,
    })
    .from(reels)
    .where(and(eq(reels.id, reelId), eq(reels.userId, session.user.id)))
    .limit(1);

  if (!reel) {
    return Response.json({ error: "Reel not found." }, { status: 404 });
  }

  const render = renderMetadata(reel.editMetadata);
  const progress =
    typeof render?.progress === "number"
      ? Math.max(0, Math.min(100, render.progress))
      : reel.status === "processing"
        ? 10
        : 100;

  return Response.json({
    error: typeof render?.error === "string" ? render.error : undefined,
    renderProgress: progress,
    renderStatus: typeof render?.status === "string" ? render.status : reel.status,
    status: reel.status,
    targetStatus:
      render?.targetStatus === "draft" || render?.targetStatus === "published"
        ? render.targetStatus
        : undefined,
    videoPath: reel.videoPath,
  });
}
