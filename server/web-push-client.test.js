import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationServerKeysMatch,
  decodeApplicationServerKey,
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
