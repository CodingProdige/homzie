import type { MetadataRoute } from "next";
import { and, desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { propertyListings, users } from "@/db/schema";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://homzie.co.za"
).replace(/\/$/, "");

export const revalidate = 3600;

function absoluteUrl(path: string) {
  return `${siteUrl}${path}`;
}

async function getDynamicSitemapEntries(now: Date): Promise<MetadataRoute.Sitemap> {
  try {
    const [publicListings, publicUsers] = await Promise.all([
      db
        .select({
          id: propertyListings.id,
          updatedAt: propertyListings.updatedAt,
          listedAt: propertyListings.listedAt,
        })
        .from(propertyListings)
        .where(eq(propertyListings.status, "published"))
        .orderBy(desc(propertyListings.updatedAt))
        .limit(5000),
      db
        .select({
          username: users.username,
          updatedAt: users.updatedAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(and(eq(users.status, "active"), isNotNull(users.username)))
        .orderBy(desc(users.updatedAt))
        .limit(5000),
    ]);

    return [
      ...publicListings.map((listing) => ({
        url: absoluteUrl(`/listings/${listing.id}`),
        lastModified: listing.updatedAt || listing.listedAt || now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...publicUsers.map((user) => ({
        url: absoluteUrl(`/users/${user.username}`),
        lastModified: user.updatedAt || user.createdAt || now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ];
  } catch (error) {
    console.warn("Dynamic sitemap entries skipped because the database is unavailable.", {
      error,
    });

    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  return [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/listings"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/agents"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/reels"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/become-agent"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...(await getDynamicSitemapEntries(now)),
  ];
}
