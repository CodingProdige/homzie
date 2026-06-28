import "server-only";

import { and, asc, eq, lte, sql as drizzleSql } from "drizzle-orm";

import { db, sql as postgresSql } from "@/db";
import {
  broadcastCampaignEvents,
  broadcastCampaignRecipients,
  broadcastCampaigns,
  emailDeliveryLogs,
} from "@/db/schema";
import { sendSendGridEmail } from "@/modules/email/sendgrid";

import { getBroadcastAudienceRecipients } from "./audience";
import { renderBroadcastEmail, renderBroadcastText } from "./render";
import type { BroadcastAudience, BroadcastBlock } from "./types";

type CampaignStatsRow = {
  bounced_count: number;
  clicked_count: number;
  delivered_count: number;
  dropped_count: number;
  machine_open_count: number;
  opened_count: number;
  recipient_count: number;
  sent_count: number;
  spam_report_count: number;
  unsubscribed_count: number;
};

type SendGridEventPayload = {
  campaign_id?: unknown;
  campaign_recipient_id?: unknown;
  email?: unknown;
  event?: unknown;
  ip?: unknown;
  sg_event_id?: unknown;
  sg_machine_open?: unknown;
  sg_message_id?: unknown;
  timestamp?: unknown;
  url?: unknown;
  useragent?: unknown;
  user_id?: unknown;
};

class BroadcastCampaignBusyError extends Error {
  constructor(campaignId: string) {
    super(`Broadcast ${campaignId} is already being processed.`);
    this.name = "BroadcastCampaignBusyError";
  }
}

function cleanText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, maxLength);
}

