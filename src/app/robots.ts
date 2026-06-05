import type { MetadataRoute } from "next";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://homzie.co.za"
).replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
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
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
