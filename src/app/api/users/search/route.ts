import { and, asc, ilike, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import { normalizeUsername } from "@/modules/auth/username";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = normalizeUsername(searchParams.get("q") || "");

  if (query.length < 2) {
    return Response.json({ users: [] });
  }

  const results = await db
    .select({
      avatarUrl: users.avatarUrl,
      name: users.name,
      username: users.username,
    })
    .from(users)
    .where(and(isNotNull(users.username), ilike(users.username, `${query}%`)))
    .orderBy(asc(users.username))
    .limit(8);

  return Response.json({
    users: results
      .filter((user) => Boolean(user.username))
      .map((user) => ({
        avatarUrl: toPublicMediaUrl(user.avatarUrl),
        name: user.name,
        username: user.username || "",
      })),
  });
}
