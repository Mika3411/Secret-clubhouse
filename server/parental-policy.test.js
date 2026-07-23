import test from "node:test";
import assert from "node:assert/strict";
import { evaluateChildPolicy, isChannelAllowed, minutesInTimeZone } from "./parental-policy.js";

const schedule = {
  enabled: true,
  messages: { enabled: true, start: "07:30", end: "20:30" },
  calls: { enabled: true, start: "22:00", end: "06:00" },
  video: { enabled: false, start: "09:00", end: "18:30" },
};

const child = {
  status: "active",
  display_name: "Cyrielle",
  safety_settings: { media: true },
  communication_schedule: schedule,
};

test("refuse un profil enfant en pause", () => {
  const result = evaluateChildPolicy({ ...child, status: "paused" }, { channel: "messages", currentMinutes: 600 });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /pause/);
});

test("applique les horaires de messages côté serveur", () => {
  assert.equal(isChannelAllowed(schedule, "messages", { currentMinutes: 450 }), true);
  assert.equal(isChannelAllowed(schedule, "messages", { currentMinutes: 451 }), true);
  assert.equal(isChannelAllowed(schedule, "messages", { currentMinutes: 1230 }), true);
  assert.equal(isChannelAllowed(schedule, "messages", { currentMinutes: 1231 }), false);
});

test("gère une plage horaire qui traverse minuit", () => {
  assert.equal(isChannelAllowed(schedule, "calls", { currentMinutes: 1380 }), true);
  assert.equal(isChannelAllowed(schedule, "calls", { currentMinutes: 120 }), true);
  assert.equal(isChannelAllowed(schedule, "calls", { currentMinutes: 720 }), false);
});

test("refuse un canal explicitement désactivé", () => {
  assert.equal(isChannelAllowed(schedule, "video", { currentMinutes: 720 }), false);
});

test("une planification désactivée laisse les canaux actifs à toute heure", () => {
  assert.equal(isChannelAllowed({ ...schedule, enabled: false }, "messages", { currentMinutes: 120 }), true);
});

test("refuse les images et vidéos lorsque le parent coupe les médias", () => {
  const result = evaluateChildPolicy(
    { ...child, safety_settings: { media: false } },
    { channel: "messages", requiresVisualMedia: true, currentMinutes: 600 },
  );
  assert.equal(result.allowed, false);
  assert.match(result.reason, /photos et vidéos/);
});

test("les messages vocaux restent indépendants du réglage photos et vidéos", () => {
  const result = evaluateChildPolicy(
    { ...child, safety_settings: { media: false } },
    { channel: "messages", requiresVisualMedia: false, currentMinutes: 600 },
  );
  assert.equal(result.allowed, true);
});

test("calcule l’heure dans le fuseau parental configuré", () => {
  assert.equal(minutesInTimeZone(new Date("2026-07-23T10:15:00.000Z"), "Europe/Paris"), 12 * 60 + 15);
});
