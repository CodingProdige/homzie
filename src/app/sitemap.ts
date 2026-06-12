import type { MetadataRoute } from "next";

import {
  getListingSitemapEntries,
  getLocationSitemapEntries,
  getProfileSitemapEntries,
  getStaticSitemapEntries,
} from "@/modules/seo/sitemap-data";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  try {
    const [staticEntries, listingEntries, profileEntries, locationEntries] =
      await Promise.all([
        getStaticSitemapEntries(now),
        getListingSitemapEntries(now),
        getProfileSitemapEntries(now),
        getLocationSitemapEntries(now),
      ]);

    return [
      ...staticEntries,
      ...locationEntries,
      ...listingEntries,
      ...profileEntries,
    ];
  } catch (error) {
    console.warn("Dynamic sitemap entries skipped because the database is unavailable.", {
      error,
    });

    return getStaticSitemapEntries(now);
  }
}
