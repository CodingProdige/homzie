import { getServerSession } from "next-auth";

import { sql } from "@/db";
import {
  countBroadcastAudience,
  countBroadcastAudienceByRole,
} from "@/modules/broadcasts/audience";
import { normalizeBroadcastAudience } from "@/modules/broadcasts/server";
import { authOptions } from "@/modules/auth/config";

export const runtime = "nodejs";

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

  const payload = await request.json().catch(() => null);
  const audience = normalizeBroadcastAudience(
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).audience
      : null,
  );

  const [count, roleCounts] = await Promise.all([
    countBroadcastAudience(audience),
    countBroadcastAudienceByRole(audience),
  ]);

  return Response.json({ count, roleCounts });
}
