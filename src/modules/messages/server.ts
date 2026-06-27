import { sql } from "@/db";
import { toPublicMediaUrl } from "@/media/paths";
import { createUserEvent, createUserEventOnce } from "@/modules/events/server";
import { publishMessageEvent } from "@/modules/messages/realtime";

export type MessageUser = {
  avatarUrl: string | null;
  id: string;
  name: string;
  username: string | null;
};

export type MessageAttachment = {
  id: string;
  listingId: string | null;
  metadata: Record<string, unknown>;
  previewImageUrl: string | null;
  title: string | null;
  type: string;
  url: string | null;
};

export type PropertyOfferMessage = {
  amountCents: number;
  currency: string;
  id: string;
  listingId: string;
  note: string | null;
  status: string;
};

export type MessageThreadItem = {
  attachments: MessageAttachment[];
  body: string | null;
  clientId: string | null;
  conversationId: string;
  createdAt: string;
  id: string;
  offer: PropertyOfferMessage | null;
  sender: MessageUser | null;
  senderUserId: string | null;
  status: "sent" | "delivered" | "read";
  type: string;
};

export type ConversationSummary = {
  id: string;
  inbox: string;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  muted: boolean;
  otherParticipants: MessageUser[];
  unreadCount: number;
};

export type MessagesPageData = {
  conversations: ConversationSummary[];
  initialConversationId: string | null;
  messages: MessageThreadItem[];
  viewer: MessageUser;
};

type UserRow = {
  avatar_url: string | null;
  id: string;
  name: string;
  username: string | null;
};

type ConversationRow = {
  id: string;
  inbox: string;
  last_message_at: Date | string | null;
  last_message_body: string | null;
  last_message_type: string | null;
  muted_at: Date | string | null;
  other_users: UserRow[] | null;
  unread_count: number | string;
};

type MessageRow = {
  attachments: Array<{
    id: string;
    listing_id: string | null;
    metadata: Record<string, unknown> | null;
    preview_image_url: string | null;
    title: string | null;
    type: string;
    url: string | null;
  }> | null;
  body: string | null;
  client_id: string | null;
  conversation_id: string;
  created_at: Date | string;
  delivered_count: number | string;
  id: string;
  offer_amount_cents: number | null;
  offer_currency: string | null;
  offer_id: string | null;
  offer_listing_id: string | null;
  offer_note: string | null;
  offer_status: string | null;
  read_count: number | string;
  sender_avatar_url: string | null;
  sender_name: string | null;
  sender_user_id: string | null;
  sender_username: string | null;
  type: string;
};

