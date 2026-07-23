import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  AUTH_SESSIONS_SCHEMA_SQL,
  DEFAULT_SESSION_TTL_SECONDS,
  DEVELOPMENT_SESSION_COOKIE,
  MAX_SESSION_TTL_SECONDS,
  MIN_SESSION_TTL_SECONDS,
  PRODUCTION_SESSION_COOKIE,
  authenticateSessionRequest,
  createAuthSession,
  extractBearerSessionToken,
  extractCookieSessionToken,
  extractSessionCredential,
  findAuthSession,
  generateSessionToken,
  hashSessionToken,
  initializeAuthSessionStore,
  issueNativeSession,
  issueWebSession,
  logoutAuthSession,
  normalizeSessionTtlSeconds,
  revokeAuthSession,
  serializeClearedSessionCookie,
  serializeSessionCookie,
} from "./auth-sessions.js";

const fixedBytes = Buffer.from(Array.from({ length: 32 }, (_, index) => index));
const fixedToken = fixedBytes.toString("base64url");
const fixedHash = crypto.createHash("sha256").update(fixedToken).digest("hex");
const now = new Date("2026-07-23T12:00:00.000Z");
const accountId = "11111111-1111-4111-8111-111111111111";

function fakeResponse() {
  const headers = new Map();
  return {
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
  };
}

test("génère exactement 256 bits et produit uniquement un hash SHA-256 stable", () => {
  const token = generateSessionToken((size) => {
    assert.equal(size, 32);
    return fixedBytes;
  });
  assert.equal(token, fixedToken);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(hashSessionToken(token), fixedHash);
  assert.match(fixedHash, /^[a-f0-9]{64}$/);
  assert.throws(() => generateSessionToken(() => Buffer.alloc(31)), /256 bits/);
  assert.throws(() => hashSessionToken("trop-court"), /invalide/);
});

test("borne la durée configurée et conserve douze heures par défaut", () => {
  assert.equal(DEFAULT_SESSION_TTL_SECONDS, 12 * 60 * 60);
  assert.equal(normalizeSessionTtlSeconds(undefined), DEFAULT_SESSION_TTL_SECONDS);
  assert.equal(normalizeSessionTtlSeconds("1"), MIN_SESSION_TTL_SECONDS);
  assert.equal(normalizeSessionTtlSeconds(MAX_SESSION_TTL_SECONDS * 2), MAX_SESSION_TTL_SECONDS);
  assert.equal(normalizeSessionTtlSeconds("3600.9"), 3600);
  assert.equal(normalizeSessionTtlSeconds("invalide"), DEFAULT_SESSION_TTL_SECONDS);
});

test("expose un schéma PostgreSQL autonome qui ne contient aucun secret brut", async () => {
  const calls = [];
  await initializeAuthSessionStore({
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [] };
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sql, AUTH_SESSIONS_SCHEMA_SQL);
  assert.equal(calls[0].params, undefined);
  assert.match(AUTH_SESSIONS_SCHEMA_SQL, /token_hash text not null unique/i);
  assert.match(AUTH_SESSIONS_SCHEMA_SQL, /references accounts\(id\) on delete cascade/i);
  assert.doesNotMatch(AUTH_SESSIONS_SCHEMA_SQL, /raw_token|session_token/i);
});

test("crée une session PostgreSQL sans jamais transmettre le jeton brut", async () => {
  const calls = [];
  const executor = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [{
          id: "22222222-2222-4222-8222-222222222222",
          account_id: accountId,
          client_type: "native",
          device_id: "android-test",
          created_at: now,
          expires_at: params[4],
          revoked_at: null,
        }],
      };
    },
  };

  const result = await createAuthSession(executor, {
    accountId,
    clientType: "native",
    deviceId: "android-test",
    ttlSeconds: 3600,
    now,
    randomBytes: () => fixedBytes,
  });

  assert.equal(result.token, fixedToken);
  assert.equal(result.session.accountId, accountId);
  assert.equal(result.session.clientType, "native");
  assert.equal(result.session.deviceId, "android-test");
  assert.equal(result.session.expiresAt.toISOString(), "2026-07-23T13:00:00.000Z");
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /insert into auth_sessions/i);
  assert.equal(calls[0].params[1], fixedHash);
  assert.equal(calls[0].params.includes(fixedToken), false);
});

