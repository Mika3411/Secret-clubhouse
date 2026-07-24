import test from "node:test";
import assert from "node:assert/strict";
import { getChannelPolicy } from "../src/webrtc.js";

const travellingSchedule = {
  enabled: true,
  timeZone: "Europe/Paris",
  messages: { enabled: true, start: "12:00", end: "12:30" },
};

test("le client évalue le planning dans le fuseau transmis par le serveur", () => {
  const now = new Date("2026-07-23T10:15:00.000Z");
  const result = getChannelPolicy(travellingSchedule, "messages", now);

  assert.equal(result.allowed, true);
  assert.match(result.detail, /heure de Paris/);
});

test("un ancien planning sans fuseau utilise le même défaut Europe/Paris que l’API", () => {
  const now = new Date("2026-07-23T10:15:00.000Z");
  const result = getChannelPolicy(
    { ...travellingSchedule, timeZone: undefined },
    "messages",
    now,
  );

  assert.equal(result.allowed, true);
  assert.match(result.detail, /heure de Paris/);
});

test("un fuseau invalide ne peut pas annoncer à tort que le canal est disponible", () => {
  const result = getChannelPolicy(
    { ...travellingSchedule, timeZone: "Fuseau/Invalide" },
    "messages",
    new Date("2026-07-23T10:15:00.000Z"),
  );

  assert.equal(result.allowed, false);
  assert.match(result.detail, /parent/);
});
