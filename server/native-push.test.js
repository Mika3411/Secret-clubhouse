import assert from "node:assert/strict";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  apnsErrorInvalidatesToken,
  buildApnsRequest,
  buildFcmMessage,
  createNativePushService,
  createOpaqueCallActionToken,
  fcmErrorInvalidatesToken,
  hashCallActionToken,
  loadNativePushConfiguration,
  normalizeNativeTokenRegistration,
  tokenKindAcceptsPayload,
} from "./native-push.js";

test("charge les secrets fournisseur au format brut ou base64 sans les exposer", () => {
  const serviceAccount = {
    project_id: "secret-clubhouse",
    client_email: "push@secret-clubhouse.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\\nTEST\\n-----END PRIVATE KEY-----",
  };
  const configuration = loadNativePushConfiguration({
    FCM_SERVICE_ACCOUNT_JSON_BASE64: Buffer.from(JSON.stringify(serviceAccount)).toString("base64"),
    APNS_TEAM_ID: "TEAMID1234",
    APNS_KEY_ID: "KEYID12345",
    APNS_PRIVATE_KEY_BASE64: Buffer.from("-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----").toString("base64"),
    APNS_BUNDLE_ID: "fr.secretclubhouse.app",
  });
  assert.equal(configuration.fcm.projectId, "secret-clubhouse");
  assert.match(configuration.fcm.privateKey, /\nTEST\n/);
  assert.equal(configuration.apns.voipTopic, "fr.secretclubhouse.app.voip");
  assert.deepEqual(configuration.issues, []);
});

test("normalise les inscriptions FCM et APNs sans autoriser un croisement de plateforme", () => {
  assert.deepEqual(
    normalizeNativeTokenRegistration({
      token: "fcm-token-value-that-is-long-enough",
      platform: "android",
      tokenKind: "fcm",
      deviceId: "device.android.123",
    }),
    {
      token: "fcm-token-value-that-is-long-enough",
      platform: "android",
      tokenKind: "fcm",
      deviceId: "device.android.123",
      environment: null,
      topic: null,
    },
  );

  assert.deepEqual(
    normalizeNativeTokenRegistration({
      token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      platform: "ios",
      tokenKind: "apns_voip",
      deviceId: "device.ios.12345",
    }, {
      NODE_ENV: "production",
      APNS_BUNDLE_ID: "fr.secretclubhouse.app",
    }),
    {
      token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      platform: "ios",
      tokenKind: "apns_voip",
      deviceId: "device.ios.12345",
      environment: "production",
      topic: "fr.secretclubhouse.app.voip",
    },
  );

  assert.throws(
    () => normalizeNativeTokenRegistration({
      token: "fcm-token-value-that-is-long-enough",
      platform: "ios",
      tokenKind: "fcm",
      deviceId: "device.ios.12345",
    }),
    /ne correspond pas/,
  );
});

test("crée un secret d’action opaque et ne conserve qu’un hash déterministe", () => {
  const token = createOpaqueCallActionToken(() => Buffer.alloc(32, 7));
  assert.equal(token, `nca_${Buffer.alloc(32, 7).toString("base64url")}`);
  assert.equal(hashCallActionToken(token), hashCallActionToken(token));
  assert.notEqual(hashCallActionToken(token), token);
  assert.equal(hashCallActionToken(token).length, 64);
});

test("sépare les destinations VoIP des alertes APNs ordinaires", () => {
  assert.equal(tokenKindAcceptsPayload("apns_voip", { notificationType: "incoming-call" }), true);
  assert.equal(tokenKindAcceptsPayload("apns_alert", { notificationType: "incoming-call" }), false);
  assert.equal(tokenKindAcceptsPayload("apns_voip", { notificationType: "call-state" }), false);
  assert.equal(tokenKindAcceptsPayload("apns_alert", { notificationType: "call-state" }), true);
  assert.equal(tokenKindAcceptsPayload("fcm", { notificationType: "message" }), true);
});

test("construit les charges FCM avec canal, TTL court et données d’action", () => {
  const message = buildFcmMessage(
    { token: "fcm-device-token" },
    {
      notificationType: "incoming-call",
      callId: "1ea51138-4a35-41c9-a10b-5b601923ed42",
      callType: "audio",
      callActionToken: "nca_secret",
      expiresAt: "2026-07-23T10:00:45.000Z",
    },
    new Date("2026-07-23T10:00:00.000Z").getTime(),
  );
  assert.equal(message.message.android.priority, "HIGH");
  assert.equal(message.message.android.ttl, "45s");
  assert.equal(message.message.data.channelId, "clubhouse_calls_v1");
  assert.equal(message.message.data.sound, "incoming_call_soft");
  assert.equal(message.message.data.callActionToken, "nca_secret");
});

