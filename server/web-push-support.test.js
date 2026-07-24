import test from "node:test";
import assert from "node:assert/strict";
import {
  hasUsablePushManager,
  inspectWebPushBrowser,
} from "../src/web-push-support.js";

test("la détection Web Push accepte un navigateur sans constructeur PushManager global", () => {
  const browserWindow = {
    isSecureContext: true,
    Notification: { permission: "default" },
  };
  const browserNavigator = { serviceWorker: {} };

  assert.deepEqual(inspectWebPushBrowser(browserWindow, browserNavigator), {
    supported: true,
    reason: "",
  });
});

test("le gestionnaire Push est vérifié sur l’inscription réelle du service worker", () => {
  assert.equal(hasUsablePushManager({
    pushManager: {
      getSubscription() {},
      subscribe() {},
    },
  }), true);
  assert.equal(hasUsablePushManager({ pushManager: {} }), false);
});

test("Web Push reste refusé hors HTTPS ou sans API de notification", () => {
  assert.deepEqual(inspectWebPushBrowser(
    { isSecureContext: false, Notification: {} },
    { serviceWorker: {} },
  ), { supported: false, reason: "insecure-context" });
  assert.deepEqual(inspectWebPushBrowser(
    { isSecureContext: true },
    { serviceWorker: {} },
  ), { supported: false, reason: "notifications" });
});