test("le helper web pose un cookie HttpOnly sans retourner le secret", async () => {
  const response = fakeResponse();
  const executor = {
    async query(_sql, params) {
      return {
        rows: [{
          id: "33333333-3333-4333-8333-333333333333",
          account_id: accountId,
          client_type: "web",
          device_id: null,
          created_at: now,
          expires_at: params[4],
          revoked_at: null,
        }],
      };
    },
  };

  const session = await issueWebSession(executor, response, {
    accountId,
    production: true,
    now,
    randomBytes: () => fixedBytes,
  });
  const cookie = response.getHeader("Set-Cookie");

  assert.equal(Object.hasOwn(session, "token"), false);
  assert.match(cookie, new RegExp(`^${PRODUCTION_SESSION_COOKIE}=${fixedToken};`));
  assert.match(cookie, /; HttpOnly(?:;|$)/);
  assert.match(cookie, /; Secure(?:;|$)/);
  assert.match(cookie, /; SameSite=Lax(?:;|$)/);
  assert.match(cookie, /; Path=\/(?:;|$)/);
  assert.doesNotMatch(cookie, /Domain=/i);
});

test("sérialise un cookie de production strict et un cookie HTTP de développement", () => {
  const production = serializeSessionCookie(fixedToken, {
    production: true,
    ttlSeconds: 3600,
  });
  assert.match(production, new RegExp(`^${PRODUCTION_SESSION_COOKIE}=`));
  assert.match(production, /Max-Age=3600/);
  assert.match(production, /HttpOnly/);
  assert.match(production, /SameSite=Lax/);
  assert.match(production, /Secure/);

  const development = serializeSessionCookie(fixedToken, {
    production: false,
    ttlSeconds: 3600,
  });
  assert.match(development, new RegExp(`^${DEVELOPMENT_SESSION_COOKIE}=`));
  assert.match(development, /HttpOnly/);
  assert.doesNotMatch(development, /(?:^|; )Secure(?:;|$)/);

  const cleared = serializeClearedSessionCookie({ production: true });
  assert.match(cleared, new RegExp(`^${PRODUCTION_SESSION_COOKIE}=;`));
  assert.match(cleared, /Max-Age=0/);
  assert.match(cleared, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
  assert.match(cleared, /Secure/);
});

test("sépare strictement le cookie web du Bearer natif et refuse un format ambigu", () => {
  assert.equal(
    extractCookieSessionToken(
      { headers: { cookie: `préférence=mint; ${PRODUCTION_SESSION_COOKIE}=${fixedToken}` } },
      { production: true },
    ),
    fixedToken,
  );
  assert.equal(
    extractBearerSessionToken({ headers: { authorization: `Bearer ${fixedToken}` } }),
    fixedToken,
  );
  assert.equal(extractBearerSessionToken({ headers: { authorization: `Basic ${fixedToken}` } }), null);
  assert.equal(extractBearerSessionToken({ headers: { authorization: `Bearer ${fixedToken}, autre` } }), null);

  const both = {
    headers: {
      cookie: `${PRODUCTION_SESSION_COOKIE}=${fixedToken}`,
      authorization: `Bearer ${Buffer.alloc(32, 9).toString("base64url")}`,
    },
  };
  assert.equal(extractSessionCredential(both, { production: true }), null);
  assert.equal(
    extractSessionCredential(both, { production: true, expectedClientType: "web" }),
    null,
  );

  assert.deepEqual(
    extractSessionCredential(
      { headers: { cookie: `${PRODUCTION_SESSION_COOKIE}=${fixedToken}` } },
      { production: true, expectedClientType: "web" },
    ),
    { token: fixedToken, transport: "cookie" },
  );
  assert.equal(
    extractSessionCredential(
      { headers: { cookie: `${PRODUCTION_SESSION_COOKIE}=${fixedToken}` } },
      { production: true, expectedClientType: "native" },
    ),
    null,
  );
  assert.deepEqual(
    extractSessionCredential(
      { headers: { authorization: `Bearer ${fixedToken}` } },
      { production: true, expectedClientType: "native" },
    ),
    { token: fixedToken, transport: "bearer" },
  );
  assert.equal(
    extractSessionCredential(
      { headers: { authorization: `Bearer ${fixedToken}` } },
      { production: true, expectedClientType: "web" },
    ),
    null,
  );
  assert.throws(
    () => extractSessionCredential({}, { expectedClientType: "mobile" }),
    /web ou native/,
  );
});

test("retrouve seulement une session active à partir du hash", async () => {
  const calls = [];
  const executor = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [{
          id: "44444444-4444-4444-8444-444444444444",
          account_id: accountId,
          role: "parent",
          client_type: "native",
          device_id: "ios-test",
          created_at: now,
          expires_at: new Date("2026-07-24T12:00:00.000Z"),
          revoked_at: null,
        }],
      };
    },
  };

  const session = await findAuthSession(executor, fixedToken, { now });
  assert.equal(session.role, "parent");
  assert.equal(session.accountId, accountId);
  assert.equal(calls[0].params[0], fixedHash);
  assert.equal(calls[0].params.includes(fixedToken), false);
  assert.equal(await findAuthSession(executor, "invalide", { now }), null);
  assert.equal(calls.length, 1);

  const authenticated = await authenticateSessionRequest(
    executor,
    { headers: { authorization: `Bearer ${fixedToken}` } },
    { now, production: true, expectedClientType: "native" },
  );
  assert.equal(authenticated.transport, "bearer");
  assert.equal(
    await authenticateSessionRequest(
      executor,
      { headers: { cookie: `${PRODUCTION_SESSION_COOKIE}=${fixedToken}` } },
      { now, production: true, expectedClientType: "web" },
    ),
    null,
  );
});

