"use server";

import { getServerSession } from "next-auth";

import { authOptions } from "@/modules/auth/config";
import { getUnseenEventCount, markUserEventsSeen } from "@/modules/events/server";

async function requireUserId() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) return null;

  return userId;
}

export async function getUnseenEventCountAction() {
  const userId = await requireUserId();

  if (!userId) return 0;

  return getUnseenEventCount(userId);
}

export async function markUserEventsSeenAction() {
  const userId = await requireUserId();

  if (!userId) return 0;

  await markUserEventsSeen(userId);

  return 0;
}
