const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://homzie.co.za"
).replace(/\/$/, "");

export function getSiteUrl() {
  return siteUrl;
}

export function absoluteUrl(path: string) {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
