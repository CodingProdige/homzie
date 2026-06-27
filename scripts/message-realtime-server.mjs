import { createServer } from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import { parse as parseCookieHeaderValue } from "cookie";
import { getToken } from "next-auth/jwt";
import postgres from "postgres";
import { createClient } from "redis";
import { Server } from "socket.io";

const port = Number(process.env.MESSAGE_SOCKET_PORT || 3001);
const redisUrl = process.env.REDIS_URL || "redis://localhost:6380";
const databaseUrl = process.env.DATABASE_URL;
const messageChannel = "homzie:messages";
const primarySessionCookieName =
  process.env.NODE_ENV === "production"
    ? "__Secure-homzie.session-token"
    : "homzie.session-token";
const sessionCookieNames =
  process.env.NODE_ENV === "production"
    ? [primarySessionCookieName, "__Secure-next-auth.session-token"]
    : [primarySessionCookieName, "next-auth.session-token"];

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    credentials: true,
    origin: process.env.APP_URL || process.env.NEXTAUTH_URL || true,
  },
  path: "/socket.io",
});

const pubClient = createClient({ url: redisUrl });
const subClient = pubClient.duplicate();
const eventsClient = pubClient.duplicate();
const presenceClient = pubClient.duplicate();
const sql = databaseUrl ? postgres(databaseUrl, { max: 2, prepare: false }) : null;

for (const client of [pubClient, subClient, eventsClient, presenceClient]) {
  client.on("error", (error) => {
    console.error("Messaging realtime Redis error", error);
  });
}

await pubClient.connect();
await subClient.connect();
await eventsClient.connect();
await presenceClient.connect();

io.adapter(createAdapter(pubClient, subClient));

function getCookieHeader(cookie) {
  if (Array.isArray(cookie)) {
    return cookie.join("; ");
  }

  return cookie || "";
}

function hasCookie(cookieHeader, cookieName) {
  return cookieHeader
    .split(";")
    .some((cookie) => cookie.trim().startsWith(`${cookieName}=`));
}

function getTokenRequest(socket, cookieHeader) {
  return {
    cookies: parseCookieHeaderValue(cookieHeader),
    headers: socket.request.headers,
  };
}

