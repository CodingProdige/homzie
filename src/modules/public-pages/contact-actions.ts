"use server";

import "server-only";

import { headers } from "next/headers";
import { z } from "zod";

import { sendSendGridEmail } from "@/modules/email/sendgrid";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(120, "Keep your name under 120 characters."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(180),
  phone: z.string().trim().max(40, "Keep your phone number under 40 characters.").optional(),
  subject: z.string().trim().min(3, "Add a short subject.").max(160, "Keep the subject under 160 characters."),
  message: z.string().trim().min(10, "Tell us a little more so we can help.").max(4000, "Keep the message under 4000 characters."),
});

export type ContactFormState = {
  ok: boolean;
  message: string;
  submittedAt?: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult =
  | { ok: true }
  | {
      ok: false;
      retryAt: number;
    };

const contactRateLimitWindowMs = 60 * 60 * 1000;
const contactRateLimitMax = 5;

declare global {
  var homzieContactRateLimit: Map<string, RateLimitEntry> | undefined;
}

function getRateLimitStore() {
  globalThis.homzieContactRateLimit ??= new Map<string, RateLimitEntry>();
  return globalThis.homzieContactRateLimit;
}

function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const store = getRateLimitStore();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + contactRateLimitWindowMs });
    return { ok: true };
  }

  if (existing.count >= contactRateLimitMax) {
    return {
      ok: false,
      retryAt: existing.resetAt,
    };
  }

  existing.count += 1;
  return { ok: true };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function contactRecipient() {
  return {
    email:
      process.env.CONTACT_TO_EMAIL ||
      process.env.SUPPORT_EMAIL ||
      process.env.SENDGRID_FROM_EMAIL ||
      "support@homzie.co.za",
    name: "Homzie Support",
  };
}

function formatRetryMessage(retryAt: number) {
  const minutes = Math.max(1, Math.ceil((retryAt - Date.now()) / 60000));
  return `Too many messages from this connection. Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

export async function sendContactMessage(
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    subject: formData.get("subject"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message || "Check your details and try again.",
    };
  }

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientIp =
    requestHeaders.get("cf-connecting-ip") ||
    requestHeaders.get("x-real-ip") ||
    forwardedFor ||
    "unknown";
  const rateLimit = checkRateLimit(`${clientIp}:${parsed.data.email}`);

  if (!rateLimit.ok) {
    return {
      ok: false,
      message: formatRetryMessage(rateLimit.retryAt),
    };
  }

  const phone = parsed.data.phone || "Not provided";
  const subject = `Homzie contact: ${parsed.data.subject}`;
  const text = [
    `Name: ${parsed.data.name}`,
    `Email: ${parsed.data.email}`,
    `Phone: ${phone}`,
    `Subject: ${parsed.data.subject}`,
    "",
    parsed.data.message,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827">
      <h2 style="margin:0 0 16px">New Homzie contact message</h2>
      <p><strong>Name:</strong> ${escapeHtml(parsed.data.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(parsed.data.email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
      <p><strong>Subject:</strong> ${escapeHtml(parsed.data.subject)}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
      <p style="white-space:pre-wrap">${escapeHtml(parsed.data.message)}</p>
    </div>
  `;

  try {
    await sendSendGridEmail({
      to: contactRecipient(),
      replyTo: {
        email: parsed.data.email,
        name: parsed.data.name,
      },
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error("Failed to send contact email", error);
    return {
      ok: false,
      message: "We could not send that right now. Please try again in a moment.",
    };
  }

  return {
    ok: true,
    message: "Message sent. We will get back to you soon.",
    submittedAt: Date.now(),
  };
}