test("construit un push VoIP APNs et un état terminal silencieux sur le bon topic", () => {
  const config = {
    bundleId: "fr.secretclubhouse.app",
    voipTopic: "fr.secretclubhouse.app.voip",
  };
  const incoming = buildApnsRequest(
    {
      token: "0123456789abcdef",
      token_kind: "apns_voip",
      environment: "sandbox",
      topic: "fr.secretclubhouse.app.voip",
    },
    {
      notificationType: "incoming-call",
      callId: "1ea51138-4a35-41c9-a10b-5b601923ed42",
      callActionToken: "nca_secret",
      expiresAt: "2026-07-23T10:00:45.000Z",
    },
    config,
    "provider-jwt",
    new Date("2026-07-23T10:00:00.000Z").getTime(),
  );
  assert.equal(incoming.host, "https://api.sandbox.push.apple.com");
  assert.equal(incoming.headers["apns-topic"], "fr.secretclubhouse.app.voip");
  assert.equal(incoming.headers["apns-push-type"], "voip");
  assert.equal(incoming.headers["apns-expiration"], "0");
  assert.equal(JSON.parse(incoming.body).aps["content-available"], 1);

  const terminal = buildApnsRequest(
    {
      token: "0123456789abcdef",
      token_kind: "apns_alert",
      environment: "production",
      topic: "fr.secretclubhouse.app",
    },
    {
      notificationType: "call-state",
      callId: "1ea51138-4a35-41c9-a10b-5b601923ed42",
      status: "cancelled",
    },
    config,
    "provider-jwt",
    new Date("2026-07-23T10:00:00.000Z").getTime(),
  );
  assert.equal(terminal.headers["apns-topic"], "fr.secretclubhouse.app");
  assert.equal(terminal.headers["apns-push-type"], "background");
  assert.equal(terminal.headers["apns-priority"], "5");
});

test("les builders FCM et APNs ne transmettent jamais un nom ou message privé sentinelle", () => {
  const privateSentinel = "PRIVE_SENTINEL_Cyrielle_rendez_vous_a_18h";
  const config = {
    bundleId: "fr.secretclubhouse.app",
    voipTopic: "fr.secretclubhouse.app.voip",
  };
  const payloads = [
    {
      notificationType: "message",
      title: privateSentinel,
      body: privateSentinel,
      callerName: privateSentinel,
      conversationId: "11111111-1111-4111-8111-111111111111",
      url: "/?notification=message",
    },
    {
      notificationType: "incoming-call",
      title: privateSentinel,
      body: privateSentinel,
      callerName: privateSentinel,
      conversationId: "11111111-1111-4111-8111-111111111111",
      callId: "22222222-2222-4222-8222-222222222222",
      callType: "video",
      callActionToken: "nca_action_token_non_prive",
      expiresAt: "2026-07-23T10:00:45.000Z",
    },
  ];

  for (const payload of payloads) {
    const fcm = buildFcmMessage(
      { token: "fcm-device-token" },
      payload,
      new Date("2026-07-23T10:00:00.000Z").getTime(),
    );
    assert.equal(JSON.stringify(fcm).includes(privateSentinel), false, payload.notificationType);

    const apns = buildApnsRequest(
      {
        token: "0123456789abcdef",
        token_kind: payload.notificationType === "incoming-call" ? "apns_voip" : "apns_alert",
        environment: "production",
        topic: payload.notificationType === "incoming-call"
          ? "fr.secretclubhouse.app.voip"
          : "fr.secretclubhouse.app",
      },
      payload,
      config,
      "provider-jwt",
      new Date("2026-07-23T10:00:00.000Z").getTime(),
    );
    assert.equal(JSON.stringify(apns).includes(privateSentinel), false, payload.notificationType);
  }
});

test("classe uniquement les réponses fournisseur qui invalident réellement le jeton", () => {
  assert.equal(fcmErrorInvalidatesToken(404, {}), false);
  assert.equal(fcmErrorInvalidatesToken(400, {
    error: {
      details: [{
        "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError",
        errorCode: "UNREGISTERED",
      }],
    },
  }), true);
  assert.equal(fcmErrorInvalidatesToken(500, {}), false);
  assert.equal(apnsErrorInvalidatesToken(410, "Unregistered"), true);
  assert.equal(apnsErrorInvalidatesToken(403, "ExpiredProviderToken"), false);
});

