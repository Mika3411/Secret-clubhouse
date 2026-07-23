const WORKER_VERSION = "2026-07-23.1";
const DIAGNOSTIC_CACHE = "secret-clubhouse-push-diagnostics-v1";
const PAYLOADLESS_QUEUE_KEY = new URL("/__secret-clubhouse-payloadless-tests", self.location.origin).href;
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const prunePayloadlessTests = (queue) => {
  const cutoff = Date.now() - 45000;
  return queue.filter((item) => item?.createdAt >= cutoff && requestIdPattern.test(item.requestId ?? ""));
};

const readPayloadlessTests = async () => {
  try {
    const cache = await caches.open(DIAGNOSTIC_CACHE);
    const response = await cache.match(PAYLOADLESS_QUEUE_KEY);
    const queue = response ? await response.json() : [];
    return prunePayloadlessTests(Array.isArray(queue) ? queue : []);
  } catch {
    return [];
  }
};

const writePayloadlessTests = async (queue) => {
  const cache = await caches.open(DIAGNOSTIC_CACHE);
  if (!queue.length) {
    await cache.delete(PAYLOADLESS_QUEUE_KEY);
    return;
  }
  await cache.put(PAYLOADLESS_QUEUE_KEY, new Response(JSON.stringify(queue.slice(-10)), {
    headers: { "Content-Type": "application/json" },
  }));
};

const preparePayloadlessTest = async (requestId) => {
  const queue = (await readPayloadlessTests()).filter((item) => item.requestId !== requestId);
  queue.push({ requestId, createdAt: Date.now() });
  await writePayloadlessTests(queue);
};

const cancelPayloadlessTest = async (requestId) => {
  const queue = (await readPayloadlessTests()).filter((item) => item.requestId !== requestId);
  await writePayloadlessTests(queue);
};

const takePayloadlessTest = async () => {
  const queue = await readPayloadlessTests();
  const pending = queue.shift();
  await writePayloadlessTests(queue);
  return pending?.requestId ?? null;
};

self.addEventListener("message", (event) => {
  const message = event.data;
  if (message?.type === "secret-clubhouse:get-worker-version") {
    event.ports[0]?.postMessage({ workerVersion: WORKER_VERSION });
    return;
  }
  if (!requestIdPattern.test(message?.requestId ?? "")) return;
  if (message.type === "secret-clubhouse:prepare-payloadless-test") {
    event.waitUntil((async () => {
      await preparePayloadlessTest(message.requestId);
      event.ports[0]?.postMessage({ prepared: true, workerVersion: WORKER_VERSION });
    })());
    return;
  }
  if (message.type === "secret-clubhouse:cancel-payloadless-test") {
    event.waitUntil((async () => {
      await cancelPayloadlessTest(message.requestId);
      event.ports[0]?.postMessage({ cancelled: true, workerVersion: WORKER_VERSION });
    })());
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
    const payloadlessRequestId = hasPayload ? null : await takePayloadlessTest();
    const diagnosticBase = { requestId: data.requestId ?? payloadlessRequestId, hasPayload };
    await reportPushDiagnostic({
      ...diagnosticBase,
      stage: parseError ? "parse-error" : "received",
      errorName: parseError?.name ?? null,
    });

    try {
      await self.registration.showNotification(data.title || "Secret Clubhouse", {
        body: data.body || "Vous avez une nouvelle notification.",
        tag: data.tag || (hasPayload ? "secret-clubhouse" : "secret-clubhouse-payloadless-test"),
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