function getAuthSecrets() {
  const configuredSecrets = [
    { name: "AUTH_SECRET", value: process.env.AUTH_SECRET },
    { name: "NEXTAUTH_SECRET", value: process.env.NEXTAUTH_SECRET },
  ];
  const seen = new Set();

  return configuredSecrets.filter(({ value }) => {
    if (!value || seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
}

async function getSocketAuthToken(socket) {
  const authSecrets = getAuthSecrets();

  if (authSecrets.length === 0) {
    console.error(
      "[messages-realtime] AUTH_SECRET or NEXTAUTH_SECRET must be configured for socket authentication.",
    );
    return null;
  }

  const cookieHeader = getCookieHeader(socket.request.headers.cookie);
  const tokenRequest = getTokenRequest(socket, cookieHeader);
  const errors = [];

  for (const cookieName of sessionCookieNames) {
    for (const { value: secret } of authSecrets) {
      try {
        const token = await getToken({
          cookieName,
          req: tokenRequest,
          secret,
        });

        if (token?.sub) {
          return token;
        }
      } catch (error) {
        errors.push(
          `${cookieName}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  console.warn("[messages-realtime] socket auth rejected", {
    attemptedCookieNames: sessionCookieNames,
    configuredSecrets: authSecrets.map(({ name }) => name),
    cookiePresence: Object.fromEntries(
      sessionCookieNames.map((cookieName) => [
        cookieName,
        hasCookie(cookieHeader, cookieName),
      ]),
    ),
    errors,
    host: socket.request.headers.host,
    origin: socket.request.headers.origin,
  });

  return null;
}

async function getMessageSenderUserId(messageId) {
  if (!sql) return null;

  const [message] = await sql`
    SELECT sender_user_id
    FROM messages
    WHERE id = ${messageId}
    LIMIT 1
  `;

  return typeof message?.sender_user_id === "string"
    ? message.sender_user_id
    : null;
}

async function getOnlineRecipientUserIds(participantUserIds, senderUserId) {
  const recipientUserIds = participantUserIds.filter(
    (participantUserId) => participantUserId !== senderUserId,
  );
  const onlineRecipientUserIds = [];

  for (const recipientUserId of recipientUserIds) {
    const sockets = await io.in(`user:${recipientUserId}`).fetchSockets();

    if (sockets.length > 0) {
      onlineRecipientUserIds.push(recipientUserId);
    }
  }

  return onlineRecipientUserIds;
}

async function markOnlineRecipientsDelivered(event, participantUserIds) {
  if (event.type !== "message.created") return;

  if (!sql) {
    console.warn(
      "[messages-realtime] DATABASE_URL must be configured to write delivery receipts.",
    );
    return;
  }

  const conversationId =
    typeof event.conversationId === "string" ? event.conversationId : null;
  const messageId = typeof event.messageId === "string" ? event.messageId : null;

  if (!conversationId || !messageId) return;

  const senderUserId =
    typeof event.senderUserId === "string"
      ? event.senderUserId
      : await getMessageSenderUserId(messageId);

  if (!senderUserId) return;

  const onlineRecipientUserIds = await getOnlineRecipientUserIds(
    participantUserIds,
    senderUserId,
  );

  if (onlineRecipientUserIds.length === 0) return;

  const deliveredAt = new Date().toISOString();

  await sql`
    WITH online_recipients AS (
      SELECT unnest(${onlineRecipientUserIds}::uuid[]) AS user_id
    )
    INSERT INTO message_receipts (message_id, user_id, delivered_at, updated_at)
    SELECT ${messageId}, user_id, ${deliveredAt}, now()
    FROM online_recipients
    ON CONFLICT (message_id, user_id)
    DO UPDATE SET
      delivered_at = COALESCE(message_receipts.delivered_at, EXCLUDED.delivered_at),
      updated_at = now()
  `;

  for (const userId of onlineRecipientUserIds) {
    let target = io.to(`conversation:${conversationId}`);

    for (const participantUserId of participantUserIds) {
      target = target.to(`user:${participantUserId}`);
    }

    target.emit("message.delivered", {
      conversationId,
      deliveredAt,
      messageId,
      participantUserIds,
      type: "message.delivered",
      userId,
    });
  }
}

io.use(async (socket, next) => {
  try {
    const token = await getSocketAuthToken(socket);

    if (!token?.sub) {
      next(new Error("Unauthenticated"));
      return;
    }

    socket.data.userId = token.sub;
    next();
  } catch (error) {
    next(error instanceof Error ? error : new Error("Unauthenticated"));
  }
});

io.on("connection", async (socket) => {
  const userId = socket.data.userId;
  const userRoom = `user:${userId}`;

  socket.join(userRoom);
  await presenceClient.sAdd("homzie:messages:online-users", userId);
  io.emit("presence:update", { online: true, userId });

  socket.on("conversation:join", (conversationId) => {
    if (typeof conversationId === "string") {
      socket.join(`conversation:${conversationId}`);
    }
  });

  socket.on("conversation:leave", (conversationId) => {
    if (typeof conversationId === "string") {
      socket.leave(`conversation:${conversationId}`);
    }
  });

  socket.on("typing:start", (payload) => {
    if (!payload || typeof payload.conversationId !== "string") return;

    socket.to(`conversation:${payload.conversationId}`).emit("typing:start", {
      conversationId: payload.conversationId,
      userId,
    });
  });

  socket.on("typing:stop", (payload) => {
    if (!payload || typeof payload.conversationId !== "string") return;

    socket.to(`conversation:${payload.conversationId}`).emit("typing:stop", {
      conversationId: payload.conversationId,
      userId,
    });
  });

  socket.on("call:offer", (payload) => {
    if (
      !payload ||
      typeof payload.conversationId !== "string" ||
      typeof payload.callId !== "string" ||
      typeof payload.recipientUserId !== "string" ||
      !payload.offer
    ) {
      return;
    }

    io.to(`user:${payload.recipientUserId}`).emit("call:offer", {
      callId: payload.callId,
      callerUserId: userId,
      conversationId: payload.conversationId,
      offer: payload.offer,
      type: payload.type === "video" ? "video" : "audio",
    });
  });

  socket.on("call:answer", (payload) => {
    if (
      !payload ||
      typeof payload.callId !== "string" ||
      typeof payload.recipientUserId !== "string" ||
      !payload.answer
    ) {
      return;
    }

    io.to(`user:${payload.recipientUserId}`).emit("call:answer", {
      answer: payload.answer,
      callId: payload.callId,
      conversationId: payload.conversationId,
      responderUserId: userId,
    });
  });

  socket.on("call:ice-candidate", (payload) => {
    if (
      !payload ||
      typeof payload.callId !== "string" ||
      typeof payload.recipientUserId !== "string" ||
      !payload.candidate
    ) {
      return;
    }

    io.to(`user:${payload.recipientUserId}`).emit("call:ice-candidate", {
      callId: payload.callId,
      candidate: payload.candidate,
      conversationId: payload.conversationId,
      senderUserId: userId,
    });
  });

  socket.on("call:decline", (payload) => {
    if (
      !payload ||
      typeof payload.callId !== "string" ||
      typeof payload.recipientUserId !== "string"
    ) {
      return;
    }

    io.to(`user:${payload.recipientUserId}`).emit("call:decline", {
      callId: payload.callId,
      conversationId: payload.conversationId,
      userId,
    });
  });

  socket.on("call:end", (payload) => {
    if (!payload || typeof payload.callId !== "string") return;

    if (typeof payload.recipientUserId === "string") {
      io.to(`user:${payload.recipientUserId}`).emit("call:end", {
        callId: payload.callId,
        conversationId: payload.conversationId,
        userId,
      });
    }

    if (typeof payload.conversationId === "string") {
      socket.to(`conversation:${payload.conversationId}`).emit("call:end", {
        callId: payload.callId,
        conversationId: payload.conversationId,
        userId,
      });
    }
  });

  socket.on("call:callee-ready", (payload) => {
    if (
      !payload ||
      typeof payload.callId !== "string" ||
      typeof payload.conversationId !== "string"
    ) {
      return;
    }

    socket.to(`conversation:${payload.conversationId}`).emit("call:callee-ready", {
      callId: payload.callId,
      conversationId: payload.conversationId,
      userId,
    });
  });

  socket.on("disconnect", async () => {
    const sockets = await io.in(userRoom).fetchSockets();

    if (sockets.length === 0) {
      await presenceClient.sRem("homzie:messages:online-users", userId);
      io.emit("presence:update", { online: false, userId });
    }
  });
});

await eventsClient.subscribe(messageChannel, (rawEvent) => {
  try {
    const event = JSON.parse(rawEvent);
    const participantUserIds = Array.isArray(event.participantUserIds)
      ? event.participantUserIds
      : [];

    for (const participantUserId of participantUserIds) {
      io.to(`user:${participantUserId}`).emit(event.type, event);
    }

    if (event.conversationId) {
      io.to(`conversation:${event.conversationId}`).emit(event.type, event);
    }

    void markOnlineRecipientsDelivered(event, participantUserIds).catch((error) => {
      console.error("Failed to mark online message recipients delivered", error);
    });
  } catch (error) {
    console.error("Invalid messaging realtime event", error);
  }
});

httpServer.listen(port, () => {
  console.log(`Messaging realtime server listening on :${port}`);
});
