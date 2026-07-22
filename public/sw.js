self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(self.registration.showNotification(data.title || "Secret Clubhouse", {
    body: data.body || "Vous avez une nouvelle notification.",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: data.tag || "secret-clubhouse",
    renotify: true,
    data: { conversationId: data.conversationId, url: "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((windowClient) => windowClient.url.startsWith(self.location.origin));
    return existing ? existing.focus() : clients.openWindow(event.notification.data?.url || "/");
  }));
});
