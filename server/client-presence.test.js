import test from "node:test";
import assert from "node:assert/strict";
import {
  callAvailabilityPolicy,
  normalizePresenceAvailability,
} from "../src/presence.js";

test("le client affiche la veille comme joignable et non comme une déconnexion", () => {
  const availability = normalizePresenceAvailability({
    state: "background",
    connected: true,
    online: false,
    canCall: true,
  });

  assert.equal(availability.label, "En veille · joignable");
  assert.match(availability.detail, /arrière-plan|téléphone en veille/u);
  assert.deepEqual(callAvailabilityPolicy(availability), {
    allowed: true,
    reason: "En veille · joignable",
    detail: availability.detail,
  });
});

test("le client bloque un appel inconnu, indisponible ou déconnecté", () => {
  assert.equal(callAvailabilityPolicy(undefined).allowed, false);
  assert.equal(callAvailabilityPolicy({ state: "unavailable", canCall: false }).allowed, false);
  const connectedButBlocked = callAvailabilityPolicy({ state: "online", canCall: false });
  assert.equal(connectedButBlocked.allowed, false);
  assert.match(connectedButBlocked.detail, /appels ne sont pas disponibles/u);
  const offlinePolicy = callAvailabilityPolicy({
    state: "offline",
    connected: false,
    online: false,
    canCall: false,
  });
  assert.equal(offlinePolicy.allowed, false);
  assert.match(offlinePolicy.reason, /déconnectée/u);
});
