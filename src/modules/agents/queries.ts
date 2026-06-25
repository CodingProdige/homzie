import { eq } from "drizzle-orm";

import { db } from "@/db";
import { agentProfiles } from "@/db/schema";
export {
  getActiveAgentSubscription,
  hasActiveAgentSubscription,
} from "@/modules/access/agent-access";

export async function getAgentProfileForUser(userId: string) {
  const [profile] = await db
    .select()
    .from(agentProfiles)
    .where(eq(agentProfiles.userId, userId))
    .limit(1);

  return profile || null;
}