function dateString(value: Date | string | null | undefined) {
  if (!value) return null;

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function publicUser(row: UserRow): MessageUser {
  return {
    avatarUrl: toPublicMediaUrl(row.avatar_url),
    id: row.id,
    name: row.name,
    username: row.username,
  };
}

function messagePreview(type: string | null, body: string | null) {
  if (type === "offer") return "Made an offer";
  if (type === "image") return "Sent an image";
  if (type === "voice") return "Sent a voice note";
  if (type === "audio") return "Sent audio";
  if (type === "listing_attachment") return "Sent a listing";
  if (type === "system") return body || "Updated the conversation";

  return body || "New message";
}

function numberFromDb(value: number | string | null | undefined) {
  return typeof value === "number" ? value : Number(value || 0);
}

async function getParticipantUserIds(conversationId: string) {
  const rows = await sql<{ user_id: string }[]>`
    SELECT user_id
    FROM conversation_participants
    WHERE conversation_id = ${conversationId}
      AND deleted_at IS NULL
  `;

  return rows.map((row) => row.user_id);
}

export async function assertConversationMember(
  conversationId: string,
  userId: string,
) {
  const [row] = await sql<{ conversation_id: string }[]>`
    SELECT conversation_id
    FROM conversation_participants
    WHERE conversation_id = ${conversationId}
      AND user_id = ${userId}
      AND deleted_at IS NULL
    LIMIT 1
  `;

  if (!row) {
    throw new Error("Conversation not found.");
  }
}

export async function getMessagesPageData(
  viewerUserId: string,
  requestedConversationId?: string | null,
): Promise<MessagesPageData> {
  const [viewer] = await sql<UserRow[]>`
    SELECT id, name, username, avatar_url
    FROM users
    WHERE id = ${viewerUserId}
    LIMIT 1
  `;

  if (!viewer) {
    throw new Error("User not found.");
  }

  const conversations = await getConversationSummaries(viewerUserId);
  const initialConversationId =
    requestedConversationId &&
    conversations.some((conversation) => conversation.id === requestedConversationId)
      ? requestedConversationId
      : conversations[0]?.id || null;

  return {
    conversations,
    initialConversationId,
    messages: initialConversationId
      ? await getConversationMessages(initialConversationId, viewerUserId)
      : [],
    viewer: publicUser(viewer),
  };
}

export async function getConversationSummaries(userId: string) {
  const rows = await sql<ConversationRow[]>`
    SELECT
      c.id,
      cp.inbox,
      cp.muted_at,
      c.last_message_at,
      lm.body AS last_message_body,
      lm.type AS last_message_type,
      COALESCE(
        jsonb_agg(
          DISTINCT jsonb_build_object(
            'id', u.id,
            'name', u.name,
            'username', u.username,
            'avatar_url', u.avatar_url
          )
        ) FILTER (WHERE u.id IS NOT NULL),
        '[]'::jsonb
      ) AS other_users,
      COALESCE(
        COUNT(DISTINCT m.id) FILTER (
          WHERE m.sender_user_id IS DISTINCT FROM ${userId}
            AND m.deleted_at IS NULL
            AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
        ),
        0
      ) AS unread_count
    FROM conversation_participants cp
    JOIN conversations c ON c.id = cp.conversation_id
    LEFT JOIN messages lm ON lm.id = c.last_message_id
    LEFT JOIN messages m ON m.conversation_id = c.id
    LEFT JOIN conversation_participants op
      ON op.conversation_id = c.id
      AND op.user_id <> ${userId}
      AND op.deleted_at IS NULL
    LEFT JOIN users u ON u.id = op.user_id
    WHERE cp.user_id = ${userId}
      AND cp.deleted_at IS NULL
      AND c.status = 'active'
    GROUP BY c.id, cp.inbox, cp.muted_at, c.last_message_at, lm.body, lm.type
    ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
    LIMIT 100
  `;

  return rows.map((row) => ({
    id: row.id,
    inbox: row.inbox,
    lastMessageAt: dateString(row.last_message_at),
    lastMessagePreview: messagePreview(row.last_message_type, row.last_message_body),
    muted: Boolean(row.muted_at),
    otherParticipants: (row.other_users || []).map(publicUser),
    unreadCount: numberFromDb(row.unread_count),
  }));
}

export async function getUnreadMessageCount(userId: string) {
  const [row] = await sql<{ count: number | string }[]>`
    SELECT COALESCE(
      COUNT(m.id) FILTER (
        WHERE m.sender_user_id IS DISTINCT FROM ${userId}
          AND m.deleted_at IS NULL
          AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
      ),
      0
    ) AS count
    FROM conversation_participants cp
    JOIN conversations c ON c.id = cp.conversation_id
    LEFT JOIN messages m ON m.conversation_id = c.id
    WHERE cp.user_id = ${userId}
      AND cp.deleted_at IS NULL
      AND c.status = 'active'
  `;

  return numberFromDb(row?.count);
}

export async function getConversationMessages(
  conversationId: string,
  viewerUserId: string,
) {
  await assertConversationMember(conversationId, viewerUserId);

  const rows = await sql<MessageRow[]>`
    SELECT
      m.id,
      m.conversation_id,
      m.sender_user_id,
      m.type,
      m.body,
      m.client_id,
      m.created_at,
      sender.name AS sender_name,
      sender.username AS sender_username,
      sender.avatar_url AS sender_avatar_url,
      COALESCE(
        json_agg(
          json_build_object(
            'id', ma.id,
            'type', ma.type,
            'url', ma.url,
            'title', ma.title,
            'preview_image_url', ma.preview_image_url,
            'listing_id', ma.listing_id,
            'metadata', ma.metadata
          )
        ) FILTER (WHERE ma.id IS NOT NULL),
        '[]'::json
      ) AS attachments,
      po.id AS offer_id,
      po.listing_id AS offer_listing_id,
      po.amount_cents AS offer_amount_cents,
      po.currency AS offer_currency,
      po.note AS offer_note,
      po.status AS offer_status,
      COALESCE(COUNT(mr.user_id) FILTER (WHERE mr.delivered_at IS NOT NULL), 0) AS delivered_count,
      COALESCE(COUNT(mr.user_id) FILTER (WHERE mr.read_at IS NOT NULL), 0) AS read_count
    FROM messages m
    LEFT JOIN users sender ON sender.id = m.sender_user_id
    LEFT JOIN message_attachments ma ON ma.message_id = m.id
    LEFT JOIN property_offers po ON po.message_id = m.id
    LEFT JOIN message_receipts mr
      ON mr.message_id = m.id
      AND mr.user_id <> m.sender_user_id
    WHERE m.conversation_id = ${conversationId}
      AND m.deleted_at IS NULL
    GROUP BY
      m.id,
      sender.name,
      sender.username,
      sender.avatar_url,
      po.id,
      po.listing_id,
      po.amount_cents,
      po.currency,
      po.note,
      po.status
    ORDER BY m.created_at ASC
    LIMIT 300
  `;

  return rows.map((row): MessageThreadItem => {
    const readCount = numberFromDb(row.read_count);
    const deliveredCount = numberFromDb(row.delivered_count);

    return {
      attachments: (row.attachments || []).map((attachment) => ({
        id: attachment.id,
        listingId: attachment.listing_id,
        metadata: attachment.metadata || {},
        previewImageUrl: toPublicMediaUrl(attachment.preview_image_url),
        title: attachment.title,
        type: attachment.type,
        url: attachment.url,
      })),
      body: row.body,
      clientId: row.client_id,
      conversationId: row.conversation_id,
      createdAt: dateString(row.created_at) || new Date().toISOString(),
      id: row.id,
      offer: row.offer_id
        ? {
            amountCents: row.offer_amount_cents || 0,
            currency: row.offer_currency || "ZAR",
            id: row.offer_id,
            listingId: row.offer_listing_id || "",
            note: row.offer_note,
            status: row.offer_status || "pending",
          }
        : null,
      sender: row.sender_user_id
        ? {
            avatarUrl: toPublicMediaUrl(row.sender_avatar_url),
            id: row.sender_user_id,
            name: row.sender_name || "Homzie User",
            username: row.sender_username,
          }
        : null,
      senderUserId: row.sender_user_id,
      status: readCount > 0 ? "read" : deliveredCount > 0 ? "delivered" : "sent",
      type: row.type,
    };
  });
}

export async function findOrCreateDirectConversation(
  viewerUserId: string,
  recipientUserId: string,
  listingId?: string | null,
) {
  if (viewerUserId === recipientUserId) {
    throw new Error("You cannot message yourself.");
  }

  const [blocked] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM user_blocks
      WHERE (blocker_user_id = ${viewerUserId} AND blocked_user_id = ${recipientUserId})
         OR (blocker_user_id = ${recipientUserId} AND blocked_user_id = ${viewerUserId})
    ) AS exists
  `;

  if (blocked?.exists) {
    throw new Error("This conversation is unavailable.");
  }

  const [existing] = await sql<{ conversation_id: string }[]>`
    SELECT cp1.conversation_id
    FROM conversation_participants cp1
    JOIN conversation_participants cp2
      ON cp2.conversation_id = cp1.conversation_id
    JOIN conversations c ON c.id = cp1.conversation_id
    WHERE cp1.user_id = ${viewerUserId}
      AND cp2.user_id = ${recipientUserId}
      AND c.type = 'direct'
      AND c.status = 'active'
    GROUP BY cp1.conversation_id
    HAVING COUNT(*) = 1
    LIMIT 1
  `;

  if (existing) {
    await sql`
      UPDATE conversation_participants
      SET deleted_at = NULL, archived_at = NULL, updated_at = now()
      WHERE conversation_id = ${existing.conversation_id}
        AND user_id IN (${viewerUserId}, ${recipientUserId})
    `;

    return existing.conversation_id;
  }

  const [conversation] = await sql<{ id: string }[]>`
    INSERT INTO conversations (created_by_user_id, listing_id, last_message_at)
    VALUES (${viewerUserId}, ${listingId || null}, now())
    RETURNING id
  `;

  await sql`
    INSERT INTO conversation_participants (conversation_id, user_id, role, inbox)
    VALUES
      (${conversation.id}, ${viewerUserId}, 'member', 'primary'),
      (
        ${conversation.id},
        ${recipientUserId},
        'member',
        ${listingId ? "primary" : "requests"}
      )
  `;

  await publishMessageEvent({
    conversationId: conversation.id,
    participantUserIds: [viewerUserId, recipientUserId],
    type: "conversation.updated",
  });

  return conversation.id;
}

export async function sendMessage({
  body,
  clientId,
  conversationId,
  senderUserId,
  type = "text",
}: {
  body?: string;
  clientId?: string;
  conversationId: string;
  senderUserId: string;
  type?: "text" | "system";
}) {
  const cleanBody = (body || "").trim().slice(0, 4000);

  if (!cleanBody && type === "text") {
    throw new Error("Message cannot be empty.");
  }

  await assertConversationMember(conversationId, senderUserId);

  const [message] = await sql<{ id: string }[]>`
    INSERT INTO messages (conversation_id, sender_user_id, type, body, client_id)
    VALUES (${conversationId}, ${senderUserId}, ${type}, ${cleanBody || null}, ${clientId || null})
    ON CONFLICT (client_id) DO UPDATE SET client_id = EXCLUDED.client_id
    RETURNING id
  `;

  await afterMessageCreated(conversationId, message.id, senderUserId);

  return message.id;
}

export async function sendAttachmentMessage({
  body,
  clientId,
  conversationId,
  mediaType,
  mediaUrl,
  senderUserId,
}: {
  body?: string;
  clientId?: string;
  conversationId: string;
  mediaType: "audio" | "image" | "voice";
  mediaUrl: string;
  senderUserId: string;
}) {
  const cleanBody = (body || "").trim().slice(0, 1000);
  const attachmentMetadata = JSON.stringify({ source: "message-upload" });

  if (!mediaUrl.startsWith("/media/")) {
    throw new Error("Invalid message media.");
  }

  await assertConversationMember(conversationId, senderUserId);

  const [message] = await sql<{ id: string }[]>`
    INSERT INTO messages (conversation_id, sender_user_id, type, body, client_id)
    VALUES (
      ${conversationId},
      ${senderUserId},
      ${mediaType},
      ${cleanBody || null},
      ${clientId || null}
    )
    ON CONFLICT (client_id) DO UPDATE SET client_id = EXCLUDED.client_id
    RETURNING id
  `;

  await sql`
    INSERT INTO message_attachments (message_id, type, url, metadata)
    VALUES (
      ${message.id},
      ${mediaType},
      ${mediaUrl},
      ${attachmentMetadata}::jsonb
    )
  `;

  await afterMessageCreated(conversationId, message.id, senderUserId);

  return message.id;
}

export async function createListingInquiryMessage({
  body,
  buyerUserId,
  clientId,
  listingId,
}: {
  body: string;
  buyerUserId: string;
  clientId?: string;
  listingId: string;
}) {
  const [listing] = await sql<{
    asking_price_cents: number | null;
    cover_image_url: string | null;
    location: string | null;
    title: string;
    user_id: string;
  }[]>`
    SELECT user_id, title, location, asking_price_cents, cover_image_url
    FROM property_listings
    WHERE id = ${listingId}
      AND status = 'published'
    LIMIT 1
  `;

  if (!listing) {
    throw new Error("Listing not found.");
  }

  const conversationId = await findOrCreateDirectConversation(
    buyerUserId,
    listing.user_id,
    listingId,
  );
  const cleanBody = body.trim().slice(0, 4000);
  const messageMetadata = JSON.stringify({
    listingId,
    source: "listing_detail_agent_card",
  });
  const attachmentMetadata = JSON.stringify({
    askingPriceCents: listing.asking_price_cents,
    location: listing.location,
    source: "listing_detail_agent_card",
  });

  if (!cleanBody) {
    throw new Error("Message cannot be empty.");
  }

  const [message] = await sql<{ id: string }[]>`
    INSERT INTO messages (conversation_id, sender_user_id, type, body, client_id, metadata)
    VALUES (
      ${conversationId},
      ${buyerUserId},
      'text',
      ${cleanBody},
      ${clientId || null},
      ${messageMetadata}::jsonb
    )
    ON CONFLICT (client_id) DO UPDATE SET client_id = EXCLUDED.client_id
    RETURNING id
  `;

  await sql`
    INSERT INTO message_attachments (
      message_id,
      type,
      title,
      preview_image_url,
      listing_id,
      metadata
    )
    VALUES (
      ${message.id},
      'listing',
      ${listing.title},
      ${listing.cover_image_url},
      ${listingId},
      ${attachmentMetadata}::jsonb
    )
  `;

  await afterMessageCreated(conversationId, message.id, buyerUserId);

  return { conversationId, messageId: message.id };
}

export async function markConversationRead(
  conversationId: string,
  readerUserId: string,
) {
  await assertConversationMember(conversationId, readerUserId);

  const [readState] = await sql<{
    last_read_at: Date | string | null;
    latest_incoming_at: Date | string | null;
  }[]>`
    SELECT
      cp.last_read_at,
      max(m.created_at) AS latest_incoming_at
    FROM conversation_participants cp
    LEFT JOIN messages m
      ON m.conversation_id = cp.conversation_id
      AND m.sender_user_id IS DISTINCT FROM ${readerUserId}
      AND m.deleted_at IS NULL
    WHERE cp.conversation_id = ${conversationId}
      AND cp.user_id = ${readerUserId}
      AND cp.deleted_at IS NULL
    GROUP BY cp.last_read_at
    LIMIT 1
  `;
  const latestIncomingAt = readState?.latest_incoming_at
    ? new Date(readState.latest_incoming_at).getTime()
    : null;
  const lastReadAt = readState?.last_read_at
    ? new Date(readState.last_read_at).getTime()
    : null;

  if (!latestIncomingAt || (lastReadAt && lastReadAt >= latestIncomingAt)) {
    return;
  }

  const readAt = new Date();
  const readAtIso = readAt.toISOString();

  await sql`
    UPDATE conversation_participants
    SET last_read_at = ${readAtIso}, updated_at = now()
    WHERE conversation_id = ${conversationId}
      AND user_id = ${readerUserId}
  `;

  await sql`
    INSERT INTO message_receipts (message_id, user_id, delivered_at, read_at, updated_at)
    SELECT id, ${readerUserId}, now(), ${readAtIso}, now()
    FROM messages
    WHERE conversation_id = ${conversationId}
      AND sender_user_id IS DISTINCT FROM ${readerUserId}
      AND deleted_at IS NULL
    ON CONFLICT (message_id, user_id)
    DO UPDATE SET
      delivered_at = COALESCE(message_receipts.delivered_at, EXCLUDED.delivered_at),
      read_at = EXCLUDED.read_at,
      updated_at = now()
  `;

  const participantUserIds = await getParticipantUserIds(conversationId);

  await publishMessageEvent({
    conversationId,
    participantUserIds,
    readAt: readAtIso,
    readerUserId,
    type: "conversation.read",
  });
}

export async function markMessageDelivered(
  messageId: string,
  userId: string,
) {
  const [row] = await sql<{ conversation_id: string }[]>`
    SELECT m.conversation_id
    FROM messages m
    JOIN conversation_participants cp
      ON cp.conversation_id = m.conversation_id
      AND cp.user_id = ${userId}
    WHERE m.id = ${messageId}
      AND m.sender_user_id IS DISTINCT FROM ${userId}
      AND cp.deleted_at IS NULL
    LIMIT 1
  `;

  if (!row) return;

  const deliveredAt = new Date();
  const deliveredAtIso = deliveredAt.toISOString();

  await sql`
    INSERT INTO message_receipts (message_id, user_id, delivered_at, updated_at)
    VALUES (${messageId}, ${userId}, ${deliveredAtIso}, now())
    ON CONFLICT (message_id, user_id)
    DO UPDATE SET
      delivered_at = COALESCE(message_receipts.delivered_at, EXCLUDED.delivered_at),
      updated_at = now()
  `;

  await publishMessageEvent({
    conversationId: row.conversation_id,
    deliveredAt: deliveredAtIso,
    messageId,
    participantUserIds: await getParticipantUserIds(row.conversation_id),
    type: "message.delivered",
    userId,
  });
}

export async function setConversationMuted(
  conversationId: string,
  userId: string,
  muted: boolean,
) {
  await assertConversationMember(conversationId, userId);

  const mutedAt = muted ? new Date().toISOString() : null;

  await sql`
    UPDATE conversation_participants
    SET muted_at = ${mutedAt}, updated_at = now()
    WHERE conversation_id = ${conversationId}
      AND user_id = ${userId}
  `;
}

export async function acceptConversationRequest(
  conversationId: string,
  userId: string,
) {
  await assertConversationMember(conversationId, userId);

  await sql`
    UPDATE conversation_participants
    SET inbox = 'primary', updated_at = now()
    WHERE conversation_id = ${conversationId}
      AND user_id = ${userId}
  `;
}

export async function deleteConversationForUser(
  conversationId: string,
  userId: string,
) {
  await assertConversationMember(conversationId, userId);

  await sql`
    UPDATE conversation_participants
    SET deleted_at = now(), archived_at = now(), updated_at = now()
    WHERE conversation_id = ${conversationId}
      AND user_id = ${userId}
  `;
}

export async function blockUser(blockerUserId: string, blockedUserId: string) {
  if (blockerUserId === blockedUserId) return;

  await sql`
    INSERT INTO user_blocks (blocker_user_id, blocked_user_id)
    VALUES (${blockerUserId}, ${blockedUserId})
    ON CONFLICT (blocker_user_id, blocked_user_id) DO NOTHING
  `;

  await sql`
    UPDATE conversation_participants cp
    SET deleted_at = now(), archived_at = now(), updated_at = now()
    WHERE cp.user_id = ${blockerUserId}
      AND cp.conversation_id IN (
        SELECT cp1.conversation_id
        FROM conversation_participants cp1
        JOIN conversation_participants cp2
          ON cp2.conversation_id = cp1.conversation_id
        WHERE cp1.user_id = ${blockerUserId}
          AND cp2.user_id = ${blockedUserId}
      )
  `;
}

export async function reportConversation({
  conversationId,
  details,
  reason,
  reportedUserId,
  reporterUserId,
}: {
  conversationId: string;
  details?: string;
  reason: string;
  reportedUserId?: string | null;
  reporterUserId: string;
}) {
  await assertConversationMember(conversationId, reporterUserId);

  await sql`
    INSERT INTO message_reports (
      reporter_user_id,
      reported_user_id,
      conversation_id,
      reason,
      details
    )
    VALUES (
      ${reporterUserId},
      ${reportedUserId || null},
      ${conversationId},
      ${reason},
      ${details || null}
    )
  `;

  await createUserEvent({
    actorUserId: null,
    conversationId,
    eventType: "report.created",
    metadata: { reason },
    userId: reporterUserId,
  });
}

export async function respondToPropertyOffer({
  offerId,
  responderUserId,
  status,
}: {
  offerId: string;
  responderUserId: string;
  status: "accepted" | "declined";
}) {
  const [offer] = await sql<{
    amount_cents: number;
    conversation_id: string;
    currency: string;
    listing_id: string;
    listing_title: string | null;
  }[]>`
    UPDATE property_offers
    SET status = ${status}, responded_at = now(), updated_at = now()
    WHERE id = ${offerId}
      AND agent_user_id = ${responderUserId}
      AND status = 'pending'
    RETURNING
      conversation_id,
      amount_cents,
      currency,
      listing_id,
      (SELECT title FROM property_listings WHERE id = property_offers.listing_id) AS listing_title
  `;

  if (!offer) {
    throw new Error("This offer cannot be updated.");
  }

  const amountLabel = new Intl.NumberFormat(undefined, {
    currency: offer.currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(offer.amount_cents / 100);
  const messageMetadata = JSON.stringify({
    listingId: offer.listing_id,
    listingTitle: offer.listing_title,
    offerAmount: amountLabel,
    offerId,
    offerStatus: status,
  });
  const [message] = await sql<{ id: string }[]>`
    INSERT INTO messages (conversation_id, sender_user_id, type, body, metadata)
    VALUES (
      ${offer.conversation_id},
      ${responderUserId},
      'system',
      ${status === "accepted"
        ? `Offer accepted: ${amountLabel}`
        : `Offer declined: ${amountLabel}`},
      ${messageMetadata}::jsonb
    )
    RETURNING id
  `;

  await afterMessageCreated(offer.conversation_id, message.id, responderUserId);

  return { conversationId: offer.conversation_id };
}

export async function createOfferMessage({
  amountCents,
  buyerUserId,
  currency,
  listingId,
  note,
}: {
  amountCents: number;
  buyerUserId: string;
  currency: string;
  listingId: string;
  note?: string;
}) {
  const [listing] = await sql<{
    asking_price_cents: number | null;
    cover_image_url: string | null;
    location: string | null;
    title: string;
    user_id: string;
  }[]>`
    SELECT user_id, title, location, asking_price_cents, cover_image_url
    FROM property_listings
    WHERE id = ${listingId}
      AND status = 'published'
    LIMIT 1
  `;

  if (!listing) {
    throw new Error("Listing not found.");
  }

  const conversationId = await findOrCreateDirectConversation(
    buyerUserId,
    listing.user_id,
    listingId,
  );

  const cleanNote = (note || "").trim().slice(0, 1000);
  const offerAmount = new Intl.NumberFormat(undefined, {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amountCents / 100);
  const messageMetadata = JSON.stringify({
    amountCents,
    currency,
    listingId,
    listingTitle: listing.title,
    offerAmount,
  });
  const [message] = await sql<{ id: string }[]>`
    INSERT INTO messages (conversation_id, sender_user_id, type, body, metadata)
    VALUES (
      ${conversationId},
      ${buyerUserId},
      'offer',
      ${cleanNote || null},
      ${messageMetadata}::jsonb
    )
    RETURNING id
  `;

  const [offer] = await sql<{ id: string }[]>`
    INSERT INTO property_offers (
      conversation_id,
      message_id,
      listing_id,
      buyer_user_id,
      agent_user_id,
      amount_cents,
      currency,
      note
    )
    VALUES (
      ${conversationId},
      ${message.id},
      ${listingId},
      ${buyerUserId},
      ${listing.user_id},
      ${amountCents},
      ${currency},
      ${cleanNote || null}
    )
    RETURNING id
  `;

  const attachmentMetadata = JSON.stringify({
    askingPriceCents: listing.asking_price_cents,
    location: listing.location,
    offerId: offer.id,
  });

  await sql`
    INSERT INTO message_attachments (
      message_id,
      type,
      title,
      preview_image_url,
      listing_id,
      metadata
    )
    VALUES (
      ${message.id},
      'listing',
      ${listing.title},
      ${listing.cover_image_url},
      ${listingId},
      ${attachmentMetadata}::jsonb
    )
  `;

  await afterMessageCreated(conversationId, message.id, buyerUserId);

  return { conversationId, messageId: message.id, offerId: offer.id };
}

async function afterMessageCreated(
  conversationId: string,
  messageId: string,
  senderUserId: string,
) {
  await sql`
    UPDATE conversations
    SET last_message_id = ${messageId}, last_message_at = now(), updated_at = now()
    WHERE id = ${conversationId}
  `;

  await sql`
    UPDATE conversation_participants
    SET deleted_at = NULL, archived_at = NULL, updated_at = now()
    WHERE conversation_id = ${conversationId}
  `;

  await sql`
    INSERT INTO message_receipts (message_id, user_id, delivered_at, read_at)
    VALUES (${messageId}, ${senderUserId}, now(), now())
    ON CONFLICT (message_id, user_id) DO NOTHING
  `;

  const users = await getParticipantUserIds(conversationId);

  const [message] = await sql<{
    body: string | null;
    listing_id: string | null;
    metadata: Record<string, unknown> | null;
    sender_name: string | null;
    sender_username: string | null;
    type: string;
  }[]>`
    SELECT
      m.type,
      m.body,
      m.metadata,
      c.listing_id,
      sender.name AS sender_name,
      sender.username AS sender_username
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    LEFT JOIN users sender ON sender.id = m.sender_user_id
    WHERE m.id = ${messageId}
    LIMIT 1
  `;

  const offerStatus =
    typeof message?.metadata?.offerStatus === "string"
      ? message.metadata.offerStatus
      : null;
  const eventType =
    message?.type === "offer"
      ? "offer.created"
      : message?.type === "system" && offerStatus === "accepted"
        ? "offer.accepted"
        : message?.type === "system" && offerStatus === "declined"
          ? "offer.declined"
          : "message.created";

  await Promise.all(
    users
      .filter((userId) => userId !== senderUserId)
      .map((userId) =>
        createUserEventOnce({
          actorUserId: senderUserId,
          conversationId,
          dedupeKey: `${eventType}:${messageId}`,
          entityId: messageId,
          entityType: "message",
          eventType,
          listingId: message?.listing_id || null,
          messageId,
          metadata: {
            body: message?.body,
            offerAmount: message?.metadata?.offerAmount,
            offerId: message?.metadata?.offerId,
            offerStatus,
            listingId: message?.metadata?.listingId || message?.listing_id,
            listingTitle: message?.metadata?.listingTitle,
          },
          userId,
        }),
      ),
  );

  await publishMessageEvent({
    conversationId,
    messageId,
    participantUserIds: users,
    senderUserId,
    type: "message.created",
  });
}
