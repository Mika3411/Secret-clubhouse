export function inspectWebPushBrowser(
  browserWindow = globalThis.window,
  browserNavigator = globalThis.navigator,
) {
  if (!browserWindow?.isSecureContext) return { supported: false, reason: "insecure-context" };
  if (!browserNavigator || !("serviceWorker" in browserNavigator)) {
    return { supported: false, reason: "service-worker" };
  }
  if (!("Notification" in browserWindow)) return { supported: false, reason: "notifications" };
  return { supported: true, reason: "" };
}

export function hasUsablePushManager(registration) {
  return typeof registration?.pushManager?.getSubscription === "function"
    && typeof registration?.pushManager?.subscribe === "function";
}
