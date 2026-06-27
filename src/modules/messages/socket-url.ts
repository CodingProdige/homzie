export function getMessageSocketUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SOCKET_URL;

  if (configuredUrl && typeof window !== "undefined") {
    try {
      const url = new URL(configuredUrl);
      const isLocalSocketHost = ["localhost", "127.0.0.1"].includes(url.hostname);
      const isLocalPageHost = ["localhost", "127.0.0.1"].includes(
        window.location.hostname,
      );

      if (!isLocalSocketHost || isLocalPageHost) {
        return configuredUrl;
      }
    } catch {
      return configuredUrl;
    }
  }

  if (
    process.env.NODE_ENV === "development" &&
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ) {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return undefined;
}
