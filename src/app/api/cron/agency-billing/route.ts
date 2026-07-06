import { NextResponse } from "next/server";

import { finalizeDueAgencyBillingPeriods } from "@/modules/agencies/billing-runner";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.AGENCY_BILLING_CRON_SECRET;

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

  const result = await finalizeDueAgencyBillingPeriods();

  return NextResponse.json({
    asOf: result.asOf.toISOString(),
    ok: true,
    processed: result.results.length,
    results: result.results,
  });
}
