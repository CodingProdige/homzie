import { createVerify } from "node:crypto";

import { NextResponse } from "next/server";

import { recordSendGridBroadcastEvents } from "@/modules/broadcasts/server";

export const runtime = "nodejs";

const sendGridSignatureHeader = "x-twilio-email-event-webhook-signature";
const sendGridTimestampHeader = "x-twilio-email-event-webhook-timestamp";

function publicKeyPem(value: string) {
  const trimmed = value.trim();

  if (trimmed.includes("BEGIN PUBLIC KEY")) return trimmed;

  const compact = trimmed.replace(/\s+/g, "");
  const lines = compact.match(/.{1,64}/g)?.join("\n") || compact;

  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

function authorizedByLegacySecret(request: Request) {
  const secret = process.env.SENDGRID_EVENT_WEBHOOK_SECRET;
  const url = new URL(request.url);
  const headerSecret = request.headers.get("x-homzie-webhook-secret");

  return Boolean(secret && (headerSecret === secret || url.searchParams.get("secret") === secret));
}

function authorizedBySendGridSignature(request: Request, rawBody: Buffer) {
  const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;

  if (!publicKey) return false;

  const signature = request.headers.get(sendGridSignatureHeader);
  const timestamp = request.headers.get(sendGridTimestampHeader);

  if (!signature || !timestamp) return false;

  try {
    const verifier = createVerify("sha256");

    verifier.update(Buffer.from(timestamp, "utf8"));
    verifier.update(rawBody);
    verifier.end();

    return verifier.verify(publicKeyPem(publicKey), signature, "base64");
  } catch {
    return false;
  }
}

function authorized(request: Request, rawBody: Buffer) {
  if (authorizedBySendGridSignature(request, rawBody)) return true;
  if (authorizedByLegacySecret(request)) return true;

  return (
    process.env.NODE_ENV !== "production" &&
    !process.env.SENDGRID_WEBHOOK_PUBLIC_KEY &&
    !process.env.SENDGRID_EVENT_WEBHOOK_SECRET
  );
}

export async function POST(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer());

  if (!authorized(request, rawBody)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const events = Array.isArray(payload) ? payload : [payload];
  const result = await recordSendGridBroadcastEvents(events);

  return NextResponse.json({ ok: true, ...result });
}