test("supprime en base un jeton FCM déclaré invalide par le fournisseur", async () => {
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const queries = [];
  const pool = {
    async query(text, values) {
      queries.push({ text, values });
      return { rows: [], rowCount: 0 };
    },
  };
  let fetchCount = 0;
  const fetchImpl = async () => {
    fetchCount += 1;
    if (fetchCount === 1) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "google-access-token", expires_in: 3600 }),
      };
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({
        error: {
          status: "NOT_FOUND",
          details: [{
            "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError",
            errorCode: "UNREGISTERED",
          }],
        },
      }),
    };
  };
  const service = createNativePushService({
    pool,
    fetchImpl,
    logger: { warn() {}, error() {} },
    env: {
      FCM_SERVICE_ACCOUNT_JSON: JSON.stringify({
        project_id: "secret-clubhouse-test",
        client_email: "push-test@secret-clubhouse-test.iam.gserviceaccount.com",
        private_key: privateKey,
      }),
    },
  });
  const delivered = await service.deliverRows([{
    id: "d3fa9904-511a-4eab-b068-fc08320825fd",
    token: "fcm-device-token-value-that-is-long-enough",
    token_kind: "fcm",
    enabled: true,
  }], {
    notificationType: "message",
    title: "Test",
    body: "Message",
  });

  assert.equal(delivered, 0);
  assert.equal(fetchCount, 2);
  assert.equal(queries.length, 1);
  assert.match(queries[0].text, /delete from native_push_tokens/);
});

test("borne une requête fournisseur bloquée sans immobiliser la notification", async () => {
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const queries = [];
  const pool = {
    async query(text, values) {
      queries.push({ text, values });
      return { rows: [], rowCount: 0 };
    },
  };
  const service = createNativePushService({
    pool,
    fetchImpl: async () => new Promise(() => {}),
    requestTimeoutMs: 25,
    logger: { warn() {}, error() {} },
    env: {
      FCM_SERVICE_ACCOUNT_JSON: JSON.stringify({
        project_id: "secret-clubhouse-test",
        client_email: "push-test@secret-clubhouse-test.iam.gserviceaccount.com",
        private_key: privateKey,
      }),
    },
  });
  const startedAt = Date.now();
  const delivered = await service.deliverRows([{
    id: "d3fa9904-511a-4eab-b068-fc08320825fd",
    token: "fcm-device-token-value-that-is-long-enough",
    token_kind: "fcm",
    enabled: true,
  }], {
    notificationType: "message",
    title: "Test",
    body: "Message",
  });

  assert.equal(delivered, 0);
  assert.ok(Date.now() - startedAt < 1000);
  assert.equal(queries.length, 1);
  assert.match(queries[0].text, /last_failure_at=now\(\)/);
  assert.equal(queries[0].values[1], "PROVIDER_TIMEOUT");
});

test("annule aussi un stream HTTP/2 APNs bloqué", async () => {
  const { privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const queries = [];
  const pool = {
    async query(text, values) {
      queries.push({ text, values });
      return { rows: [], rowCount: 0 };
    },
  };
  let streamClosed = false;
  class HangingApnsClient extends EventEmitter {
    request() {
      const stream = new EventEmitter();
      stream.end = () => {};
      stream.close = () => { streamClosed = true; };
      return stream;
    }
    close() {}
    destroy() {}
  }
  const service = createNativePushService({
    pool,
    http2Connect: () => new HangingApnsClient(),
    requestTimeoutMs: 25,
    logger: { warn() {}, error() {} },
    env: {
      APNS_TEAM_ID: "TEAMID1234",
      APNS_KEY_ID: "KEYID12345",
      APNS_PRIVATE_KEY: privateKey,
      APNS_BUNDLE_ID: "fr.secretclubhouse.app",
      APNS_VOIP_TOPIC: "fr.secretclubhouse.app.voip",
    },
  });
  const delivered = await service.deliverRows([{
    id: "d3fa9904-511a-4eab-b068-fc08320825fd",
    token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    token_kind: "apns_voip",
    environment: "sandbox",
    topic: "fr.secretclubhouse.app.voip",
    enabled: true,
  }], {
    notificationType: "incoming-call",
    callId: "1ea51138-4a35-41c9-a10b-5b601923ed42",
    expiresAt: new Date(Date.now() + 45_000).toISOString(),
  });

  assert.equal(delivered, 0);
  assert.equal(streamClosed, true);
  assert.equal(queries.length, 1);
  assert.equal(queries[0].values[1], "APNS_TIMEOUT");
});
