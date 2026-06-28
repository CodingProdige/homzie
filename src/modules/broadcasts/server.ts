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
import { liveBroadcastSubject } from "./subject";
import type { BroadcastAudience, BroadcastBlock, BroadcastRecipient } from "./types";

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

type BroadcastSendProgress = {
  failedCount: number;
  pendingCount: number;
  processedCount: number;
  processingCount: number;
  sentCount: number;
  totalCount: number;
};

type ClaimedBroadcastRecipientRow = {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  user_id: string | null;
};

type BroadcastProgressRow = {
  failed_count: number;
  pending_count: number;
  processed_count: number;
  processing_count: number;
  sent_count: number;
  total_count: number;
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
    requireMarketingOptIn: source.requireMarketingOptIn === true,
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

async function insertRecipientSnapshot(
  campaignId: string,
  recipients: BroadcastRecipient[],
) {
  const chunkSize = 500;

  for (let index = 0; index < recipients.length; index += chunkSize) {
    const chunk = recipients.slice(index, index + chunkSize);

    await db
      .insert(broadcastCampaignRecipients)
      .values(
        chunk.map((recipient) => ({
          campaignId,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          status: "pending",
          userId: recipient.userId,
        })),
      )
      .onConflictDoNothing({
        target: [
          broadcastCampaignRecipients.campaignId,
          broadcastCampaignRecipients.recipientEmail,
        ],
      });
  }
}

async function sendPreparedRecipient({
  campaignId,
  html,
  recipient,
  subject,
  text,
}: {
  campaignId: string;
  html: string;
  recipient: ClaimedBroadcastRecipientRow;
  subject: string;
  text: string;
}) {
  try {
    const delivery = await sendSendGridEmail({
      categories: ["broadcast", `campaign-${campaignId.slice(0, 8)}`],
      customArgs: {
        campaign_id: campaignId,
        campaign_recipient_id: recipient.id,
        ...(recipient.user_id ? { user_id: recipient.user_id } : {}),
      },
      html,
      subject,
      text,
      to: {
        email: recipient.recipient_email,
        name: recipient.recipient_name || undefined,
      },
    });

    await db
      .update(broadcastCampaignRecipients)
      .set({
        providerMessageId: delivery.messageId,
        sentAt: new Date(),
        status: "sent",
        updatedAt: new Date(),
      })
      .where(eq(broadcastCampaignRecipients.id, recipient.id));

    await logBroadcastDelivery({
      campaignId,
      campaignRecipientId: recipient.id,
      providerMessageId: delivery.messageId,
      recipientEmail: recipient.recipient_email,
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
      .where(eq(broadcastCampaignRecipients.id, recipient.id));

    await logBroadcastDelivery({
      campaignId,
      campaignRecipientId: recipient.id,
      error: message,
      recipientEmail: recipient.recipient_email,
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

export async function getBroadcastSendProgress(
  campaignId: string,
): Promise<BroadcastSendProgress> {
  const [progress] = await postgresSql<BroadcastProgressRow[]>`
    SELECT
      COUNT(*)::int AS total_count,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
      COUNT(*) FILTER (WHERE status = 'processing')::int AS processing_count,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count,
      COUNT(*) FILTER (WHERE sent_at IS NOT NULL)::int AS sent_count,
      COUNT(*) FILTER (
        WHERE sent_at IS NOT NULL
           OR status IN ('failed', 'bounced', 'dropped', 'spam_reported', 'unsubscribed')
      )::int AS processed_count
    FROM broadcast_campaign_recipients
    WHERE campaign_id = ${campaignId}
  `;

  return {
    failedCount: progress?.failed_count || 0,
    pendingCount: progress?.pending_count || 0,
    processedCount: progress?.processed_count || 0,
    processingCount: progress?.processing_count || 0,
    sentCount: progress?.sent_count || 0,
    totalCount: progress?.total_count || 0,
  };
}

export async function queueBroadcastCampaign({
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
  const subject = liveBroadcastSubject(campaign.subject);

  const [claimed] = await db
    .update(broadcastCampaigns)
    .set({
      html: rendered.html,
      lastAudienceCount: recipients.length,
      recipientCount: recipients.length,
      scheduledAt: null,
      status: "sending",
      subject,
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

  await db
    .delete(broadcastCampaignEvents)
    .where(eq(broadcastCampaignEvents.campaignId, campaignId));
  await db
    .delete(broadcastCampaignRecipients)
    .where(eq(broadcastCampaignRecipients.campaignId, campaignId));
  await insertRecipientSnapshot(campaignId, recipients);
  await refreshBroadcastCampaignStats(campaignId);

  return {
    recipientCount: recipients.length,
  };
}

async function claimPendingBroadcastRecipients(campaignId: string, batchSize: number) {
  return postgresSql<ClaimedBroadcastRecipientRow[]>`
    UPDATE broadcast_campaign_recipients
    SET status = 'processing', updated_at = NOW()
    WHERE id IN (
      SELECT id
      FROM broadcast_campaign_recipients
      WHERE campaign_id = ${campaignId}
        AND (
          status = 'pending'
          OR (status = 'processing' AND updated_at < NOW() - INTERVAL '15 minutes')
        )
      ORDER BY created_at ASC, id ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, user_id, recipient_email, recipient_name
  `;
}

export async function processBroadcastCampaignBatch({
  adminUserId,
  batchSize = 25,
  campaignId,
}: {
  adminUserId?: string | null;
  batchSize?: number;
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

  if (campaign.status !== "sending") {
    return {
      campaignId,
      ok: true as const,
      skipped: true as const,
      status: campaign.status,
    };
  }

  if (!campaign.html || !campaign.text) {
    throw new Error("Broadcast content has not been rendered.");
  }

  const batch = await claimPendingBroadcastRecipients(campaignId, batchSize);

  try {
    await runInChunks(batch, 5, (recipient) =>
      sendPreparedRecipient({
        campaignId,
        html: campaign.html || "",
        recipient,
        subject: liveBroadcastSubject(campaign.subject),
        text: campaign.text || "",
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
  const progress = await getBroadcastSendProgress(campaignId);

  if (progress.pendingCount > 0 || progress.processingCount > 0) {
    return {
      campaignId,
      ok: true as const,
      processedCount: batch.length,
      progress,
      queued: true as const,
    };
  }

  await db
    .update(broadcastCampaigns)
    .set({
      sentAt: progress.sentCount > 0 ? new Date() : null,
      status: progress.sentCount > 0 ? "sent" : "failed",
      updatedAt: new Date(),
      updatedByUserId: adminUserId || null,
    })
    .where(eq(broadcastCampaigns.id, campaignId));

  await refreshBroadcastCampaignStats(campaignId);

  return {
    campaignId,
    ok: true as const,
    processedCount: batch.length,
    progress,
    recipientCount: progress.totalCount,
    sentCount: progress.sentCount,
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
  const dueCampaigns = await db
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

  for (const campaign of dueCampaigns) {
    try {
      const result = await queueBroadcastCampaign({
        adminUserId: campaign.createdByUserId,
        campaignId: campaign.id,
      });

      results.push({ campaignId: campaign.id, ok: true, queued: true, ...result });
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

  const sendingCampaigns = await db
    .select({
      createdByUserId: broadcastCampaigns.createdByUserId,
      id: broadcastCampaigns.id,
    })
    .from(broadcastCampaigns)
    .where(eq(broadcastCampaigns.status, "sending"))
    .orderBy(asc(broadcastCampaigns.updatedAt))
    .limit(limit);

  for (const campaign of sendingCampaigns) {
    try {
      const result = await processBroadcastCampaignBatch({
        adminUserId: campaign.createdByUserId,
        batchSize: Number(process.env.BROADCAST_SEND_BATCH_SIZE || 25),
        campaignId: campaign.id,
      });

      results.push(result);
    } catch (error) {
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
