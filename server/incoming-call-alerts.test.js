import test from "node:test";
import assert from "node:assert/strict";
import {
  armIncomingCallAudio,
  beginIncomingCallAlert,
  incomingCallAudioWasUnlocked,
} from "../src/incoming-call-alerts.js";

test("un appel web sonne, affiche une notification autorisée puis arrête les deux alertes", async () => {
  let oscillatorCount = 0;
  let intervalCallback = null;
  let intervalCleared = false;
  let notificationClosed = false;
  let shownNotification = null;
  const listeners = new Map();
  const fakeAudioContext = {
    state: "running",
    currentTime: 1,
    destination: {},
    async resume() {},
    createOscillator() {
      oscillatorCount += 1;
      return {
        type: "sine",
        frequency: { setValueAtTime() {} },
        connect() {},
        start() {},
        stop() {},
      };
    },
    createGain() {
      return {
        gain: {
          value: 0,
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      };
    },
  };
  const registration = {
    async getNotifications() {
      return shownNotification ? [{ close() { notificationClosed = true; } }] : [];
    },
    async showNotification(title, options) {
      shownNotification = { title, options };
    },
  };
  const fakeWindow = {
    AudioContext: class {
      constructor() {
        return fakeAudioContext;
      }
    },
    Notification: { permission: "granted" },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    setInterval(callback) {
      intervalCallback = callback;
      return 7;
    },
    clearInterval(timerId) {
      intervalCleared = timerId === 7;
    },
  };
  const fakeNavigator = {
    serviceWorker: {
      async register() {
        return registration;
      },
      async getRegistration() {
        return registration;
      },
    },
  };

  const disarm = armIncomingCallAudio(fakeWindow);
  await listeners.get("pointerdown")();
  assert.equal(incomingCallAudioWasUnlocked(), true);
  const unlockOscillators = oscillatorCount;

  const stop = beginIncomingCallAlert({
    callId: "22222222-2222-4222-8222-222222222222",
    conversationId: "11111111-1111-4111-8111-111111111111",
    expiresAt: "2026-07-24T23:59:00.000Z",
    showNotification: true,
    browserWindow: fakeWindow,
    browserNavigator: fakeNavigator,
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(oscillatorCount, unlockOscillators + 4);
  assert.equal(shownNotification.title, "Appel Secret Clubhouse");
  assert.equal(shownNotification.options.tag, "call-22222222-2222-4222-8222-222222222222");
  assert.equal(shownNotification.options.body, "Un contact autorisé vous appelle.");

  await intervalCallback();
  assert.equal(oscillatorCount, unlockOscillators + 8);

  stop();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(intervalCleared, true);
  assert.equal(notificationClosed, true);
  disarm();
});