function newBlockId(type: string) {
  return `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeHref(value: unknown) {
  const href = cleanText(value, 500);

  if (!href) return "";
  if (/^https?:\/\//i.test(href) || href.startsWith("/")) return href;

  return `/${href}`;
}

export function normalizeBroadcastAudience(value: unknown): BroadcastAudience {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const source = value as Record<string, unknown>;
  const role = cleanText(source.role, 40);

  return {
    country: cleanText(source.country, 120) || undefined,
    createdAfter: cleanText(source.createdAfter, 40) || undefined,
    createdBefore: cleanText(source.createdBefore, 40) || undefined,
    hasListings: source.hasListings === true,
    hasReels: source.hasReels === true,
    province: cleanText(source.province, 120) || undefined,
    role:
      role === "home_seeker" ||
      role === "private_seller" ||
      role === "property_agent" ||
      role === "developer"
        ? role
        : "all",
  };
}

export function normalizeBroadcastBlocks(value: unknown): BroadcastBlock[] {
  const blocks = Array.isArray(value) ? value : [];

  return blocks
    .map((block): BroadcastBlock | null => {
      if (!block || typeof block !== "object" || Array.isArray(block)) {
        return null;
      }

      const source = block as Record<string, unknown>;
      const type = cleanText(source.type, 40);
      const id = cleanText(source.id, 80) || newBlockId(type || "block");

      if (type === "hero") {
        const title = cleanText(source.title, 140);
        if (!title) return null;

        return {
          body: cleanText(source.body, 1400),
          eyebrow: cleanText(source.eyebrow, 80),
          id,
          title,
          type,
        };
      }

      if (type === "text") {
        const body = cleanText(source.body, 5000);
        if (!body) return null;

        return { body, id, type };
      }

      if (type === "image") {
        const url = normalizeHref(source.url);
        if (!url) return null;

        return {
          alt: cleanText(source.alt, 180),
          id,
          type,
          url,
        };
      }

      if (type === "video") {
        const title = cleanText(source.title, 140);
        const url = normalizeHref(source.url);
        if (!title || !url) return null;

        return {
          body: cleanText(source.body, 1000),
          id,
          label: cleanText(source.label, 60) || "Watch video",
          thumbnailAlt: cleanText(source.thumbnailAlt, 180),
          thumbnailUrl: normalizeHref(source.thumbnailUrl) || undefined,
          title,
          type,
          url,
        };
      }

      if (type === "button") {
        const href = normalizeHref(source.href);
        const label = cleanText(source.label, 60);
        if (!href || !label) return null;

        return { href, id, label, type };
      }

      if (type === "listing") {
        const title = cleanText(source.title, 140);
        if (!title) return null;

        return {
          href: normalizeHref(source.href) || undefined,
          id,
          imageUrl: normalizeHref(source.imageUrl) || undefined,
          location: cleanText(source.location, 180),
          price: cleanText(source.price, 80),
          title,
          type,
        };
      }

      if (type === "agent") {
        const name = cleanText(source.name, 140);
        if (!name) return null;

        return {
          avatarUrl: normalizeHref(source.avatarUrl) || undefined,
          headline: cleanText(source.headline, 180),
          href: normalizeHref(source.href) || undefined,
          id,
          name,
          type,
        };
      }

      if (type === "divider") return { id, type };

      if (type === "footer") {
        const body = cleanText(source.body, 1000);
        if (!body) return null;

        return { body, id, type };
      }

      return null;
    })
    .filter((block): block is BroadcastBlock => Boolean(block))
    .slice(0, 24);
}

export function renderBroadcastParts({
  blocks,
  preheader,
}: {
  blocks: BroadcastBlock[];
  preheader?: string | null;
}) {
  return {
    html: renderBroadcastEmail({ blocks, preheader }),
    text: renderBroadcastText(blocks),
  };
}

export async function refreshBroadcastCampaignStats(campaignId: string) {
  const [stats] = await postgresSql<CampaignStatsRow[]>`
    WITH recipient_stats AS (
      SELECT
        COUNT(*)::int AS recipient_count,
        COUNT(*) FILTER (WHERE sent_at IS NOT NULL)::int AS sent_count,
        COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered_count,
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened_count,
        COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::int AS clicked_count,
        COUNT(*) FILTER (WHERE unsubscribed_at IS NOT NULL)::int AS unsubscribed_count,
        COUNT(*) FILTER (WHERE bounced_at IS NOT NULL)::int AS bounced_count,
        COUNT(*) FILTER (WHERE dropped_at IS NOT NULL)::int AS dropped_count,
        COUNT(*) FILTER (WHERE spam_reported_at IS NOT NULL)::int AS spam_report_count
      FROM broadcast_campaign_recipients
      WHERE campaign_id = ${campaignId}
    ),
    event_stats AS (
      SELECT
        COUNT(DISTINCT recipient_id) FILTER (
          WHERE event_type = 'open'
            AND raw_event->>'sg_machine_open' = 'true'
        )::int AS machine_open_count
      FROM broadcast_campaign_events
      WHERE campaign_id = ${campaignId}
    )
    SELECT
      recipient_stats.*,
      COALESCE(event_stats.machine_open_count, 0)::int AS machine_open_count
    FROM recipient_stats, event_stats
  `;

  await db
    .update(broadcastCampaigns)
    .set({
      bouncedCount: stats?.bounced_count || 0,
      clickedCount: stats?.clicked_count || 0,
      deliveredCount: stats?.delivered_count || 0,
      droppedCount: stats?.dropped_count || 0,
      machineOpenCount: stats?.machine_open_count || 0,
      openedCount: stats?.opened_count || 0,
      recipientCount: stats?.recipient_count || 0,
      sentCount: stats?.sent_count || 0,
      spamReportCount: stats?.spam_report_count || 0,
      unsubscribedCount: stats?.unsubscribed_count || 0,
      updatedAt: new Date(),
    })
    .where(eq(broadcastCampaigns.id, campaignId));
}

async function logBroadcastDelivery({
  campaignId,
  campaignRecipientId,
  error,
  providerMessageId,
  recipientEmail,
  status,
  subject,
}: {
  campaignId: string;
  campaignRecipientId: string;
  error?: string | null;
  providerMessageId?: string | null;
  recipientEmail: string;
  status: "sent" | "failed";
  subject: string;
}) {
  await db.insert(emailDeliveryLogs).values({
    campaignId,
    campaignRecipientId,
    error: error || null,
    eventKey: "broadcast_campaign",
    providerMessageId: providerMessageId || null,
    recipientEmail,
    sentAt: status === "sent" ? new Date() : null,
    status,
    subject,
    templateKey: "broadcast",
    variables: {
      campaignId,
      campaignRecipientId,
    },
  });
}

async function upsertRecipient({
  campaignId,
  email,
  name,
  userId,
}: {
  campaignId: string;
  email: string;
  name: string | null;
  userId: string;
}) {
  const [recipient] = await db
    .insert(broadcastCampaignRecipients)
    .values({
      campaignId,
      recipientEmail: email,
      recipientName: name,
      status: "pending",
      userId,
    })
    .onConflictDoUpdate({
      target: [
        broadcastCampaignRecipients.campaignId,
        broadcastCampaignRecipients.recipientEmail,
      ],
      set: {
        bouncedAt: null,
        clickedAt: null,
        deliveredAt: null,
        droppedAt: null,
        error: null,
        openedAt: null,
        providerMessageId: null,
        recipientName: name,
        sentAt: null,
        spamReportedAt: null,
        status: "pending",
        unsubscribedAt: null,
        updatedAt: new Date(),
        userId,
      },
    })
    .returning({ id: broadcastCampaignRecipients.id });

  return recipient;
}

async function sendToRecipient({
  campaignId,
  html,
  recipient,
  subject,
  text,
}: {
  campaignId: string;
  html: string;
  recipient: {
    email: string;
    name: string | null;
    userId: string;
  };
  subject: string;
  text: string;
}) {
  const recipientRow = await upsertRecipient({
    campaignId,
    email: recipient.email,
    name: recipient.name,
    userId: recipient.userId,
  });

  if (!recipientRow) {
    throw new Error("Could not create campaign recipient.");
  }

  try {
    const delivery = await sendSendGridEmail({
      categories: ["broadcast", `campaign-${campaignId.slice(0, 8)}`],
      customArgs: {
        campaign_id: campaignId,
        campaign_recipient_id: recipientRow.id,
        user_id: recipient.userId,
      },
      html,
      subject,
      text,
      to: { email: recipient.email, name: recipient.name || undefined },
    });

    await db
      .update(broadcastCampaignRecipients)
      .set({
        providerMessageId: delivery.messageId,
        sentAt: new Date(),
        status: "sent",
        updatedAt: new Date(),
      })
      .where(eq(broadcastCampaignRecipients.id, recipientRow.id));

    await logBroadcastDelivery({
      campaignId,
      campaignRecipientId: recipientRow.id,
      providerMessageId: delivery.messageId,
      recipientEmail: recipient.email,
      status: "sent",
      subject,
    });

    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await db
      .update(broadcastCampaignRecipients)
      .set({
        error: message,
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(broadcastCampaignRecipients.id, recipientRow.id));

    await logBroadcastDelivery({
      campaignId,
      campaignRecipientId: recipientRow.id,
      error: message,
      recipientEmail: recipient.email,
      status: "failed",
      subject,
    });

    return { error: message, ok: false as const };
  }
}

async function runInChunks<T>(
  items: T[],
  chunkSize: number,
  worker: (item: T) => Promise<unknown>,
) {
  for (let index = 0; index < items.length; index += chunkSize) {
    await Promise.all(items.slice(index, index + chunkSize).map(worker));
  }
}

export async function sendBroadcastCampaign({
  adminUserId,
  campaignId,
}: {
  adminUserId?: string | null;
  campaignId: string;
}) {
  const [campaign] = await db
    .select()
    .from(broadcastCampaigns)
    .where(eq(broadcastCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    throw new Error("Broadcast campaign not found.");
  }

  if (campaign.status === "sending") {
    throw new Error("This broadcast is already sending.");
  }

  if (campaign.status === "sent") {
    throw new Error("Duplicate this broadcast before sending it again.");
  }

  const blocks = normalizeBroadcastBlocks(campaign.blocks);
  if (!blocks.length) {
    throw new Error("Add at least one content block before sending.");
  }

  const audience = normalizeBroadcastAudience(campaign.audience);
  const recipients = await getBroadcastAudienceRecipients(audience);

  if (!recipients.length) {
    throw new Error("No eligible recipients match this broadcast audience.");
  }

  const rendered = renderBroadcastParts({
    blocks,
    preheader: campaign.preheader,
  });

  const [claimed] = await db
    .update(broadcastCampaigns)
    .set({
      html: rendered.html,
      lastAudienceCount: recipients.length,
      recipientCount: recipients.length,
      status: "sending",
      text: rendered.text,
      updatedAt: new Date(),
      updatedByUserId: adminUserId || null,
    })
    .where(
      and(
        eq(broadcastCampaigns.id, campaignId),
        drizzleSql`broadcast_campaigns.status NOT IN ('sending', 'sent')`,
      ),
    )
    .returning({ id: broadcastCampaigns.id });

  if (!claimed) {
    throw new BroadcastCampaignBusyError(campaignId);
  }

  try {
    await runInChunks(recipients, 5, (recipient) =>
      sendToRecipient({
        campaignId,
        html: rendered.html,
        recipient,
        subject: campaign.subject,
        text: rendered.text,
      }),
    );
  } catch (error) {
    await db
      .update(broadcastCampaigns)
      .set({
        status: "failed",
        updatedAt: new Date(),
        updatedByUserId: adminUserId || null,
      })
      .where(eq(broadcastCampaigns.id, campaignId));

    throw error;
  }

  await refreshBroadcastCampaignStats(campaignId);

  const [stats] = await postgresSql<CampaignStatsRow[]>`
    SELECT
      COUNT(*)::int AS recipient_count,
      COUNT(*) FILTER (WHERE sent_at IS NOT NULL)::int AS sent_count,
      COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered_count,
      0::int AS machine_open_count,
      COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened_count,
      COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::int AS clicked_count,
      COUNT(*) FILTER (WHERE unsubscribed_at IS NOT NULL)::int AS unsubscribed_count,
      COUNT(*) FILTER (WHERE bounced_at IS NOT NULL)::int AS bounced_count,
      COUNT(*) FILTER (WHERE dropped_at IS NOT NULL)::int AS dropped_count,
      COUNT(*) FILTER (WHERE spam_reported_at IS NOT NULL)::int AS spam_report_count
    FROM broadcast_campaign_recipients
    WHERE campaign_id = ${campaignId}
  `;
  const sentCount = stats?.sent_count || 0;

  await db
    .update(broadcastCampaigns)
    .set({
      sentAt: sentCount > 0 ? new Date() : null,
      status: sentCount > 0 ? "sent" : "failed",
      updatedAt: new Date(),
      updatedByUserId: adminUserId || null,
    })
    .where(eq(broadcastCampaigns.id, campaignId));

  await refreshBroadcastCampaignStats(campaignId);

  return {
    recipientCount: recipients.length,
    sentCount,
  };
}

function eventDate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000);
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);

    if (Number.isFinite(numeric)) return new Date(numeric * 1000);
  }

  return new Date();
}

function eventStatusPatch(eventType: string, occurredAt: Date) {
  if (eventType === "processed") {
    return { sentAt: occurredAt, status: "sent" };
  }

  if (eventType === "delivered") {
    return { deliveredAt: occurredAt, status: "delivered" };
  }

  if (eventType === "open") {
    return { openedAt: occurredAt, status: "opened" };
  }

  if (eventType === "click") {
    return { clickedAt: occurredAt, status: "clicked" };
  }

  if (eventType === "bounce") {
    return { bouncedAt: occurredAt, status: "bounced" };
  }

  if (eventType === "dropped") {
    return { droppedAt: occurredAt, status: "dropped" };
  }

  if (eventType === "spamreport") {
    return { spamReportedAt: occurredAt, status: "spam_reported" };
  }

  if (eventType === "unsubscribe" || eventType === "group_unsubscribe") {
    return { status: "unsubscribed", unsubscribedAt: occurredAt };
  }

  return { status: eventType };
}

export async function recordSendGridBroadcastEvents(events: unknown[]) {
  const touchedCampaignIds = new Set<string>();

  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;

    const payload = event as SendGridEventPayload;
    const campaignId = cleanText(payload.campaign_id, 80);
    const recipientId = cleanText(payload.campaign_recipient_id, 80);
    const eventType = cleanText(payload.event, 60);

    if (!campaignId || !eventType) continue;

    const occurredAt = eventDate(payload.timestamp);
    const providerMessageId = cleanText(payload.sg_message_id, 180);
    const eventId =
      cleanText(payload.sg_event_id, 220) ||
      [
        providerMessageId,
        eventType,
        Math.floor(occurredAt.getTime() / 1000),
        cleanText(payload.url, 500),
      ]
        .filter(Boolean)
        .join(":");

    await db
      .insert(broadcastCampaignEvents)
      .values({
        campaignId,
        eventType,
        ip: cleanText(payload.ip, 120) || null,
        occurredAt,
        providerEventId: eventId || null,
        providerMessageId: providerMessageId || null,
        rawEvent: payload as Record<string, unknown>,
        recipientId: recipientId || null,
        url: cleanText(payload.url, 1000) || null,
        userAgent: cleanText(payload.useragent, 500) || null,
      })
      .onConflictDoNothing({
        target: broadcastCampaignEvents.providerEventId,
      });

    const patch = {
      ...eventStatusPatch(eventType, occurredAt),
      ...(providerMessageId ? { providerMessageId } : {}),
      updatedAt: new Date(),
    };

    if (recipientId) {
      await db
        .update(broadcastCampaignRecipients)
        .set(patch)
        .where(eq(broadcastCampaignRecipients.id, recipientId));
    } else if (payload.email) {
      await db
        .update(broadcastCampaignRecipients)
        .set(patch)
        .where(
          and(
            eq(broadcastCampaignRecipients.campaignId, campaignId),
            eq(broadcastCampaignRecipients.recipientEmail, cleanText(payload.email, 320)),
          ),
        );
    }

    touchedCampaignIds.add(campaignId);
  }

  for (const campaignId of touchedCampaignIds) {
    await refreshBroadcastCampaignStats(campaignId);
  }

  return { processed: touchedCampaignIds.size };
}

export async function sendDueBroadcastCampaigns(limit = 3) {
  const campaigns = await db
    .select({
      createdByUserId: broadcastCampaigns.createdByUserId,
      id: broadcastCampaigns.id,
    })
    .from(broadcastCampaigns)
    .where(
      and(
        eq(broadcastCampaigns.status, "scheduled"),
        lte(broadcastCampaigns.scheduledAt, new Date()),
      ),
    )
    .orderBy(asc(broadcastCampaigns.scheduledAt))
    .limit(limit);

  const results = [];

  for (const campaign of campaigns) {
    try {
      const result = await sendBroadcastCampaign({
        adminUserId: campaign.createdByUserId,
        campaignId: campaign.id,
      });

      results.push({ campaignId: campaign.id, ok: true, ...result });
    } catch (error) {
      if (error instanceof BroadcastCampaignBusyError) {
        results.push({
          campaignId: campaign.id,
          ok: true,
          skipped: true,
        });
        continue;
      }

      await db
        .update(broadcastCampaigns)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(broadcastCampaigns.id, campaign.id));

      results.push({
        campaignId: campaign.id,
        error: error instanceof Error ? error.message : String(error),
        ok: false,
      });
    }
  }

  return results;
}
