"use server";

import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/modules/auth/config";
import {
  removeWebPushSubscription,
  saveWebPushSubscription,
} from "@/modules/push/server";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    auth: z.string().min(1),
    p256dh: z.string().min(1),
  }),
});

async function requireUserId() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("You must be signed in.");
  }

  return userId;
}

export async function getWebPushPublicKeyAction() {
  return process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || "";
}

export async function saveWebPushSubscriptionAction(input: unknown) {
  const userId = await requireUserId();
  const parsed = subscriptionSchema.parse(input);

  await saveWebPushSubscription({
    auth: parsed.keys.auth,
    endpoint: parsed.endpoint,
    p256dh: parsed.keys.p256dh,
    userAgent: null,
    userId,
  });

  return { ok: true as const };
}

export async function removeWebPushSubscriptionAction(endpoint: string) {
  await requireUserId();
  await removeWebPushSubscription(endpoint);

  return { ok: true as const };
}
