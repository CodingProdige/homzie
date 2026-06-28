import {
  buildGoogleAdsPageFeedCsv,
  getHomzieFundedListingPageFeedRows,
} from "@/modules/google-ads/page-feeds";
import { getStoredGoogleAdsSettings } from "@/modules/platform-settings/google-ads-settings";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const settings = await getStoredGoogleAdsSettings();
  const token = new URL(request.url).searchParams.get("token") || "";

  if (
    !settings.enabled ||
    !settings.homzieFundedEnabled ||
    !settings.homzieFundedPageFeedToken ||
    token !== settings.homzieFundedPageFeedToken
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rows = await getHomzieFundedListingPageFeedRows(
    settings.homzieFundedPageFeedLabel,
  );
  const csv = buildGoogleAdsPageFeedCsv(rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
