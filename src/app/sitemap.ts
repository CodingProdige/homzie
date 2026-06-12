import type { MetadataRoute } from "next";

import {
  getListingSitemapEntries,
  getLocationSitemapEntries,
  getProfileSitemapEntries,
  getReelSitemapEntries,
  getStaticSitemapEntries,
} from "@/modules/seo/sitemap-data";

export const revalidate = 3600;

function uniqueSitemapEntries(entries: MetadataRoute.Sitemap) {
  const urls = new Set<string>();

  return entries.filter((entry) => {
    if (urls.has(entry.url)) return false;

    urls.add(entry.url);
    return true;
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  try {
    const [
      staticEntries,
      listingEntries,
      profileEntries,
      reelEntries,
      locationEntries,
    ] =
      await Promise.all([
        getStaticSitemapEntries(now),
        getListingSitemapEntries(now),
        getProfileSitemapEntries(now),
        getReelSitemapEntries(now),
        getLocationSitemapEntries(now),
      ]);

    return uniqueSitemapEntries([
      ...staticEntries,
      ...locationEntries,
      ...listingEntries,
      ...profileEntries,
      ...reelEntries,
    ]);
  } catch (error) {
    console.warn("Dynamic sitemap entries skipped because the database is unavailable.", {
      error,
    });

    return getStaticSitemapEntries(now);
  }
}
