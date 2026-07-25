import assert from "node:assert/strict";
import test from "node:test";
import {
  loadVapidKeyRing,
  sendNotificationWithVapidKeyRing,
  vapidKeyId,
} from "./web-push-keyring.js";

const activePair = Object.freeze({
  publicKey: "active-public-key",
  privateKey: "active-private-key",
});
const previousPair = Object.freeze({
  publicKey: "previous-public-key",
  privateKey: "previous-private-key",
});

test("construit un identifiant VAPID stable sans exposer la clé privée", () => {
  const first = vapidKeyId(activePair.publicKey);
  assert.equal(first, vapidKeyId(activePair.publicKey));
  assert.match(first, /^vapid-[A-Za-z0-9_-]{22}$/u);
  assert.doesNotMatch(first, /private/u);
});

test("charge la paire active et les paires précédentes depuis des secrets versionnés", () => {
  const ring = loadVapidKeyRing({
    VAPID_PUBLIC_KEY: activePair.publicKey,
    VAPID_PRIVATE_KEY: activePair.privateKey,
    VAPID_PREVIOUS_KEYS: JSON.stringify([previousPair, activePair]),
    VAPID_SUBJECT: "mailto:security@example.test",
  });

  assert.equal(ring.current.id, vapidKeyId(activePair.publicKey));
  assert.equal(ring.all.length, 2);
  assert.equal(ring.byId.get(vapidKeyId(previousPair.publicKey)).privateKey, previousPair.privateKey);
  assert.equal(ring.current.subject, "mailto:security@example.test");
});

test("refuse une configuration précédente incomplète ou mal formée", () => {
  assert.throws(
    () => loadVapidKeyRing({
      VAPID_PUBLIC_KEY: activePair.publicKey,
      VAPID_PRIVATE_KEY: activePair.privateKey,
      VAPID_PREVIOUS_KEYS: "{",
    }),
    /tableau JSON valide/u,
  );
  assert.throws(
    () => loadVapidKeyRing({
      VAPID_PUBLIC_KEY: activePair.publicKey,
      VAPID_PRIVATE_KEY: activePair.privateKey,
      VAPID_PREVIOUS_KEYS: JSON.stringify([{ publicKey: "missing-private" }]),
    }),
    /publicKey et privateKey/u,
  );
});

test("réessaie avec l’ancienne paire uniquement après un refus d’authentification VAPID", async () => {
  const ring = loadVapidKeyRing({
    VAPID_PUBLIC_KEY: activePair.publicKey,
    VAPID_PRIVATE_KEY: activePair.privateKey,
    VAPID_PREVIOUS_KEYS: JSON.stringify([previousPair]),
  });
  const attempts = [];
  const client = {
    async sendNotification(_subscription, _payload, options) {
      attempts.push(options.vapidDetails.publicKey);
      if (options.vapidDetails.publicKey === activePair.publicKey) {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
      }
    },
  };

  const usedKeyId = await sendNotificationWithVapidKeyRing(client, ring, {
    subscription: { endpoint: "https://push.example.test/opaque" },
    payload: "{}",
  });

  assert.deepEqual(attempts, [activePair.publicKey, previousPair.publicKey]);
  assert.equal(usedKeyId, vapidKeyId(previousPair.publicKey));
});

test("ne masque pas une souscription expirée en essayant toutes les clés", async () => {
  const ring = loadVapidKeyRing({
    VAPID_PUBLIC_KEY: activePair.publicKey,
    VAPID_PRIVATE_KEY: activePair.privateKey,
    VAPID_PREVIOUS_KEYS: JSON.stringify([previousPair]),
  });
  let attempts = 0;
  const client = {
    async sendNotification() {
      attempts += 1;
      throw Object.assign(new Error("Gone"), { statusCode: 410 });
    },
  };

  await assert.rejects(
    sendNotificationWithVapidKeyRing(client, ring, {
      subscription: { endpoint: "https://push.example.test/expired" },
      payload: "{}",
    }),
    (error) => error.statusCode === 410,
  );
  assert.equal(attempts, 1);
});
