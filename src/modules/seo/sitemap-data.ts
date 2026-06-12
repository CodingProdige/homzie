import type { MetadataRoute } from "next";
import { and, desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { propertyListings, reels, users } from "@/db/schema";
import { shouldSkipDatabaseDuringBuild } from "@/modules/build-flags";
import { buildListingPath } from "@/modules/listings/seo";
import { buildReelPath } from "@/modules/reels/urls";
import { getStoredSeoSettings } from "@/modules/seo/settings";
import { absoluteUrl } from "@/modules/site/url";

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function getStaticSitemapEntries(now = new Date()): Promise<MetadataRoute.Sitemap> {
  return [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/listings"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/agents"), lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/reels"), lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/become-agent"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/property"), lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/property/for-sale"), lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: absoluteUrl("/property/to-rent"), lastModified: now, changeFrequency: "daily", priority: 0.8 },
  ];
}

export async function getListingSitemapEntries(now = new Date()): Promise<MetadataRoute.Sitemap> {
  if (shouldSkipDatabaseDuringBuild()) return [];

  const seoSettings = await getStoredSeoSettings();

  if (!seoSettings.allowIndexing) return [];

  const rows = await db
    .select({
      details: propertyListings.details,
      id: propertyListings.id,
      isDemoContent: propertyListings.isDemoContent,
      listedAt: propertyListings.listedAt,
      listingType: propertyListings.listingType,
      location: propertyListings.location,
      propertyType: propertyListings.propertyType,
      title: propertyListings.title,
      updatedAt: propertyListings.updatedAt,
    })
    .from(propertyListings)
    .where(eq(propertyListings.status, "published"))
    .orderBy(desc(propertyListings.updatedAt))
    .limit(seoSettings.sitemapMaxEntries);

  return rows.flatMap((listing) => {
    if (listing.isDemoContent && !seoSettings.indexDemoContent) return [];

    const details = objectValue(listing.details);

    return [{
      url: absoluteUrl(
        buildListingPath({
          bedrooms: details.bedrooms as number | string | null,
          city: stringValue(details.city),
          country: stringValue(details.country),
          id: listing.id,
          listingType: listing.listingType,
          location: listing.location,
          propertyType: listing.propertyType,
          province:
            stringValue(details.province) ||
            stringValue(details.state) ||
            stringValue(details.region),
          suburb: stringValue(details.suburb),
          title: listing.title,
        }),
      ),
      lastModified: listing.updatedAt || listing.listedAt || now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }];
  });
}

export async function getReelSitemapEntries(now = new Date()): Promise<MetadataRoute.Sitemap> {
  if (shouldSkipDatabaseDuringBuild()) return [];

  const seoSettings = await getStoredSeoSettings();

  if (!seoSettings.allowIndexing) return [];

  const rows = await db
    .select({
      createdAt: reels.createdAt,
      id: reels.id,
      isDemo: users.isDemo,
      updatedAt: reels.updatedAt,
    })
    .from(reels)
    .innerJoin(users, eq(users.id, reels.userId))
    .where(
      and(
        eq(reels.status, "published"),
        eq(users.status, "active"),
        eq(users.profileVisible, true),
        isNotNull(users.username),
      ),
    )
    .orderBy(desc(reels.updatedAt))
    .limit(seoSettings.sitemapMaxEntries);

  return rows.flatMap((reel) => {
    if (reel.isDemo && !seoSettings.indexDemoContent) return [];

    return [{
      url: absoluteUrl(buildReelPath(reel.id)),
      lastModified: reel.updatedAt || reel.createdAt || now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }];
  });
}

export async function getProfileSitemapEntries(now = new Date()): Promise<MetadataRoute.Sitemap> {
  if (shouldSkipDatabaseDuringBuild()) return [];

  const seoSettings = await getStoredSeoSettings();

  if (!seoSettings.allowIndexing) return [];

  const rows = await db
    .select({
      createdAt: users.createdAt,
      isDemo: users.isDemo,
      updatedAt: users.updatedAt,
      username: users.username,
    })
    .from(users)
    .where(and(eq(users.status, "active"), eq(users.profileVisible, true), isNotNull(users.username)))
    .orderBy(desc(users.updatedAt))
    .limit(seoSettings.sitemapMaxEntries);

  return rows.flatMap((user) => {
    if (user.isDemo && !seoSettings.indexDemoContent) return [];

    return [{
      url: absoluteUrl(`/users/${user.username}`),
      lastModified: user.updatedAt || user.createdAt || now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }];
  });
}

export async function getLocationSitemapEntries(now = new Date()): Promise<MetadataRoute.Sitemap> {
  const listingEntries = await getListingSitemapEntries(now);
  const urls = new Set<string>();

  listingEntries.forEach((entry) => {
    const url = new URL(entry.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if (parts.length >= 2) urls.add(absoluteUrl(`/${parts.slice(0, 2).join("/")}`));
    if (parts.length >= 3) urls.add(absoluteUrl(`/${parts.slice(0, 3).join("/")}`));
    if (parts.length >= 4) urls.add(absoluteUrl(`/${parts.slice(0, 4).join("/")}`));
  });

  return Array.from(urls).map((url) => ({
    url,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.65,
  }));
}
