self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(self.registration.showNotification(data.title || "Secret Clubhouse", {
    body: data.body || "Vous avez une nouvelle notification.",
    tag: data.tag || "secret-clubhouse",
    renotify: true,
    requireInteraction: true,
    silent: false,
    timestamp: Date.now(),
    actions: [{ action: "open", title: "Ouvrir" }],
    data: { conversationId: data.conversationId, notificationType: data.notificationType, url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((windowClient) => windowClient.url.startsWith(self.location.origin));
    return existing ? existing.focus().then((windowClient) => windowClient.navigate(destination)) : clients.openWindow(destination);
  }));
});
