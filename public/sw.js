const WORKER_RELEASE = "2026-07-23.3";
const WORKER_PROTOCOL_VERSION = 1;
const WORKER_CAPABILITIES = ["push-diagnostics"];
// Les onglets déjà ouverts des deux déploiements précédents attendent chacun
// une version exacte. Deux réponses successives leur permettent de migrer sans rechargement.
const LEGACY_WORKER_VERSIONS = ["2026-07-23.1", "2026-07-23.2"];
const legacyProbeIndexByClient = new Map();

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const message = event.data;
  if (message?.type === "secret-clubhouse:activate-update") {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (message?.type === "secret-clubhouse:get-worker-capabilities") {
    event.ports[0]?.postMessage({
      protocolVersion: WORKER_PROTOCOL_VERSION,
      capabilities: WORKER_CAPABILITIES,
      workerRelease: WORKER_RELEASE,
    });
    return;
  }
  if (message?.type === "secret-clubhouse:get-worker-version") {
    const clientId = event.source?.id ?? "unknown";
    const probeIndex = legacyProbeIndexByClient.get(clientId) ?? 0;
    event.ports[0]?.postMessage({
      workerVersion: LEGACY_WORKER_VERSIONS[probeIndex],
      workerRelease: WORKER_RELEASE,
    });
    legacyProbeIndexByClient.set(clientId, (probeIndex + 1) % LEGACY_WORKER_VERSIONS.length);
    return;
  }
  if (message?.type === "secret-clubhouse:prepare-payloadless-test") {
    event.ports[0]?.postMessage({ prepared: true, workerVersion: LEGACY_WORKER_VERSIONS[0], workerRelease: WORKER_RELEASE });
    return;
  }
  if (message?.type === "secret-clubhouse:cancel-payloadless-test") {
    event.ports[0]?.postMessage({ cancelled: true, workerVersion: LEGACY_WORKER_VERSIONS[0], workerRelease: WORKER_RELEASE });
  }
});

const reportPushDiagnostic = async (detail) => {
  try {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    windows.forEach((windowClient) => windowClient.postMessage({
      type: "secret-clubhouse:push-diagnostic",
      workerVersion: WORKER_RELEASE,
      protocolVersion: WORKER_PROTOCOL_VERSION,
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
