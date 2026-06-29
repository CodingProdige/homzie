self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const defaultNotificationIcon = "/favicon/web-app-manifest-192x192.png";
const defaultNotificationBadge = "/favicon/favicon-96x96.png";

self.addEventListener("push", (event) => {
  if (!event.data) return;

  const payload = event.data.json();
  const title = payload.title || "Homzie";
  const options = {
    actions: [
      {
        action: "open",
        title: "Open",
      },
    ],
    badge: payload.badge || defaultNotificationBadge,
    body: payload.body,
    data: payload.data || {},
    icon: payload.icon || defaultNotificationIcon,
    requireInteraction: payload.tag === "incoming-call",
    tag: payload.tag || "homzie-event",
  };

  if (payload.image) {
    options.image = payload.image;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      return self.clients.openWindow(url);
    }),
  );
});
