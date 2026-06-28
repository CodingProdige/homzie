import "server-only";

import { eq } from "drizzle-orm";

import { db, sql } from "@/db";
import { emailDeliveryLogs, emailTemplates, users } from "@/db/schema";
import { sendSendGridEmail } from "@/modules/email/sendgrid";
import { defaultEmailTemplates } from "@/modules/email/templates";

import { renderEmailParts } from "./render";

type EmailPreferenceCategory =
  | "messages"
  | "listingActivity"
  | "reelActivity"
  | "profileActivity"
  | "marketing";

type PreferenceRow = {
  email_enabled: boolean;
  email_event_preferences: Record<string, unknown> | null;
  listing_activity_enabled: boolean;
  marketing_enabled: boolean;
  messages_enabled: boolean;
  profile_activity_enabled: boolean;
  reel_activity_enabled: boolean;
};

function appBaseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL;

  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return "http://localhost:3000";
}

export function absoluteAppUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;

  return `${appBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function ensureDefaultEmailTemplates() {
  for (const template of defaultEmailTemplates) {
    await db
      .insert(emailTemplates)
      .values({
        category: template.category,
        description: template.description,
        enabled: template.enabled,
        html: template.html.trim(),
        key: template.key,
        name: template.name,
        preheader: template.preheader,
        sampleVariables: template.sampleVariables,
        subject: template.subject,
        text: template.text,
        variables: template.variables,
      })
      .onConflictDoNothing();
  }
}

function preferenceAllows(
  preferences: PreferenceRow | undefined,
  category?: EmailPreferenceCategory,
  eventKey?: string,
) {
  if (!preferences) return true;
  if (!preferences.email_enabled) return false;

  if (eventKey && preferences.email_event_preferences) {
    const eventPreference = preferences.email_event_preferences[eventKey];

    if (eventPreference === false) return false;
  }

  if (category === "messages") return preferences.messages_enabled;
  if (category === "listingActivity") return preferences.listing_activity_enabled;
  if (category === "reelActivity") return preferences.reel_activity_enabled;
  if (category === "profileActivity") return preferences.profile_activity_enabled;
  if (category === "marketing") return preferences.marketing_enabled;

  return true;
}

async function getTemplate(templateKey: string) {
  await ensureDefaultEmailTemplates();

  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.key, templateKey))
    .limit(1);

  return template || null;
}

async function logEmailDelivery({
  campaignId,
  campaignRecipientId,
  error,
  eventKey,
  providerMessageId,
  recipientEmail,
  status,
  subject,
  templateKey,
  userId,
  variables,
}: {
  campaignId?: string | null;
  campaignRecipientId?: string | null;
  error?: string | null;
  eventKey: string;
  providerMessageId?: string | null;
  recipientEmail: string;
  status: "sent" | "failed" | "skipped";
  subject?: string | null;
  templateKey: string;
  userId?: string | null;
  variables: Record<string, unknown>;
}) {
  await db.insert(emailDeliveryLogs).values({
    campaignId: campaignId || null,
    campaignRecipientId: campaignRecipientId || null,
    error: error || null,
    eventKey,
    providerMessageId: providerMessageId || null,
    recipientEmail,
    sentAt: status === "sent" ? new Date() : null,
    status,
    subject: subject || null,
    templateKey,
    userId: userId || null,
    variables,
  });
}

export async function sendTemplatedEmailToUser({
  bypassPreferences = false,
  campaignId,
  campaignRecipientId,
  categories,
  customArgs,
  eventKey,
  preferenceCategory,
  templateKey,
  userId,
  variables,
}: {
  bypassPreferences?: boolean;
  campaignId?: string | null;
  campaignRecipientId?: string | null;
  categories?: string[];
  customArgs?: Record<string, string | number | boolean | null | undefined>;
  eventKey?: string;
  preferenceCategory?: EmailPreferenceCategory;
  templateKey: string;
  userId: string;
  variables: Record<string, unknown>;
}) {
  const [recipient] = await db
    .select({
      email: users.email,
      id: users.id,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!recipient?.email) return { ok: false as const, skipped: true as const };

  const template = await getTemplate(templateKey);
  const key = eventKey || templateKey;

  if (!template || !template.enabled) {
    await logEmailDelivery({
      campaignId,
      campaignRecipientId,
      error: template ? "Template disabled." : "Template not found.",
      eventKey: key,
      recipientEmail: recipient.email,
      status: "skipped",
      templateKey,
      userId,
      variables,
    });
    return { ok: false as const, skipped: true as const };
  }

  if (!bypassPreferences) {
    const [preferences] = await sql<PreferenceRow[]>`
      SELECT
        email_enabled,
        email_event_preferences,
        messages_enabled,
        listing_activity_enabled,
        reel_activity_enabled,
        profile_activity_enabled,
        marketing_enabled
      FROM user_notification_preferences
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    if (!preferenceAllows(preferences, preferenceCategory, key)) {
      await logEmailDelivery({
        campaignId,
        campaignRecipientId,
        error: "User email preferences disabled this notification.",
        eventKey: key,
        recipientEmail: recipient.email,
        status: "skipped",
        templateKey,
        userId,
        variables,
      });
      return { ok: false as const, skipped: true as const };
    }
  }

  const rendered = renderEmailParts({
    html: template.html,
    preheader: template.preheader,
    subject: template.subject,
    text: template.text,
    variables,
  });

  try {
    const delivery = await sendSendGridEmail({
      categories,
      customArgs,
      html: rendered.html,
      subject: rendered.subject,
      text: rendered.text,
      to: { email: recipient.email, name: recipient.name },
    });

    await logEmailDelivery({
      campaignId,
      campaignRecipientId,
      eventKey: key,
      providerMessageId: delivery.messageId,
      recipientEmail: recipient.email,
      status: "sent",
      subject: rendered.subject,
      templateKey,
      userId,
      variables,
    });

    return { ok: true as const };
  } catch (error) {
    await logEmailDelivery({
      campaignId,
      campaignRecipientId,
      error: error instanceof Error ? error.message : String(error),
      eventKey: key,
      recipientEmail: recipient.email,
      status: "failed",
      subject: rendered.subject,
      templateKey,
      userId,
      variables,
    });

    return {
      error: error instanceof Error ? error.message : "Could not send email.",
      ok: false as const,
    };
  }
}

