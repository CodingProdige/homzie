import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { getPrimaryAgencyWorkspace } from "@/modules/agencies/server";

export type ViewerRole = "user" | "admin";

export type ViewerChrome = {
  hasAgencyWorkspace?: boolean;
  role?: ViewerRole;
  username?: string;
};

export async function getViewerChrome(
  userId?: string | null,
): Promise<ViewerChrome> {
  if (!userId) return {};

  const [viewer, agencyWorkspace] = await Promise.all([
    db
      .select({ role: users.role, username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) => rows[0]),
    getPrimaryAgencyWorkspace(userId),
  ]);

  return {
    hasAgencyWorkspace: Boolean(agencyWorkspace),
    role: viewer?.role,
    username: viewer?.username || undefined,
  };
}
