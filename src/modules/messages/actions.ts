"use server";

import { createHmac, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { getMediaStorageRoot } from "@/media/storage";
import { authOptions } from "@/modules/auth/config";
import {
  acceptConversationRequest,
  blockUser,
  createOfferMessage,
  deleteConversationForUser,
  findOrCreateDirectConversation,
  getConversationMessages,
  getConversationSummaries,
  markConversationRead,
  markMessageDelivered,
  reportConversation,
  sendAttachmentMessage,
  sendMessage,
  setConversationMuted,
  startCallSession,
  updateCallSession,
} from "@/modules/messages/server";

async function requireUserId() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("You must be signed in.");
  }

  return userId;
}

const uuidSchema = z.string().uuid();
const maxImageBytes = 15 * 1024 * 1024;
const maxAudioBytes = 50 * 1024 * 1024;
const extensionByType: Record<string, string> = {
  "audio/aac": "aac",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/x-wav": "wav",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  clientId: z.string().trim().max(120).optional(),
  conversationId: uuidSchema,
});

export async function sendMessageAction(input: z.input<typeof sendMessageSchema>) {
  const userId = await requireUserId();
  const parsed = sendMessageSchema.parse(input);

  await sendMessage({
    body: parsed.body,
    clientId: parsed.clientId,
    conversationId: parsed.conversationId,
    senderUserId: userId,
  });

  revalidatePath("/messages");

  return {
    conversations: await getConversationSummaries(userId),
    messages: await getConversationMessages(parsed.conversationId, userId),
  };
}

export async function sendAttachmentMessageAction(formData: FormData) {
  const userId = await requireUserId();
  const conversationId = uuidSchema.parse(formData.get("conversationId"));
  const requestedMediaType = z
    .enum(["audio", "image", "voice"])
    .parse(formData.get("mediaType"));
  const body = z
    .string()
    .trim()
    .max(1000)
    .optional()
    .parse(formData.get("body") || undefined);
  const clientId = z
    .string()
    .trim()
    .max(120)
    .optional()
    .parse(formData.get("clientId") || undefined);
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("Choose an image or audio file.");
  }

  const uploadKind = file.type.startsWith("image/") ? "image" : "audio";
  const mediaType = requestedMediaType === "voice" ? "voice" : uploadKind;
  const extension = extensionByType[file.type];

  if (
    !extension ||
    (requestedMediaType === "image" && uploadKind !== "image") ||
    ((requestedMediaType === "audio" || requestedMediaType === "voice") &&
      uploadKind !== "audio")
  ) {
    throw new Error(
      requestedMediaType === "image"
        ? "Upload a JPG, PNG, GIF, AVIF, or WebP image."
        : "Upload an MP3, M4A, WAV, AAC, OGG, or WebM audio file.",
    );
  }

  if (uploadKind === "image" && file.size > maxImageBytes) {
    throw new Error("Images must be 15MB or smaller.");
  }

  if (uploadKind === "audio" && file.size > maxAudioBytes) {
    throw new Error("Audio must be 50MB or smaller.");
  }

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const folder = uploadKind === "image" ? "message-images" : "message-audio";
  const fileName = `${randomUUID()}.${extension}`;
  const relativePath = [folder, year, month, fileName].join("/");
  const storagePath = path.join(
    /*turbopackIgnore: true*/ getMediaStorageRoot(),
    folder,
    year,
    month,
    fileName,
  );
  const bytes = Buffer.from(await file.arrayBuffer());
  const mediaUrl = `/media/${relativePath}`;

  await mkdir(path.dirname(storagePath), { recursive: true });
  await writeFile(storagePath, bytes);

  await sendAttachmentMessage({
    body,
    clientId,
    conversationId,
    mediaType,
    mediaUrl,
    senderUserId: userId,
  });

  revalidatePath("/messages");

  return {
    conversations: await getConversationSummaries(userId),
    messages: await getConversationMessages(conversationId, userId),
  };
}

const startConversationSchema = z.object({
  listingId: uuidSchema.optional(),
  recipientUserId: uuidSchema,
});

export async function startConversationAction(
  input: z.input<typeof startConversationSchema>,
) {
  const userId = await requireUserId();
  const parsed = startConversationSchema.parse(input);
  const conversationId = await findOrCreateDirectConversation(
    userId,
    parsed.recipientUserId,
    parsed.listingId,
  );

  revalidatePath("/messages");

  return {
    conversationId,
    conversations: await getConversationSummaries(userId),
    messages: await getConversationMessages(conversationId, userId),
  };
}

const conversationSchema = z.object({
  conversationId: uuidSchema,
});

export async function loadConversationAction(input: z.input<typeof conversationSchema>) {
  const userId = await requireUserId();
  const parsed = conversationSchema.parse(input);

  await markConversationRead(parsed.conversationId, userId);

  return {
    conversations: await getConversationSummaries(userId),
    messages: await getConversationMessages(parsed.conversationId, userId),
  };
}

