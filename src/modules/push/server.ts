import webpush, { type PushSubscription } from "web-push";

import { sql } from "@/db";
import type { NotificationPreferenceCategory } from "@/modules/notifications/registry";

type NotificationPayload = {
  badge?: string;
  body: string;
  data?: Record<string, string>;
  icon?: string;
  image?: string;
  tag?: string;
  title: string;
};

type SubscriptionRow = {
  auth: string;
  endpoint: string;
  p256dh: string;
};

type PushPreferenceRow = {
  listing_activity_enabled: boolean;
  messages_enabled: boolean;
  profile_activity_enabled: boolean;
  push_enabled: boolean;
  reel_activity_enabled: boolean;
};

const defaultNotificationIcon = "/favicon/web-app-manifest-192x192.png";
const defaultNotificationBadge = "/favicon/favicon-96x96.png";

function pushPreferenceAllows(
  preferences: PushPreferenceRow | undefined,
  category?: NotificationPreferenceCategory,
) {
  if (!preferences) return true;
  if (!preferences.push_enabled) return false;

  if (category === "messages") return preferences.messages_enabled;
  if (category === "listingActivity") return preferences.listing_activity_enabled;
  if (category === "reelActivity") return preferences.reel_activity_enabled;
  if (category === "profileActivity") return preferences.profile_activity_enabled;

  return true;
}

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

export async function sendPushToUser(
  userId: string,
  payload: NotificationPayload,
  options: { preferenceCategory?: NotificationPreferenceCategory } = {},
) {
  if (!configureWebPush()) return;

  const [preferences] = await sql<PushPreferenceRow[]>`
    SELECT
      push_enabled,
      messages_enabled,
      listing_activity_enabled,
      reel_activity_enabled,
      profile_activity_enabled
    FROM user_notification_preferences
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  if (!pushPreferenceAllows(preferences, options.preferenceCategory)) return;

  const subscriptions = await sql<SubscriptionRow[]>`
    SELECT endpoint, p256dh, auth
    FROM web_push_subscriptions
    WHERE user_id = ${userId}
  `;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        const notificationPayload: NotificationPayload = {
          ...payload,
          badge: payload.badge || defaultNotificationBadge,
          icon: payload.icon || defaultNotificationIcon,
        };

        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              auth: subscription.auth,
              p256dh: subscription.p256dh,
            },
          } satisfies PushSubscription,
          JSON.stringify(notificationPayload),
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
