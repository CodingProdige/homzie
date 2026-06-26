import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/modules/auth/config";
import { captureClientErrorBoundaryLog } from "@/modules/error-logs/server";

const clientErrorLogSchema = z.object({
  boundary: z.enum(["app", "global"]),
  digest: z.string().trim().max(240).optional().nullable(),
  message: z.string().trim().max(1200).optional().nullable(),
  path: z.string().trim().max(600).optional().nullable(),
  stack: z.string().trim().max(8000).optional().nullable(),
});

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) return true;

  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  const parsed = clientErrorLogSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid error log payload." }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const errorLogId = await captureClientErrorBoundaryLog({
    ...parsed.data,
    userAgent: request.headers.get("user-agent"),
    userId: session?.user?.id || null,
    username: session?.user?.username || null,
  });

  return NextResponse.json({ errorLogId, ok: true });
}
