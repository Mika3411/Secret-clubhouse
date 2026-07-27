self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let data = {};
    try {
      data = event.data?.json() ?? {};
    } catch {}
    if (data.notificationType === "call-state" && data.callId) {
      const notifications = await self.registration.getNotifications({ tag: `call-${data.callId}` });
      notifications.forEach((notification) => notification.close());
      return;
    }
    await self.registration.showNotification(data.title || "Secret Clubhouse", {
      body: data.body || "Vous avez une nouvelle notification.",
      tag: data.tag || "secret-clubhouse",
      renotify: data.notificationType !== "incoming-call",
      requireInteraction: true,
      silent: false,
      timestamp: Date.now(),
      actions: [{ action: "open", title: "Ouvrir" }],
      data: {
        callId: data.callId,
        conversationId: data.conversationId,
        gameId: data.gameId,
        expiresAt: data.expiresAt,
        notificationType: data.notificationType,
        url: data.url || "/",
      },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((windowClient) => windowClient.url.startsWith(self.location.origin));
    return existing ? existing.focus().then((windowClient) => windowClient.navigate(destination)) : clients.openWindow(destination);
  }));
});
