import type { MetadataRoute } from "next";
import { getStoredSeoSettings } from "@/modules/seo/settings";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://homzie.co.za"
).replace(/\/$/, "");

const sitemaps = [
  `${siteUrl}/sitemap.xml`,
  `${siteUrl}/sitemaps/static.xml`,
  `${siteUrl}/sitemaps/listings.xml`,
  `${siteUrl}/sitemaps/profiles.xml`,
  `${siteUrl}/sitemaps/locations.xml`,
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getStoredSeoSettings();

  if (!seo.allowIndexing) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
      sitemap: sitemaps,
      host: siteUrl,
    };
  }

  return {
    rules: [
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/billing/",
          "/listings/new",
          "/listings/*/edit",
          "/onboarding/",
          "/settings/",
          "/users/*/performance",
          "/reels/new",
          "/reels/*/edit",
        ],
      },
    ],
    sitemap: sitemaps,
    host: siteUrl,
  };
}
