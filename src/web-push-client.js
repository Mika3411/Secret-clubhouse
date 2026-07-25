import { hasUsablePushManager, inspectWebPushBrowser } from "./web-push-support.js";

export function decodeApplicationServerKey(publicKey) {
  const padding = "=".repeat((4 - publicKey.length % 4) % 4);
  const base64 = (publicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function applicationServerKeysMatch(currentKey, expectedKey) {
  if (!currentKey) return true;
  const current = new Uint8Array(currentKey);
  if (current.byteLength !== expectedKey.byteLength) return false;
  return current.every((value, index) => value === expectedKey[index]);
}

export function announceWebPushAvailability(enabled, browserWindow = globalThis.window) {
  const CustomEventConstructor = browserWindow?.CustomEvent ?? globalThis.CustomEvent;
  if (!browserWindow?.dispatchEvent || !CustomEventConstructor) return;
  browserWindow.dispatchEvent(new CustomEventConstructor("secretclubhouse:web-push-synced", {
    detail: { enabled: Boolean(enabled) },
  }));
}

export async function synchronizeWebPushSubscription(
  api,
  browserWindow = globalThis.window,
  browserNavigator = globalThis.navigator,
) {
  const support = inspectWebPushBrowser(browserWindow, browserNavigator);
  if (!support.supported || browserWindow.Notification.permission !== "granted") {
    return { enabled: false, reason: support.reason || "permission" };
  }

  const consentResult = await api.notificationConsent();
  if (!consentResult.consent?.active) return { enabled: false, reason: "consent" };

  const registration = await browserNavigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  if (!hasUsablePushManager(registration)) return { enabled: false, reason: "push-manager" };
  await registration.update().catch(() => undefined);

  const { publicKey, keyId } = await api.pushPublicKey();
  const applicationServerKey = decodeApplicationServerKey(publicKey);
  let subscription = await registration.pushManager.getSubscription();

  if (subscription && !applicationServerKeysMatch(subscription.options?.applicationServerKey, applicationServerKey)) {
    await api.unsubscribePush(subscription.endpoint).catch(() => undefined);
    await subscription.unsubscribe().catch(() => undefined);
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }
  await api.subscribePush(subscription.toJSON(), keyId);
  return { enabled: true, subscription };
}
