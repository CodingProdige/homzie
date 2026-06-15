import { sql } from "@/db";
import { toPublicMediaUrl } from "@/media/paths";
import { buildListingPath } from "@/modules/listings/seo";

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
  listingHref: string | null;
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
  listing_details: Record<string, unknown> | null;
  listing_location: string | null;
  listing_property_type: string | null;
  listing_title: string | null;
  listing_type: string | null;
  listing_id: string | null;
  metadata: Record<string, unknown> | null;
  reel_id: string | null;
  seen_at: Date | string | null;
};

function dateString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function objectValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function listingHref(row: EventRow) {
  if (
    !row.listing_id ||
    !row.listing_title ||
    !row.listing_type ||
    !row.listing_property_type
  ) {
    return null;
  }

  const details = objectValue(row.listing_details);

  return buildListingPath({
    bedrooms: numberValue(details.bedrooms),
    city: stringValue(details.city),
    country: stringValue(details.country),
    id: row.listing_id,
    listingType: row.listing_type,
    location: row.listing_location,
    propertyType: row.listing_property_type,
    province:
      stringValue(details.province) ||
      stringValue(details.state) ||
      stringValue(details.region),
    suburb: stringValue(details.suburb),
    title: row.listing_title,
  });
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
  const activeViewerCount =
    typeof row.metadata?.activeViewerCount === "number"
      ? row.metadata.activeViewerCount
      : typeof row.metadata?.activeViewerCount === "string"
        ? Number(row.metadata.activeViewerCount)
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

  if (row.event_type === "listing.buyer_intent.repeat_view") {
    return `${actor} is viewing ${title || "your listing"}. Open the listing to start a chat while they are active.`;
  }

  if (row.event_type === "listing.buyer_intent.active_viewers") {
    return `${title || "Your listing"} has ${
      activeViewerCount?.toLocaleString() || "multiple"
    } active viewers right now. Open the listing to see buyer intent.`;
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
      listing.title AS listing_title,
      listing.listing_type AS listing_type,
      listing.property_type AS listing_property_type,
      listing.location AS listing_location,
      listing.details AS listing_details,
      actor.id AS actor_id,
      actor.name AS actor_name,
      actor.username AS actor_username,
      actor.avatar_url AS actor_avatar_url
    FROM user_events ue
    LEFT JOIN users actor ON actor.id = ue.actor_user_id
    LEFT JOIN property_listings listing ON listing.id = ue.listing_id
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
    listingHref: listingHref(row),
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
