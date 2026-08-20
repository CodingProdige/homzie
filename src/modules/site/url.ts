const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.APP_URL ||
  "https://homzieproperty.com"
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
