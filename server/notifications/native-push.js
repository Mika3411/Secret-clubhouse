import crypto from "node:crypto";
import http2 from "node:http2";
import jwt from "jsonwebtoken";
import { privacySafeNotificationPayload } from "./notification-privacy.js";

const googleTokenEndpoint = "https://oauth2.googleapis.com/token";
const googleMessagingScope = "https://www.googleapis.com/auth/firebase.messaging";
const apnsHosts = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
};

export const nativeTokenKinds = new Set(["fcm", "apns_alert", "apns_voip"]);
export const nativePlatforms = new Set(["android", "ios"]);
export const apnsEnvironments = new Set(["production", "sandbox"]);

const notificationProfiles = {
  message: {
    androidChannelId: "clubhouse_messages_v1",
    androidSound: "message_discreet",
    iosCategory: "CLUBHOUSE_MESSAGE",
    iosSound: "message_discreet.caf",
    ttlSeconds: 3600,
  },
  "contact-request": {
    androidChannelId: "clubhouse_contact_requests_v1",
    androidSound: "contact_gentle",
    iosCategory: "CLUBHOUSE_CONTACT_REQUEST",
    iosSound: "contact_gentle.caf",
    ttlSeconds: 3600,
  },
  game: {
    androidChannelId: "clubhouse_messages_v1",
    androidSound: "message_discreet",
    iosCategory: "CLUBHOUSE_MESSAGE",
    iosSound: "message_discreet.caf",
    ttlSeconds: 3600,
  },
  "incoming-call": {
    androidChannelId: "clubhouse_calls_v1",
    androidSound: "incoming_call_soft",
    iosCategory: "CLUBHOUSE_INCOMING_CALL",
    ttlSeconds: 45,
  },
  "call-state": {
    androidChannelId: "clubhouse_calls_v1",
    ttlSeconds: 60,
  },
};

const allowedPayloadKeys = new Set([
  "title",
  "body",
  "notificationType",
  "conversationId",
  "callId",
  "callType",
  "callerName",
  "status",
  "tag",
  "url",
  "expiresAt",
  "callActionToken",
  "callActionUrl",
  "respondUrl",
  "acceptUrl",
  "declineUrl",
  "hangupUrl",
  "statusUrl",
]);

