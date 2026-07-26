import assert from "node:assert/strict";
import test from "node:test";
import webpush from "web-push";
import { initializeWebPushNotifications } from "./notifications/web-push-initialization.js";

test("l’initialisation Web Push reste fermée quand la fonctionnalité est désactivée", async () => {
  const logs = [];
  const state = await initializeWebPushNotifications({
    enabled: false,
    environment: {},
    webPushClient: {},
    database: {},
    log: (message) => logs.push(message),
  });

  assert.deepEqual(state, {
    pushEnabled: false,
    vapidPublicKey: "",
    vapidKeyRing: null,
  });
  assert.deepEqual(logs, ["Web Push désactivé par WEB_PUSH_ENABLED."]);
});

test("l’initialisation Web Push expose la paire VAPID configurée", async () => {
  const keys = webpush.generateVAPIDKeys();
  const configuredPairs = [];
  const state = await initializeWebPushNotifications({
    enabled: true,
    environment: {
      VAPID_PUBLIC_KEY: keys.publicKey,
      VAPID_PRIVATE_KEY: keys.privateKey,
    },
    webPushClient: {
      setVapidDetails(...pair) {
        configuredPairs.push(pair);
      },
    },
    database: {
      query() {
        throw new Error("La base ne doit pas être consultée avec une paire configurée.");
      },
    },
  });

  assert.equal(state.pushEnabled, true);
  assert.equal(state.vapidPublicKey, keys.publicKey);
  assert.equal(state.vapidKeyRing.current.publicKey, keys.publicKey);
  assert.equal(configuredPairs.length, 2);
});
