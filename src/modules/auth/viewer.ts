import "server-only";

import { eq } from "drizzle-orm";
import { getServerSession } from "next-auth";

import { db } from "@/db";
import { users } from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import { getPrimaryAgencyWorkspace } from "@/modules/agencies/server";
import { authOptions } from "@/modules/auth/config";

export type ViewerRole = "user" | "admin";

export type ViewerChrome = {
  avatarUrl?: string;
  hasAgencyWorkspace?: boolean;
  name?: string;
  role?: ViewerRole;
  username?: string;
};

export async function getCurrentViewerChrome(): Promise<ViewerChrome> {
  const session = await getServerSession(authOptions);

  return getViewerChrome(session?.user?.id);
}

export async function getViewerChrome(
  userId?: string | null,
): Promise<ViewerChrome> {
  if (!userId) return {};

  const [viewer, agencyWorkspace] = await Promise.all([
    db
      .select({
        avatarUrl: users.avatarUrl,
        name: users.name,
        role: users.role,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) => rows[0]),
    getPrimaryAgencyWorkspace(userId),
  ]);

  return {
    avatarUrl: toPublicMediaUrl(viewer?.avatarUrl) || undefined,
    hasAgencyWorkspace: Boolean(agencyWorkspace),
    name: viewer?.name || undefined,
    role: viewer?.role,
    username: viewer?.username || undefined,
  };
}