test("refuse une session web par Bearer et une session native par cookie", async () => {
  let clientType = "web";
  const executor = {
    async query() {
      return {
        rows: [{
          id: "57575757-5757-4757-8757-575757575757",
          account_id: accountId,
          role: "parent",
          client_type: clientType,
          device_id: null,
          created_at: now,
          expires_at: new Date("2026-07-24T12:00:00.000Z"),
          revoked_at: null,
        }],
      };
    },
  };

  assert.equal(
    await authenticateSessionRequest(
      executor,
      { headers: { authorization: `Bearer ${fixedToken}` } },
      { now, production: true, expectedClientType: "native" },
    ),
    null,
  );

  clientType = "native";
  assert.equal(
    await authenticateSessionRequest(
      executor,
      { headers: { cookie: `${PRODUCTION_SESSION_COOKIE}=${fixedToken}` } },
      { now, production: true, expectedClientType: "web" },
    ),
    null,
  );
});

test("le helper natif émet un secret opaque pour la mémoire du client", async () => {
  const executor = {
    async query(_sql, params) {
      return {
        rows: [{
          id: "55555555-5555-4555-8555-555555555555",
          account_id: accountId,
          client_type: "native",
          device_id: "device-native",
          created_at: now,
          expires_at: params[4],
          revoked_at: null,
        }],
      };
    },
  };
  const created = await issueNativeSession(executor, {
    accountId,
    deviceId: "device-native",
    now,
    randomBytes: () => fixedBytes,
  });
  assert.equal(created.token, fixedToken);
  assert.equal(created.session.clientType, "native");
});

test("révoque par hash et réalise un logout idempotent qui efface le cookie", async () => {
  const calls = [];
  const executor = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [{
          id: "66666666-6666-4666-8666-666666666666",
          account_id: accountId,
          client_type: "web",
          device_id: null,
          created_at: now,
          expires_at: new Date("2026-07-24T12:00:00.000Z"),
          revoked_at: params[1],
        }],
      };
    },
  };

  const revoked = await revokeAuthSession(executor, fixedToken, {
    now,
    reason: "logout",
  });
  assert.equal(revoked.accountId, accountId);
  assert.equal(calls[0].params[0], fixedHash);
  assert.equal(calls[0].params.includes(fixedToken), false);
  assert.equal(calls[0].params[2], "logout");

  const response = fakeResponse();
  const loggedOut = await logoutAuthSession(
    executor,
    { headers: { cookie: `${PRODUCTION_SESSION_COOKIE}=${fixedToken}` } },
    response,
    { production: true, expectedClientType: "web", now },
  );
  assert.equal(loggedOut.revoked, true);
  assert.match(response.getHeader("Set-Cookie"), /Max-Age=0/);

  const anonymousResponse = fakeResponse();
  const anonymous = await logoutAuthSession(
    executor,
    { headers: {} },
    anonymousResponse,
    { production: false, now },
  );
  assert.equal(anonymous.revoked, false);
  assert.match(anonymousResponse.getHeader("Set-Cookie"), new RegExp(`^${DEVELOPMENT_SESSION_COOKIE}=;`));
  assert.equal(calls.length, 2);
});