function decodeSecret(rawValue, base64Value, label) {
  const raw = typeof rawValue === "string" && rawValue.trim()
    ? rawValue.trim()
    : typeof base64Value === "string" && base64Value.trim()
      ? Buffer.from(base64Value.trim(), "base64").toString("utf8").trim()
      : "";
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${label} n’est pas un JSON valide.`);
  }
}

function decodePrivateKey(rawValue, base64Value) {
  const raw = typeof rawValue === "string" && rawValue.trim()
    ? rawValue.trim()
    : typeof base64Value === "string" && base64Value.trim()
      ? Buffer.from(base64Value.trim(), "base64").toString("utf8").trim()
      : "";
  return raw ? raw.replace(/\\n/g, "\n") : "";
}

export function loadNativePushConfiguration(env = process.env) {
  const issues = [];
  let fcm = null;
  let apns = null;

  try {
    const serviceAccount = decodeSecret(
      env.FCM_SERVICE_ACCOUNT_JSON,
      env.FCM_SERVICE_ACCOUNT_JSON_BASE64,
      "FCM_SERVICE_ACCOUNT_JSON",
    );
    if (serviceAccount) {
      const projectId = String(serviceAccount.project_id ?? "").trim();
      const clientEmail = String(serviceAccount.client_email ?? "").trim();
      const privateKey = String(serviceAccount.private_key ?? "").replace(/\\n/g, "\n").trim();
      if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Le compte de service FCM doit contenir project_id, client_email et private_key.");
      }
      fcm = {
        projectId,
        clientEmail,
        privateKey,
        packageName: String(env.FCM_ANDROID_PACKAGE || env.APNS_BUNDLE_ID || "fr.secretclubhouse.app").trim(),
      };
    }
  } catch (error) {
    issues.push(error.message);
  }

  try {
    const teamId = String(env.APNS_TEAM_ID ?? "").trim();
    const keyId = String(env.APNS_KEY_ID ?? "").trim();
    const privateKey = decodePrivateKey(env.APNS_PRIVATE_KEY, env.APNS_PRIVATE_KEY_BASE64);
    const bundleId = String(env.APNS_BUNDLE_ID ?? "").trim();
    const voipTopic = String(env.APNS_VOIP_TOPIC || (bundleId ? `${bundleId}.voip` : "")).trim();
    if (teamId || keyId || privateKey || bundleId) {
      if (!teamId || !keyId || !privateKey || !bundleId) {
        throw new Error("APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY et APNS_BUNDLE_ID doivent être configurés ensemble.");
      }
      apns = { teamId, keyId, privateKey, bundleId, voipTopic };
    }
  } catch (error) {
    issues.push(error.message);
  }

  return { fcm, apns, issues };
}

export function normalizeNativeTokenRegistration(input, env = process.env) {
  const token = String(input?.token ?? "").trim();
  const platform = String(input?.platform ?? "").trim();
  const tokenKind = String(input?.tokenKind ?? "").trim();
  const deviceId = String(input?.deviceId ?? "").trim();
  const configuredBundleId = String(env.APNS_BUNDLE_ID ?? "").trim();
  const defaultApnsEnvironment = apnsEnvironments.has(env.APNS_ENVIRONMENT)
    ? env.APNS_ENVIRONMENT
    : env.NODE_ENV === "production" ? "production" : "sandbox";
  const environment = tokenKind.startsWith("apns_")
    ? String(input?.environment || defaultApnsEnvironment).trim()
    : null;
  let topic = tokenKind.startsWith("apns_") ? String(input?.topic ?? "").trim() : null;

  if (!nativePlatforms.has(platform)) throw new Error("Plateforme mobile invalide.");
  if (!nativeTokenKinds.has(tokenKind)) throw new Error("Type de jeton mobile invalide.");
  if ((platform === "android") !== (tokenKind === "fcm")) throw new Error("Le type de jeton ne correspond pas à la plateforme.");
  if (token.length < 20 || token.length > 4096 || /\s/.test(token)) throw new Error("Jeton mobile invalide.");
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(deviceId)) throw new Error("Identifiant d’installation invalide.");

  if (platform === "ios") {
    if (!apnsEnvironments.has(environment)) throw new Error("Environnement APNs invalide.");
    if (!topic && configuredBundleId) topic = tokenKind === "apns_voip" ? `${configuredBundleId}.voip` : configuredBundleId;
    if (!/^[A-Za-z0-9.-]{3,255}$/.test(topic)) throw new Error("Sujet APNs invalide.");
    if (configuredBundleId) {
      const expectedTopic = tokenKind === "apns_voip" ? `${configuredBundleId}.voip` : configuredBundleId;
      if (topic !== expectedTopic) throw new Error("Le sujet APNs ne correspond pas à l’application.");
    }
    if (tokenKind === "apns_voip" && !topic.endsWith(".voip")) throw new Error("Le sujet PushKit doit se terminer par .voip.");
    if (tokenKind === "apns_alert" && topic.endsWith(".voip")) throw new Error("Le jeton d’alerte APNs ne peut pas utiliser le sujet VoIP.");
  }

  return { token, platform, tokenKind, deviceId, environment, topic };
}

export function createOpaqueCallActionToken(randomBytes = crypto.randomBytes) {
  return `nca_${randomBytes(32).toString("base64url")}`;
}

export function hashCallActionToken(token) {
  return crypto.createHash("sha256").update(String(token), "utf8").digest("hex");
}

function notificationProfile(payload) {
  return notificationProfiles[payload.notificationType] ?? notificationProfiles.message;
}

function notificationTtlSeconds(payload, now = Date.now()) {
  const profile = notificationProfile(payload);
  if (payload.notificationType !== "incoming-call" || !payload.expiresAt) return profile.ttlSeconds;
  const remaining = Math.ceil((new Date(payload.expiresAt).getTime() - now) / 1000);
  return Math.max(1, Math.min(120, Number.isFinite(remaining) ? remaining : profile.ttlSeconds));
}

export function sanitizeNativePayload(payload) {
  const sanitized = {};
  for (const [key, value] of Object.entries(payload ?? {})) {
    if (!allowedPayloadKeys.has(key) || value === undefined || value === null) continue;
    if (!["string", "number", "boolean"].includes(typeof value)) continue;
    const stringValue = String(value);
    if (stringValue.length <= 4096) sanitized[key] = stringValue;
  }
  return sanitized;
}

export function tokenKindAcceptsPayload(tokenKind, payload) {
  if (payload.notificationType === "incoming-call") return tokenKind === "fcm" || tokenKind === "apns_voip";
  if (payload.notificationType === "call-state") return tokenKind === "fcm" || tokenKind === "apns_alert";
  return tokenKind === "fcm" || tokenKind === "apns_alert";
}

export function buildFcmMessage(tokenRow, payload, now = Date.now()) {
  const safePayload = privacySafeNotificationPayload(payload);
  const data = sanitizeNativePayload(safePayload);
  const profile = notificationProfile(safePayload);
  data.channelId = profile.androidChannelId;
  if (profile.androidSound) data.sound = profile.androidSound;
  const ttlSeconds = notificationTtlSeconds(safePayload, now);
  const callId = data.callId || "";
  return {
    message: {
      token: tokenRow.token,
      data,
      android: {
        priority: "HIGH",
        ttl: `${ttlSeconds}s`,
        ...(callId ? { collapse_key: `call-${callId}` } : {}),
        ...(tokenRow.package_name ? { restricted_package_name: tokenRow.package_name } : {}),
      },
    },
  };
}

export function buildApnsRequest(tokenRow, payload, config, providerToken, now = Date.now()) {
  const safePayload = privacySafeNotificationPayload(payload);
  const data = sanitizeNativePayload(safePayload);
  const profile = notificationProfile(safePayload);
  const incomingCall = safePayload.notificationType === "incoming-call";
  const callState = safePayload.notificationType === "call-state";
  const pushType = incomingCall ? "voip" : callState ? "background" : "alert";
  const topic = (incomingCall ? config.voipTopic : config.bundleId) || tokenRow.topic;
  const ttlSeconds = notificationTtlSeconds(safePayload, now);
  const aps = callState || incomingCall
    ? { "content-available": 1 }
    : {
        alert: {
          title: data.title || "Secret Clubhouse",
          body: data.body || "Vous avez une nouvelle notification.",
        },
        category: profile.iosCategory,
        sound: profile.iosSound || "default",
        ...(data.conversationId ? { "thread-id": data.conversationId } : {}),
      };
  const body = JSON.stringify({ aps, ...data });
  if (Buffer.byteLength(body) > 4000) throw new Error("La charge utile APNs dépasse 4 Ko.");
  const expiration = incomingCall ? 0 : Math.floor(now / 1000) + ttlSeconds;
  return {
    host: apnsHosts[tokenRow.environment] || apnsHosts.production,
    headers: {
      ":method": "POST",
      ":path": `/3/device/${encodeURIComponent(tokenRow.token)}`,
      authorization: `bearer ${providerToken}`,
      "apns-topic": topic,
      "apns-push-type": pushType,
      "apns-priority": pushType === "background" ? "5" : "10",
      "apns-expiration": String(expiration),
      ...(data.callId ? { "apns-collapse-id": `call-${data.callId}` } : {}),
      "content-type": "application/json",
    },
    body,
  };
}

export function fcmErrorInvalidatesToken(statusCode, responseBody) {
  const fcmCode = responseBody?.error?.details
    ?.find((detail) => detail?.["@type"]?.includes("google.firebase.fcm.v1.FcmError"))
    ?.errorCode;
  return ["UNREGISTERED", "SENDER_ID_MISMATCH", "INVALID_ARGUMENT"].includes(fcmCode)
    && [400, 403, 404].includes(statusCode);
}

export function apnsErrorInvalidatesToken(statusCode, reason) {
  return statusCode === 410 || ["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"].includes(reason);
}

class NativePushDeliveryError extends Error {
  constructor(message, { code = "", invalidToken = false, statusCode = 0 } = {}) {
    super(message);
    this.name = "NativePushDeliveryError";
    this.code = code;
    this.invalidToken = invalidToken;
    this.statusCode = statusCode;
  }
}

function sendHttp2Request(connect, request, timeoutMs) {
  return new Promise((resolve, reject) => {
    let client;
    let stream;
    let timeout;
    try {
      client = connect(request.host);
    } catch (error) {
      reject(error);
      return;
    }
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      client.close();
      callback(value);
    };
    client.once("error", (error) => finish(reject, error));
    timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const error = new NativePushDeliveryError("Délai APNs dépassé.", { code: "APNS_TIMEOUT" });
      stream?.close(http2.constants.NGHTTP2_CANCEL);
      client.destroy();
      reject(error);
    }, timeoutMs);
    timeout.unref?.();
    stream = client.request(request.headers);
    const chunks = [];
    let responseHeaders = {};
    stream.on("response", (headers) => { responseHeaders = headers; });
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", (error) => finish(reject, error));
    stream.on("end", () => finish(resolve, {
      statusCode: Number(responseHeaders[":status"] || 0),
      headers: responseHeaders,
      body: Buffer.concat(chunks).toString("utf8"),
    }));
    stream.end(request.body);
  });
}

export function createNativePushService({
  pool,
  env = process.env,
  fetchImpl = globalThis.fetch,
  http2Connect = http2.connect,
  logger = console,
  now = () => Date.now(),
  requestTimeoutMs = Math.max(2_000, Math.min(15_000, Number(env.NATIVE_PUSH_TIMEOUT_MS) || 6_000)),
} = {}) {
  if (!pool?.query) throw new Error("Un pool PostgreSQL est requis pour les notifications natives.");
  const configuration = loadNativePushConfiguration(env);
  let googleAccessToken = null;
  let apnsProviderToken = null;

  for (const issue of configuration.issues) logger.warn(`Notifications natives partiellement désactivées : ${issue}`);

  async function timedFetch(url, options, timeoutLimitMs = requestTimeoutMs) {
    const controller = new AbortController();
    let timeout;
    const timeoutPromise = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new NativePushDeliveryError("Délai fournisseur dépassé.", { code: "PROVIDER_TIMEOUT" }));
      }, Math.max(1, timeoutLimitMs));
      timeout.unref?.();
    });
    try {
      return await Promise.race([
        fetchImpl(url, { ...options, signal: controller.signal }),
        timeoutPromise,
      ]);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getGoogleAccessToken(forceRefresh = false, deadline = now() + requestTimeoutMs) {
    if (!configuration.fcm) throw new Error("FCM n’est pas configuré.");
    if (!forceRefresh && googleAccessToken?.expiresAt > now() + 60_000) return googleAccessToken.value;
    const assertion = jwt.sign(
      { scope: googleMessagingScope },
      configuration.fcm.privateKey,
      {
        algorithm: "RS256",
        issuer: configuration.fcm.clientEmail,
        audience: googleTokenEndpoint,
        expiresIn: "1h",
      },
    );
    const response = await timedFetch(googleTokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    }, deadline - now());
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.access_token) {
      throw new NativePushDeliveryError("Authentification FCM impossible.", {
        code: body.error || `HTTP_${response.status}`,
        statusCode: response.status,
      });
    }
    googleAccessToken = {
      value: body.access_token,
      expiresAt: now() + Math.max(60, Number(body.expires_in) || 3600) * 1000,
    };
    return googleAccessToken.value;
  }

  function getApnsProviderToken(forceRefresh = false) {
    if (!configuration.apns) throw new Error("APNs n’est pas configuré.");
    if (!forceRefresh && apnsProviderToken?.expiresAt > now() + 60_000) return apnsProviderToken.value;
    apnsProviderToken = {
      value: jwt.sign({}, configuration.apns.privateKey, {
        algorithm: "ES256",
        issuer: configuration.apns.teamId,
        keyid: configuration.apns.keyId,
      }),
      expiresAt: now() + 45 * 60 * 1000,
    };
    return apnsProviderToken.value;
  }

  async function sendFcm(tokenRow, payload, retry = true, deadline = now() + requestTimeoutMs) {
    if (deadline <= now()) throw new NativePushDeliveryError("Délai FCM dépassé.", { code: "PROVIDER_TIMEOUT" });
    const accessToken = await getGoogleAccessToken(false, deadline);
    const response = await timedFetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(configuration.fcm.projectId)}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildFcmMessage(
          { ...tokenRow, package_name: configuration.fcm.packageName },
          payload,
          now(),
        )),
      },
      deadline - now(),
    );
    const body = await response.json().catch(() => ({}));
    if (response.ok) return body;
    if (response.status === 401 && retry) {
      googleAccessToken = null;
      return sendFcm(tokenRow, payload, false, deadline);
    }
    const code = body?.error?.status || `HTTP_${response.status}`;
    throw new NativePushDeliveryError("Livraison FCM refusée.", {
      code,
      statusCode: response.status,
      invalidToken: fcmErrorInvalidatesToken(response.status, body),
    });
  }

  async function sendApns(tokenRow, payload, retry = true) {
    const request = buildApnsRequest(tokenRow, payload, configuration.apns, getApnsProviderToken(), now());
    const response = await sendHttp2Request(http2Connect, request, requestTimeoutMs);
    if (response.statusCode === 200) return response;
    let body = {};
    try { body = JSON.parse(response.body || "{}"); } catch {}
    if (response.statusCode === 403 && body.reason === "ExpiredProviderToken" && retry) {
      apnsProviderToken = null;
      return sendApns(tokenRow, payload, false);
    }
    throw new NativePushDeliveryError("Livraison APNs refusée.", {
      code: body.reason || `HTTP_${response.statusCode}`,
      statusCode: response.statusCode,
      invalidToken: apnsErrorInvalidatesToken(response.statusCode, body.reason),
    });
  }

  async function recordSuccess(tokenId) {
    await pool.query(
      `update native_push_tokens
       set last_success_at=now(),last_failure_at=null,last_error_code=null,updated_at=now()
       where id=$1`,
      [tokenId],
    );
  }

  async function recordFailure(tokenRow, error) {
    if (error.invalidToken) {
      await pool.query("delete from native_push_tokens where id=$1", [tokenRow.id]);
      return;
    }
    await pool.query(
      `update native_push_tokens
       set last_failure_at=now(),last_error_code=$2,updated_at=now()
       where id=$1`,
      [tokenRow.id, String(error.code || error.message || "DELIVERY_ERROR").slice(0, 120)],
    );
  }

  async function deliverToken(tokenRow, payload) {
    if (!tokenRow.enabled || !tokenKindAcceptsPayload(tokenRow.token_kind, payload)) return false;
    if (tokenRow.token_kind === "fcm" && !configuration.fcm) return false;
    if (tokenRow.token_kind.startsWith("apns_") && !configuration.apns) return false;
    try {
      if (tokenRow.token_kind === "fcm") await sendFcm(tokenRow, payload, true, now() + requestTimeoutMs);
      else await sendApns(tokenRow, payload);
      await recordSuccess(tokenRow.id);
      return true;
    } catch (error) {
      await recordFailure(tokenRow, error);
      logger.error(`Échec push natif ${tokenRow.token_kind} (${tokenRow.id}) : ${error.code || error.message}`);
      return false;
    }
  }

  async function deliverRows(rows, payload) {
    const results = await Promise.all(rows.map((row) => deliverToken(row, payload)));
    return results.filter(Boolean).length;
  }

  async function deliverToAccounts(accountIds, payload) {
    const uniqueIds = [...new Set((accountIds ?? []).filter(Boolean))];
    if (!uniqueIds.length) return 0;
    const result = await pool.query(
      `select token.id,token.token,token.token_kind,token.environment,token.topic,token.enabled
       from native_push_tokens token
       join accounts account on account.id=token.account_id
       join account_consent_preferences consent
         on consent.subject_account_id=account.id and consent.purpose='notifications'
       where token.enabled=true and token.expires_at>now() and token.account_id=any($1::uuid[])
         and consent.subject_agreed_at is not null
         and (account.role<>'child' or account.age>=15 or consent.guardian_agreed_at is not null)`,
      [uniqueIds],
    );
    return deliverRows(result.rows, payload);
  }

  async function deliverToConversation(conversationId, senderId, payload) {
    const result = await pool.query(
      `select token.id,token.token,token.token_kind,token.environment,token.topic,token.enabled
       from native_push_tokens token
       join conversation_members member on member.account_id=token.account_id
       join accounts account on account.id=token.account_id
       join account_consent_preferences consent
         on consent.subject_account_id=account.id and consent.purpose='notifications'
       where token.enabled=true and token.expires_at>now()
         and member.conversation_id=$1 and member.account_id<>$2
         and consent.subject_agreed_at is not null
         and (account.role<>'child' or account.age>=15 or consent.guardian_agreed_at is not null)`,
      [conversationId, senderId],
    );
    return deliverRows(result.rows, payload);
  }

  return {
    capabilities: {
      fcm: Boolean(configuration.fcm),
      apns: Boolean(configuration.apns),
      issues: [...configuration.issues],
    },
    deliverRows,
    deliverToAccounts,
    deliverToConversation,
  };
}
