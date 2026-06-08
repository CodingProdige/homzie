import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

export type ViewerRole = "user" | "admin";

export type ViewerChrome = {
  role?: ViewerRole;
  username?: string;
};

export async function getViewerChrome(
  userId?: string | null,
): Promise<ViewerChrome> {
  if (!userId) return {};

  const [viewer] = await db
    .select({ role: users.role, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return {
    role: viewer?.role,
    username: viewer?.username || undefined,
  };
}
