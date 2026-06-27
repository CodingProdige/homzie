import "server-only";

import { createClient, type RedisClientType } from "redis";

export const userNotificationChannel = "homzie:user-notifications";

let redisClient: RedisClientType | null = null;

async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6380",
    });

    redisClient.on("error", (error) => {
      console.error("User notification realtime Redis error", error);
    });
  }

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  return redisClient;
}

export type UserNotificationRealtimeEvent = {
  conversationId?: string | null;
  createdAt: string;
  entityId?: string | null;
  entityType?: string | null;
  eventId?: string | null;
  eventType: string;
  listingId?: string | null;
  messageId?: string | null;
  reelId?: string | null;
  type: "user.notification.created";
  userId: string;
};

export async function publishUserNotificationEvent(
  event: UserNotificationRealtimeEvent,
) {
  try {
    const client = await getRedisClient();

    await client.publish(userNotificationChannel, JSON.stringify(event));
  } catch (error) {
    console.error("Failed to publish user notification realtime event", error);
  }
}
