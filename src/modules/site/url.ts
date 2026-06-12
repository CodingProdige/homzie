const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://homzie.co.za"
).replace(/\/$/, "");

export function getSiteUrl() {
  return siteUrl;
}

export function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
