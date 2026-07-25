import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationServerKeysMatch,
  decodeApplicationServerKey,
  synchronizeWebPushSubscription,
} from "../src/web-push-client.js";

test("la clé VAPID publique est décodée au format attendu par PushManager", () => {
  const bytes = Uint8Array.from([4, 12, 82, 255, 0, 17]);
  const encoded = Buffer.from(bytes)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

  assert.deepEqual(decodeApplicationServerKey(encoded), bytes);
});

test("un abonnement Web Push lié à une ancienne clé VAPID est détecté", () => {
  const expected = Uint8Array.from([4, 1, 2, 3]);
  assert.equal(applicationServerKeysMatch(expected.buffer, expected), true);
  assert.equal(applicationServerKeysMatch(Uint8Array.from([4, 1, 2, 9]).buffer, expected), false);
  assert.equal(applicationServerKeysMatch(null, expected), true);
});

test("la synchronisation associe la souscription à la version VAPID servie", async () => {
  const keyBytes = Uint8Array.from([4, 1, 2, 3]);
  const publicKey = Buffer.from(keyBytes).toString("base64url");
  const calls = [];
  const subscription = {
    options: { applicationServerKey: keyBytes.buffer },
    toJSON: () => ({ endpoint: "https://push.example.test/opaque", keys: { p256dh: "a", auth: "b" } }),
  };
  const api = {
    notificationConsent: async () => ({ consent: { active: true } }),
    pushPublicKey: async () => ({ publicKey, keyId: "vapid-version-test" }),
    subscribePush: async (...args) => calls.push(args),
  };
  const browserWindow = {
    isSecureContext: true,
    Notification: { permission: "granted" },
    dispatchEvent() {},
    CustomEvent: class {
      constructor(type, init) {
        this.type = type;
        this.detail = init.detail;
      }
    },
  };
  const browserNavigator = {
    serviceWorker: {
      register: async () => ({
        update: async () => undefined,
        pushManager: {
          getSubscription: async () => subscription,
          subscribe: async () => subscription,
        },
      }),
    },
  };

  const result = await synchronizeWebPushSubscription(api, browserWindow, browserNavigator);

  assert.equal(result.enabled, true);
  assert.deepEqual(calls, [[subscription.toJSON(), "vapid-version-test"]]);
});
