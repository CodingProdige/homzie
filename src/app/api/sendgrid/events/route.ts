import { NextResponse } from "next/server";

import { recordSendGridBroadcastEvents } from "@/modules/broadcasts/server";

function authorized(request: Request) {
  const secret = process.env.SENDGRID_EVENT_WEBHOOK_SECRET;

  if (!secret) return process.env.NODE_ENV !== "production";

  const url = new URL(request.url);
  const headerSecret = request.headers.get("x-homzie-webhook-secret");

  return headerSecret === secret || url.searchParams.get("secret") === secret;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const events = Array.isArray(payload) ? payload : [payload];
  const result = await recordSendGridBroadcastEvents(events);

  return NextResponse.json({ ok: true, ...result });
}
