let audioContext = null;
let unlockInstalled = false;
let unlockSucceeded = false;

const getAudioContext = (browserWindow) => {
  if (audioContext) return audioContext;
  const AudioContextConstructor = browserWindow?.AudioContext ?? browserWindow?.webkitAudioContext;
  if (!AudioContextConstructor) return null;
  audioContext = new AudioContextConstructor();
  return audioContext;
};

const playUnlockTone = (context) => {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  gain.gain.value = 0;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.01);
};

export function armIncomingCallAudio(browserWindow = globalThis.window) {
  if (!browserWindow || unlockInstalled) return () => undefined;
  unlockInstalled = true;

  const unlock = async () => {
    const context = getAudioContext(browserWindow);
    if (!context) return;
    try {
      if (context.state === "suspended") await context.resume();
      playUnlockTone(context);
      unlockSucceeded = context.state === "running";
      if (unlockSucceeded) {
        browserWindow.removeEventListener("pointerdown", unlock, true);
        browserWindow.removeEventListener("keydown", unlock, true);
      }
    } catch {
      // Le prochain geste dans l’application retentera le déverrouillage audio.
    }
  };

  browserWindow.addEventListener("pointerdown", unlock, true);
  browserWindow.addEventListener("keydown", unlock, true);
  return () => {
    browserWindow.removeEventListener("pointerdown", unlock, true);
    browserWindow.removeEventListener("keydown", unlock, true);
    unlockInstalled = false;
  };
}

const scheduleTone = (context, frequency, startsAt, duration = 0.22) => {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startsAt);
  gain.gain.setValueAtTime(0.0001, startsAt);
  gain.gain.exponentialRampToValueAtTime(0.13, startsAt + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startsAt);
  oscillator.stop(startsAt + duration + 0.02);
};

const playRingtonePhrase = async (browserWindow) => {
  const context = getAudioContext(browserWindow);
  if (!context) return false;
  try {
    if (context.state === "suspended") await context.resume();
    if (context.state !== "running") return false;
    const now = context.currentTime + 0.02;
    scheduleTone(context, 587.33, now);
    scheduleTone(context, 783.99, now + 0.24);
    scheduleTone(context, 659.25, now + 0.62);
    scheduleTone(context, 880, now + 0.86, 0.3);
    return true;
  } catch {
    return false;
  }
};

async function showIncomingCallNotification({
  callId,
  conversationId,
  expiresAt,
  browserWindow,
  browserNavigator,
}) {
  if (browserWindow?.Notification?.permission !== "granted" || !browserNavigator?.serviceWorker) return;
  const registration = await browserNavigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  const tag = `call-${callId}`;
  const existingNotifications = await registration.getNotifications?.({ tag }) ?? [];
  if (existingNotifications.length) return;
  await registration.showNotification("Appel Secret Clubhouse", {
    body: "Un contact autorisé vous appelle.",
    tag,
    renotify: false,
    requireInteraction: true,
    silent: false,
    timestamp: Date.now(),
    actions: [{ action: "open", title: "Ouvrir" }],
    data: {
      callId,
      conversationId,
      notificationType: "incoming-call",
      expiresAt,
      url: `/?notification=call&call=${encodeURIComponent(callId)}`,
    },
  });
}

async function closeIncomingCallNotification(callId, browserNavigator) {
  const registration = await browserNavigator?.serviceWorker?.getRegistration?.();
  if (!registration?.getNotifications) return;
  const notifications = await registration.getNotifications({ tag: `call-${callId}` });
  notifications.forEach((notification) => notification.close());
}

export function beginIncomingCallAlert({
  callId,
  conversationId,
  expiresAt,
  showNotification = false,
  browserWindow = globalThis.window,
  browserNavigator = globalThis.navigator,
}) {
  if (!callId || !browserWindow) return () => undefined;
  let stopped = false;
  let ringTimer = null;

  const ring = async () => {
    if (stopped) return;
    await playRingtonePhrase(browserWindow);
  };

  void ring();
  ringTimer = browserWindow.setInterval(ring, 2800);
  if (showNotification) {
    void showIncomingCallNotification({
      callId,
      conversationId,
      expiresAt,
      browserWindow,
      browserNavigator,
    }).catch(() => undefined);
  }

  return () => {
    stopped = true;
    if (ringTimer !== null) browserWindow.clearInterval(ringTimer);
    void closeIncomingCallNotification(callId, browserNavigator).catch(() => undefined);
  };
}

export function incomingCallAudioWasUnlocked() {
  return unlockSucceeded;
}