export async function sendTemplatedEmailToAddress({
  campaignId,
  campaignRecipientId,
  categories,
  customArgs,
  eventKey,
  from,
  recipientEmail,
  recipientName,
  replyTo,
  templateKey,
  variables,
}: {
  campaignId?: string | null;
  campaignRecipientId?: string | null;
  categories?: string[];
  customArgs?: Record<string, string | number | boolean | null | undefined>;
  eventKey?: string;
  from?: { email: string; name?: string };
  recipientEmail: string;
  recipientName?: string;
  replyTo?: { email: string; name?: string };
  templateKey: string;
  variables: Record<string, unknown>;
}) {
  const template = await getTemplate(templateKey);
  const key = eventKey || templateKey;

  if (!template || !template.enabled) {
    await logEmailDelivery({
      campaignId,
      campaignRecipientId,
      error: template ? "Template disabled." : "Template not found.",
      eventKey: key,
      recipientEmail,
      status: "skipped",
      templateKey,
      variables,
    });
    return { ok: false as const, skipped: true as const };
  }

  const rendered = renderEmailParts({
    html: template.html,
    preheader: template.preheader,
    subject: template.subject,
    text: template.text,
    variables,
  });

  try {
    const delivery = await sendSendGridEmail({
      categories,
      customArgs,
      from,
      html: rendered.html,
      replyTo,
      subject: rendered.subject,
      text: rendered.text,
      to: { email: recipientEmail, name: recipientName },
    });

    await logEmailDelivery({
      campaignId,
      campaignRecipientId,
      eventKey: key,
      providerMessageId: delivery.messageId,
      recipientEmail,
      status: "sent",
      subject: rendered.subject,
      templateKey,
      variables,
    });

    return { ok: true as const };
  } catch (error) {
    await logEmailDelivery({
      campaignId,
      campaignRecipientId,
      error: error instanceof Error ? error.message : String(error),
      eventKey: key,
      recipientEmail,
      status: "failed",
      subject: rendered.subject,
      templateKey,
      variables,
    });

    return {
      error: error instanceof Error ? error.message : "Could not send email.",
      ok: false as const,
    };
  }
}

export async function notifyUser(input: Parameters<typeof sendTemplatedEmailToUser>[0]) {
  return sendTemplatedEmailToUser(input);
}
