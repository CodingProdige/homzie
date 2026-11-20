import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import { getSmtpConfigurationStatus } from "@/modules/email/smtp";
import type { EmailProvider } from "@/modules/email/types";

export type { EmailProvider } from "@/modules/email/types";

export type EmailSettings = {
  provider: EmailProvider;
  fromEmail: string;
  fromName: string;
  replyToEmail: string;
};

export type EmailSettingsView = EmailSettings & {
  sendgridConfigured: boolean;
  smtpConfigured: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
};

const emailSettingsKey = "email";
const emailAddressSchema = z.string().email();
const settingsSchema = z.object({
  provider: z.enum(["sendgrid", "smtp"]),
  fromEmail: z.string(),
  fromName: z.string(),
  replyToEmail: z.string(),
});

function cleanHeader(value: unknown, name: string) {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error(`Invalid email setting: ${name}.`);
  }
  return value.trim();
}

function firstValue(...values: Array<string | undefined>) {
  for (const value of values) {
    if (value === undefined) continue;
    const cleaned = cleanHeader(value, "sender");
    if (cleaned) return cleaned;
  }
  return "";
}

function environmentSettings(): EmailSettings {
  const provider = cleanHeader(process.env.EMAIL_PROVIDER || "sendgrid", "provider");
  if (provider !== "sendgrid" && provider !== "smtp") {
    throw new Error("EMAIL_PROVIDER must be sendgrid or smtp.");
  }

  return {
    provider,
    fromEmail: firstValue(
      process.env.EMAIL_FROM_EMAIL,
      process.env.SENDGRID_FROM_EMAIL,
      process.env.CONTACT_FROM_EMAIL,
      process.env.SUPPORT_EMAIL,
      "hello@homzieproperty.com",
    ),
    fromName: firstValue(process.env.EMAIL_FROM_NAME, process.env.SENDGRID_FROM_NAME, "Homzie"),
    replyToEmail: process.env.EMAIL_REPLY_TO_EMAIL || "",
  };
}

function normalizedFields(value: unknown) {
  const parsed = settingsSchema.safeParse(value);
  if (!parsed.success) throw new Error("Invalid email settings.");

  return {
    provider: parsed.data.provider,
    fromEmail: cleanHeader(parsed.data.fromEmail, "fromEmail"),
    fromName: cleanHeader(parsed.data.fromName, "fromName"),
    replyToEmail: cleanHeader(parsed.data.replyToEmail, "replyToEmail"),
  };
}

function resolvedSettings(value?: unknown): EmailSettings {
  const defaults = environmentSettings();
  if (value !== undefined && (!value || typeof value !== "object" || Array.isArray(value))) {
    throw new Error("Invalid saved email settings.");
  }
  const stored = (value || {}) as Partial<EmailSettings>;
  const settings = normalizedFields({
    provider: stored.provider ?? defaults.provider,
    fromEmail: firstValue(stored.fromEmail, defaults.fromEmail),
    fromName: firstValue(stored.fromName, defaults.fromName),
    replyToEmail: stored.replyToEmail ?? defaults.replyToEmail,
  });

  if (!emailAddressSchema.safeParse(settings.fromEmail).success) {
    throw new Error("Set a valid outgoing email address.");
  }
  if (!settings.fromName || settings.fromName.length > 100) {
    throw new Error("Email sender name must contain 1 to 100 characters.");
  }
  if (settings.replyToEmail && !emailAddressSchema.safeParse(settings.replyToEmail).success) {
    throw new Error("Set a valid reply-to email address or leave it empty.");
  }

  return settings;
}

export async function getStoredEmailSettings(): Promise<EmailSettings> {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, emailSettingsKey))
    .limit(1);

  return resolvedSettings(row?.value);
}

export async function saveStoredEmailSettings(settings: EmailSettings) {
  const normalized = normalizedFields(settings);
  const resolved = resolvedSettings(normalized);

  await db
    .insert(platformSettings)
    .values({ key: emailSettingsKey, value: normalized, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: normalized, updatedAt: new Date() },
    });

  return resolved;
}

export async function getEmailSettingsView(): Promise<EmailSettingsView> {
  const settings = await getStoredEmailSettings();

  return {
    provider: settings.provider,
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
    replyToEmail: settings.replyToEmail,
    sendgridConfigured: Boolean(process.env.SENDGRID_API_KEY?.trim()),
    ...getSmtpConfigurationStatus(),
  };
}
