import { NextResponse } from "next/server";

import { sendDueBroadcastCampaigns } from "@/modules/broadcasts/server";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.BROADCAST_CRON_SECRET;

  if (!secret) return process.env.NODE_ENV !== "production";

  const authorization = request.headers.get("authorization");
  const url = new URL(request.url);

  return (
    authorization === `Bearer ${secret}` ||
    url.searchParams.get("secret") === secret
  );
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const results = await sendDueBroadcastCampaigns();

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
  });
}
