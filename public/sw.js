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
    badge: "/favicon.ico",
    body: payload.body,
    data: payload.data || {},
    icon: "/favicon.ico",
    requireInteraction: payload.tag === "incoming-call",
    tag: payload.tag || "homzie-event",
  };

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
