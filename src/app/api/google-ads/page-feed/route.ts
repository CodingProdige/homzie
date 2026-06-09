import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { adCampaigns, propertyListings } from "@/db/schema";
import { getStoredGoogleAdsSettings } from "@/modules/platform-settings/google-ads-settings";

export const runtime = "nodejs";

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export async function GET(request: Request) {
  const settings = await getStoredGoogleAdsSettings();
  const token = new URL(request.url).searchParams.get("token") || "";

  if (!settings.pageFeedToken || token !== settings.pageFeedToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rows = await db
    .select({
      promotedUrl: adCampaigns.promotedUrl,
    })
    .from(adCampaigns)
    .innerJoin(propertyListings, eq(propertyListings.id, adCampaigns.listingId))
    .where(
      and(
        eq(adCampaigns.channel, "google"),
        eq(adCampaigns.promotedType, "listing"),
        eq(propertyListings.status, "published"),
        inArray(adCampaigns.status, ["ready", "live"]),
      ),
    )
    .orderBy(desc(adCampaigns.updatedAt));

  const uniqueUrls = Array.from(
    new Set(rows.map((row) => row.promotedUrl).filter((value): value is string => Boolean(value))),
  );

  const csv = [
    "Page URL,Custom label",
    ...uniqueUrls.map((url) =>
      `${csvEscape(url)},${csvEscape(settings.pageFeedLabel)}`,
    ),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