export async function markConversationReadAction(
  input: z.input<typeof conversationSchema>,
) {
  const userId = await requireUserId();
  const parsed = conversationSchema.parse(input);

  await markConversationRead(parsed.conversationId, userId);

  return {
    conversations: await getConversationSummaries(userId),
  };
}

const messageSchema = z.object({
  messageId: uuidSchema,
});

export async function markMessageDeliveredAction(input: z.input<typeof messageSchema>) {
  const userId = await requireUserId();
  const parsed = messageSchema.parse(input);

  await markMessageDelivered(parsed.messageId, userId);
}

const mutedSchema = z.object({
  conversationId: uuidSchema,
  muted: z.boolean(),
});

export async function setConversationMutedAction(input: z.input<typeof mutedSchema>) {
  const userId = await requireUserId();
  const parsed = mutedSchema.parse(input);

  await setConversationMuted(parsed.conversationId, userId, parsed.muted);

  return {
    conversations: await getConversationSummaries(userId),
  };
}

export async function acceptConversationRequestAction(
  input: z.input<typeof conversationSchema>,
) {
  const userId = await requireUserId();
  const parsed = conversationSchema.parse(input);

  await acceptConversationRequest(parsed.conversationId, userId);

  return {
    conversations: await getConversationSummaries(userId),
    messages: await getConversationMessages(parsed.conversationId, userId),
  };
}

export async function deleteConversationAction(
  input: z.input<typeof conversationSchema>,
) {
  const userId = await requireUserId();
  const parsed = conversationSchema.parse(input);

  await deleteConversationForUser(parsed.conversationId, userId);
  revalidatePath("/messages");

  return {
    conversations: await getConversationSummaries(userId),
  };
}

const blockUserSchema = z.object({
  blockedUserId: uuidSchema,
});

export async function blockUserAction(input: z.input<typeof blockUserSchema>) {
  const userId = await requireUserId();
  const parsed = blockUserSchema.parse(input);

  await blockUser(userId, parsed.blockedUserId);

  return {
    conversations: await getConversationSummaries(userId),
  };
}

const reportSchema = z.object({
  conversationId: uuidSchema,
  details: z.string().trim().max(1000).optional(),
  reason: z.string().trim().min(3).max(80),
  reportedUserId: uuidSchema.optional(),
});

export async function reportConversationAction(input: z.input<typeof reportSchema>) {
  const userId = await requireUserId();
  const parsed = reportSchema.parse(input);

  await reportConversation({
    conversationId: parsed.conversationId,
    details: parsed.details,
    reason: parsed.reason,
    reportedUserId: parsed.reportedUserId,
    reporterUserId: userId,
  });

  return { ok: true as const };
}

const startCallSchema = z.object({
  conversationId: uuidSchema,
  type: z.enum(["audio", "video"]),
});

export async function startCallSessionAction(input: z.input<typeof startCallSchema>) {
  const userId = await requireUserId();
  const parsed = startCallSchema.parse(input);

  const callId = await startCallSession({
    conversationId: parsed.conversationId,
    startedByUserId: userId,
    type: parsed.type,
  });

  return { callId };
}

const updateCallSchema = z.object({
  callId: uuidSchema,
  conversationId: uuidSchema,
  status: z.enum(["answered", "declined", "ended", "missed"]),
});

export async function updateCallSessionAction(input: z.input<typeof updateCallSchema>) {
  const userId = await requireUserId();
  const parsed = updateCallSchema.parse(input);

  await updateCallSession({
    callId: parsed.callId,
    conversationId: parsed.conversationId,
    status: parsed.status,
    userId,
  });

  return { ok: true as const };
}

export async function getCallIceServersAction() {
  const turnUrls = (process.env.TURN_URLS || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (!turnUrls.length) return [];

  const staticUsername = process.env.TURN_USERNAME;
  const staticCredential = process.env.TURN_PASSWORD;
  const sharedSecret = process.env.TURN_SHARED_SECRET;

  if (sharedSecret) {
    const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    const username = `${expiresAt}:${randomUUID()}`;
    const credential = createHmac("sha1", sharedSecret)
      .update(username)
      .digest("base64");

    return [
      {
        credential,
        urls: turnUrls,
        username,
      },
    ];
  }

  if (staticUsername && staticCredential) {
    return [
      {
        credential: staticCredential,
        urls: turnUrls,
        username: staticUsername,
      },
    ];
  }

  return [];
}

const offerSchema = z.object({
  amountCents: z.number().int().positive(),
  currency: z.string().trim().min(3).max(3),
  listingId: uuidSchema,
  note: z.string().trim().max(1000).optional(),
});

export async function createOfferMessageAction(input: z.input<typeof offerSchema>) {
  const userId = await requireUserId();
  const parsed = offerSchema.parse(input);
  const result = await createOfferMessage({
    amountCents: parsed.amountCents,
    buyerUserId: userId,
    currency: parsed.currency.toUpperCase(),
    listingId: parsed.listingId,
    note: parsed.note,
  });

  revalidatePath("/messages");

  return {
    ...result,
    conversations: await getConversationSummaries(userId),
    messages: await getConversationMessages(result.conversationId, userId),
  };
}
