import webpush, { type PushSubscription } from "web-push";

import { sql } from "@/db";

type NotificationPayload = {
  body: string;
  data?: Record<string, string>;
  tag?: string;
  title: string;
};

type SubscriptionRow = {
  auth: string;
  endpoint: string;
  p256dh: string;
};

type PushPreferenceRow = {
  push_enabled: boolean;
};

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject =
    process.env.WEB_PUSH_VAPID_SUBJECT ||
    `mailto:${process.env.ADMIN_EMAIL || "hello@homzie.co.za"}`;

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);

  return true;
}

export async function saveWebPushSubscription({
  auth,
  endpoint,
  p256dh,
  userAgent,
  userId,
}: {
  auth: string;
  endpoint: string;
  p256dh: string;
  userAgent?: string | null;
  userId: string;
}) {
  await sql`
    INSERT INTO web_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    VALUES (${userId}, ${endpoint}, ${p256dh}, ${auth}, ${userAgent || null})
    ON CONFLICT (endpoint)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      user_agent = EXCLUDED.user_agent,
      updated_at = now()
  `;
}

export async function removeWebPushSubscription(endpoint: string) {
  await sql`
    DELETE FROM web_push_subscriptions
    WHERE endpoint = ${endpoint}
  `;
}

export async function sendPushToUser(userId: string, payload: NotificationPayload) {
  if (!configureWebPush()) return;

  const [preferences] = await sql<PushPreferenceRow[]>`
    SELECT push_enabled
    FROM user_notification_preferences
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  if (preferences && !preferences.push_enabled) return;

  const subscriptions = await sql<SubscriptionRow[]>`
    SELECT endpoint, p256dh, auth
    FROM web_push_subscriptions
    WHERE user_id = ${userId}
  `;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              auth: subscription.auth,
              p256dh: subscription.p256dh,
            },
          } satisfies PushSubscription,
          JSON.stringify(payload),
        );
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number(error.statusCode)
            : null;

        if (statusCode === 404 || statusCode === 410) {
          await removeWebPushSubscription(subscription.endpoint);
        }
      }
    }),
  );
}
