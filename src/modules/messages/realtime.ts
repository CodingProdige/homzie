import { createClient, type RedisClientType } from "redis";

const messageChannel = "homzie:messages";

let redisClient: RedisClientType | null = null;

async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6380",
    });

    redisClient.on("error", (error) => {
      console.error("Message realtime Redis error", error);
    });
  }

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  return redisClient;
}

export type MessageRealtimeEvent =
  | {
      type: "message.created";
      conversationId: string;
      participantUserIds: string[];
      messageId: string;
    }
  | {
      type: "conversation.read";
      conversationId: string;
      readerUserId: string;
      participantUserIds: string[];
      readAt: string;
    }
  | {
      type: "message.delivered";
      conversationId: string;
      messageId: string;
      userId: string;
      participantUserIds: string[];
      deliveredAt: string;
    }
  | {
      type: "conversation.updated";
      conversationId: string;
      participantUserIds: string[];
    };

export async function publishMessageEvent(event: MessageRealtimeEvent) {
  try {
    const client = await getRedisClient();

    await client.publish(messageChannel, JSON.stringify(event));
  } catch (error) {
    console.error("Failed to publish message realtime event", error);
  }
}

export { messageChannel };
