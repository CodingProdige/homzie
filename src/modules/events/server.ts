import { sql } from "@/db";
import { toPublicMediaUrl } from "@/media/paths";

export type UserEventItem = {
  actor: {
    avatarUrl: string | null;
    id: string | null;
    name: string;
    username: string | null;
  };
  conversationId: string | null;
  createdAt: string;
  eventType: string;
  id: string;
  listingId: string | null;
  message: string;
  reelId: string | null;
  seen: boolean;
};

type EventRow = {
  actor_avatar_url: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_username: string | null;
  conversation_id: string | null;
  created_at: Date | string;
  event_type: string;
  id: string;
  listing_id: string | null;
  metadata: Record<string, unknown> | null;
  reel_id: string | null;
  seen_at: Date | string | null;
};

function dateString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function eventMessage(row: EventRow) {
  const actor = row.actor_name || "Someone";
  const title =
    typeof row.metadata?.listingTitle === "string" ? row.metadata.listingTitle : null;
  const reelTitle =
    typeof row.metadata?.reelTitle === "string" ? row.metadata.reelTitle : null;
  const amount =
    typeof row.metadata?.offerAmount === "string" ? row.metadata.offerAmount : null;
  const count =
    typeof row.metadata?.count === "number"
      ? row.metadata.count
      : typeof row.metadata?.count === "string"
        ? Number(row.metadata.count)
        : null;

  if (row.event_type === "offer.created") {
    return `${actor} made an offer${amount ? ` of ${amount}` : ""}${
      title ? ` on ${title}` : ""
    }.`;
  }

  if (row.event_type === "offer.accepted") {
    return `${actor} accepted your offer${amount ? ` of ${amount}` : ""}${
      title ? ` on ${title}` : ""
    }.`;
  }

  if (row.event_type === "offer.declined") {
    return `${actor} declined your offer${amount ? ` of ${amount}` : ""}${
      title ? ` on ${title}` : ""
    }.`;
  }

  if (row.event_type === "message.created") {
    return `${actor} sent you a message.`;
  }

  if (row.event_type === "profile.followed") {
    return `${actor} followed your profile.`;
  }

  if (row.event_type === "listing.liked") {
    return `${actor} liked${title ? ` ${title}` : " your listing"}.`;
  }

  if (row.event_type === "listing.saved") {
    return `${actor} saved${title ? ` ${title}` : " your listing"}.`;
  }

  if (row.event_type === "listing.contacted") {
    return `${actor} contacted you${title ? ` about ${title}` : " about a listing"}.`;
  }

  if (row.event_type === "listing.views.milestone") {
    return `${title || "Your listing"} reached ${count?.toLocaleString() || "a new"} views.`;
  }

  if (row.event_type === "reel.liked") {
    return `${actor} liked${reelTitle ? ` ${reelTitle}` : " your reel"}.`;
  }

  if (row.event_type === "reel.saved") {
    return `${actor} saved${reelTitle ? ` ${reelTitle}` : " your reel"}.`;
  }

  if (row.event_type === "reel.reshared") {
    return `${actor} reshared${reelTitle ? ` ${reelTitle}` : " your reel"}.`;
  }

  if (row.event_type === "reel.views.milestone") {
    return `${reelTitle || "Your reel"} reached ${count?.toLocaleString() || "a new"} views.`;
  }

  if (row.event_type === "message.requested") {
    return `${actor} wants to start a chat.`;
  }

  if (row.event_type === "call.started") {
    return `${actor} started a call.`;
  }

  if (row.event_type === "call.missed") {
    return `You missed a call from ${actor}.`;
  }

  if (row.event_type === "report.created") {
    return "Your report was received.";
  }

  return `${actor} has a new update for you.`;
}

export async function createUserEvent({
  actorUserId,
  conversationId,
  entityId,
  entityType,
  eventType,
  listingId,
  messageId,
  metadata,
  reelId,
  userId,
}: {
  actorUserId?: string | null;
  conversationId?: string | null;
  entityId?: string | null;
  entityType?: string | null;
  eventType: string;
  listingId?: string | null;
  messageId?: string | null;
  metadata?: Record<string, unknown> | null;
  reelId?: string | null;
  userId: string;
}) {
  if (actorUserId && actorUserId === userId) return;

  const eventMetadata = metadata ? JSON.stringify(metadata) : null;

  await sql`
    INSERT INTO user_events (
      user_id,
      actor_user_id,
      event_type,
      entity_type,
      entity_id,
      conversation_id,
      message_id,
      listing_id,
      reel_id,
      metadata
    )
    VALUES (
      ${userId},
      ${actorUserId || null},
      ${eventType},
      ${entityType || null},
      ${entityId || null},
      ${conversationId || null},
      ${messageId || null},
      ${listingId || null},
      ${reelId || null},
      ${eventMetadata}::jsonb
    )
  `;
}

export async function createUserEventOnce({
  dedupeKey,
  ...event
}: Parameters<typeof createUserEvent>[0] & { dedupeKey: string }) {
  const [existing] = await sql<{ id: string }[]>`
    SELECT id
    FROM user_events
    WHERE user_id = ${event.userId}
      AND event_type = ${event.eventType}
      AND COALESCE(entity_type, '') = COALESCE(${event.entityType || null}, '')
      AND COALESCE(entity_id::text, '') = COALESCE(${event.entityId || null}, '')
      AND COALESCE(listing_id::text, '') = COALESCE(${event.listingId || null}, '')
      AND COALESCE(reel_id::text, '') = COALESCE(${event.reelId || null}, '')
      AND metadata->>'dedupeKey' = ${dedupeKey}
    LIMIT 1
  `;

  if (existing) return;

  await createUserEvent({
    ...event,
    metadata: {
      ...(event.metadata || {}),
      dedupeKey,
    },
  });
}

export async function getUnseenEventCount(userId: string) {
  const [row] = await sql<{ count: number | string }[]>`
    SELECT count(*)::int AS count
    FROM user_events
    WHERE user_id = ${userId}
      AND seen_at IS NULL
  `;

  return Number(row?.count || 0);
}

export async function getUserEvents(userId: string) {
  const rows = await sql<EventRow[]>`
    SELECT
      ue.id,
      ue.event_type,
      ue.conversation_id,
      ue.listing_id,
      ue.reel_id,
      ue.metadata,
      ue.seen_at,
      ue.created_at,
      actor.id AS actor_id,
      actor.name AS actor_name,
      actor.username AS actor_username,
      actor.avatar_url AS actor_avatar_url
    FROM user_events ue
    LEFT JOIN users actor ON actor.id = ue.actor_user_id
    WHERE ue.user_id = ${userId}
    ORDER BY ue.created_at DESC
    LIMIT 200
  `;

  return rows.map((row): UserEventItem => ({
    actor: {
      avatarUrl: toPublicMediaUrl(row.actor_avatar_url),
      id: row.actor_id,
      name: row.actor_name || "Homzie",
      username: row.actor_username,
    },
    conversationId: row.conversation_id,
    createdAt: dateString(row.created_at),
    eventType: row.event_type,
    id: row.id,
    listingId: row.listing_id,
    message: eventMessage(row),
    reelId: row.reel_id,
    seen: Boolean(row.seen_at),
  }));
}

export async function markUserEventsSeen(userId: string) {
  await sql`
    UPDATE user_events
    SET seen_at = COALESCE(seen_at, now())
    WHERE user_id = ${userId}
      AND seen_at IS NULL
  `;
}
