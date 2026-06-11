import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { profileViewEvents, users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";

const requestSchema = z.object({
  profileUserId: z.string().uuid(),
  source: z.string().trim().min(1).max(80).optional().default("profile_page"),
  viewerSessionId: z.string().trim().min(1).max(160),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  let parsed: z.infer<typeof requestSchema>;

  try {
    parsed = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid profile view request." }, { status: 400 });
  }

  const viewerUserId = session?.user?.id || null;

  const [profileOwner] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, parsed.profileUserId),
        eq(users.status, "active"),
        eq(users.profileVisible, true),
      ),
    )
    .limit(1);

  if (!profileOwner) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  if (viewerUserId && viewerUserId === parsed.profileUserId) {
    return NextResponse.json({ ok: true });
  }

  await db
    .insert(profileViewEvents)
    .values({
      profileUserId: parsed.profileUserId,
      source: parsed.source,
      viewerSessionId: parsed.viewerSessionId,
      viewerUserId,
    })
    .onConflictDoNothing({
      target: [
        profileViewEvents.profileUserId,
        profileViewEvents.viewerSessionId,
      ],
    });

  return NextResponse.json({ ok: true });
}
