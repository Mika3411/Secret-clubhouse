const WORKER_VERSION = "2026-07-23.2";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const message = event.data;
  if (message?.type === "secret-clubhouse:get-worker-version") {
    event.ports[0]?.postMessage({ workerVersion: WORKER_VERSION });
  }
});

const reportPushDiagnostic = async (detail) => {
  try {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    windows.forEach((windowClient) => windowClient.postMessage({
      type: "secret-clubhouse:push-diagnostic",
      workerVersion: WORKER_VERSION,
      ...detail,
    }));
  } catch {}
};

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    const hasPayload = Boolean(event.data);
    let data = {};
    let parseError = null;
    try {
      data = event.data?.json() ?? {};
    } catch (error) {
      parseError = error;
    }
    const diagnosticBase = { requestId: data.requestId ?? null, hasPayload };
    await reportPushDiagnostic({
      ...diagnosticBase,
      stage: parseError ? "parse-error" : "received",
      errorName: parseError?.name ?? null,
    });

    try {
      await self.registration.showNotification(data.title || "Secret Clubhouse", {
        body: data.body || "Vous avez une nouvelle notification.",
        tag: data.tag || "secret-clubhouse",
        renotify: true,
        requireInteraction: true,
        silent: false,
        timestamp: Date.now(),
        actions: [{ action: "open", title: "Ouvrir" }],
        data: { conversationId: data.conversationId, notificationType: data.notificationType, url: data.url || "/" },
      });
      await reportPushDiagnostic({ ...diagnosticBase, stage: "shown" });
    } catch (error) {
      await reportPushDiagnostic({
        ...diagnosticBase,
        stage: "show-error",
        errorName: error.name,
        errorMessage: String(error.message || "").slice(0, 160),
      });
      throw error;
    }
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
