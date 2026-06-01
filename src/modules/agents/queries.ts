import { and, desc, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { agentProfiles, subscriptions } from "@/db/schema";

export async function getAgentProfileForUser(userId: string) {
  const [profile] = await db
    .select()
    .from(agentProfiles)
    .where(eq(agentProfiles.userId, userId))
    .limit(1);

  return profile || null;
}

export async function getActiveAgentSubscription(userId: string) {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.provider, "stripe"),
        eq(subscriptions.status, "active"),
        gt(subscriptions.currentPeriodEnd, new Date()),
      ),
    )
    .orderBy(desc(subscriptions.currentPeriodEnd))
    .limit(1);

  return subscription || null;
}

export async function hasActiveAgentSubscription(userId: string) {
  return Boolean(await getActiveAgentSubscription(userId));
}
