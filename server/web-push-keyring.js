import crypto from "node:crypto";

const defaultVapidSubject = "mailto:contact@secret-clubhouse.fr";

export function vapidKeyId(publicKey) {
  const normalized = String(publicKey ?? "").trim();
  if (!normalized) throw new Error("Une clé publique VAPID est requise.");
  return `vapid-${crypto.createHash("sha256").update(normalized).digest("base64url").slice(0, 22)}`;
}

function normalizePair(pair, subject, label) {
  const publicKey = String(pair?.publicKey ?? "").trim();
  const privateKey = String(pair?.privateKey ?? "").trim();
  if (!publicKey || !privateKey) {
    throw new Error(`${label} doit contenir publicKey et privateKey.`);
  }
  return Object.freeze({
    id: vapidKeyId(publicKey),
    publicKey,
    privateKey,
    subject: String(pair?.subject ?? subject).trim() || defaultVapidSubject,
  });
}

function parsePreviousPairs(rawValue) {
  const raw = String(rawValue ?? "").trim();
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("VAPID_PREVIOUS_KEYS doit être un tableau JSON valide.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("VAPID_PREVIOUS_KEYS doit être un tableau JSON.");
  }
  return parsed;
}

export function loadVapidKeyRing(env = process.env, currentOverride = null) {
  const subject = String(env.VAPID_SUBJECT ?? "").trim() || defaultVapidSubject;
  const publicKey = String(currentOverride?.publicKey ?? env.VAPID_PUBLIC_KEY ?? "").trim();
  const privateKey = String(currentOverride?.privateKey ?? env.VAPID_PRIVATE_KEY ?? "").trim();
  if (Boolean(publicKey) !== Boolean(privateKey)) {
    throw new Error("VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY doivent être configurées ensemble.");
  }
  if (!publicKey) return Object.freeze({ current: null, all: Object.freeze([]), byId: new Map() });

  const current = normalizePair({ publicKey, privateKey }, subject, "La paire VAPID active");
  const all = [current];
  const seen = new Set([current.id]);
  for (const [index, rawPair] of parsePreviousPairs(env.VAPID_PREVIOUS_KEYS).entries()) {
    const pair = normalizePair(rawPair, subject, `VAPID_PREVIOUS_KEYS[${index}]`);
    if (seen.has(pair.id)) continue;
    seen.add(pair.id);
    all.push(pair);
  }
  return Object.freeze({
    current,
    all: Object.freeze(all),
    byId: new Map(all.map((pair) => [pair.id, pair])),
  });
}

export function isVapidAuthenticationError(error) {
  return error?.statusCode === 401 || error?.statusCode === 403;
}

export async function sendNotificationWithVapidKeyRing(
  webPushClient,
  keyRing,
  {
    subscription,
    payload,
    preferredKeyId = "",
    options = {},
  },
) {
  if (!keyRing?.current || !keyRing.all?.length) {
    throw new Error("Aucune paire VAPID active.");
  }
  const preferred = keyRing.byId.get(String(preferredKeyId ?? ""));
  const candidates = preferred
    ? [preferred, ...keyRing.all.filter((pair) => pair.id !== preferred.id)]
    : [...keyRing.all];
  let lastError;

  for (const [index, pair] of candidates.entries()) {
    try {
      await webPushClient.sendNotification(subscription, payload, {
        ...options,
        vapidDetails: {
          subject: pair.subject,
          publicKey: pair.publicKey,
          privateKey: pair.privateKey,
        },
      });
      return pair.id;
    } catch (error) {
      lastError = error;
      if (!isVapidAuthenticationError(error) || index === candidates.length - 1) throw error;
    }
  }
  throw lastError;
}
