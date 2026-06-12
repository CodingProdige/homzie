import type { MetadataRoute } from "next";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function sitemapXml(entries: MetadataRoute.Sitemap) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((entry) => {
    const lastModified =
      entry.lastModified instanceof Date
        ? entry.lastModified.toISOString()
        : entry.lastModified;

    return `<url>
<loc>${escapeXml(entry.url)}</loc>
${lastModified ? `<lastmod>${escapeXml(String(lastModified))}</lastmod>` : ""}
${entry.changeFrequency ? `<changefreq>${entry.changeFrequency}</changefreq>` : ""}
${typeof entry.priority === "number" ? `<priority>${entry.priority}</priority>` : ""}
</url>`;
  })
  .join("\n")}
</urlset>`;
}

export function sitemapResponse(entries: MetadataRoute.Sitemap) {
  return new Response(sitemapXml(entries), {
    headers: {
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
