import { getStaticSitemapEntries } from "@/modules/seo/sitemap-data";
import { sitemapResponse } from "@/modules/seo/sitemap-xml";

export const revalidate = 3600;

export async function GET() {
  return sitemapResponse(await getStaticSitemapEntries());
}
