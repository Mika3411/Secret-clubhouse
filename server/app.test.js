import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const testJwtSecret = "test-only-secret-with-more-than-thirty-two-characters";
process.env.JWT_SECRET = testJwtSecret;

const [{ app }, { pool }] = await Promise.all([
  import("./index.js"),
  import("./db.js"),
]);

const queryResult = (rows = []) => ({ rows, rowCount: rows.length });

async function startTestServer() {
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.once("error", reject);
  });
  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

async function stopTestServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test("les routes applicatives protègent la connexion et la présence", async (t) => {
  const originalPoolQuery = pool.query;
  const { server, baseUrl } = await startTestServer();

  t.after(async () => {
    pool.query = originalPoolQuery;
    await stopTestServer(server);
  });

  await t.test("refuse une inscription qui ne transmet pas les preuves légales versionnées", async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Parent test",
        email: "parent-registration@example.test",
        password: "MotDePasseValide!",
      }),
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /conditions d’utilisation.*autorité parentale/i);
  });

  await t.test("bloque une identité après cinq échecs sans continuer à lire le compte", async () => {
    const passwordHash = await bcrypt.hash("MotDePasseValide!", 4);
    const limiterState = new Map();
    let accountLookups = 0;

    pool.query = async (sql, params = []) => {
      const statement = String(sql).replace(/\s+/g, " ").trim();
      if (statement.startsWith("select blocked_until from login_rate_limits")) {
        const now = Date.now();
        const activeBlocks = [
          limiterState.get(`identity:${params[0]}`)?.blockedUntil,
          limiterState.get(`ip:${params[1]}`)?.blockedUntil,
        ].filter((blockedUntil) => blockedUntil > now);
        const blockedUntil = activeBlocks.sort((first, second) => second - first)[0];
        return queryResult(blockedUntil ? [{ blocked_until: new Date(blockedUntil).toISOString() }] : []);
      }
      if (statement.startsWith("insert into login_rate_limits")) {
        const [scope, keyHash, windowSeconds, maxFailures, blockSeconds] = params;
        const stateKey = `${scope}:${keyHash}`;
        const now = Date.now();
        const existing = limiterState.get(stateKey);
        const windowExpired = !existing || existing.windowStartedAt <= now - (windowSeconds * 1000);
        const failureCount = windowExpired ? 1 : existing.failureCount + 1;
        const blockedUntil = existing?.blockedUntil > now
          ? existing.blockedUntil
          : failureCount >= maxFailures
            ? now + (blockSeconds * 1000)
            : null;
        limiterState.set(stateKey, {
          failureCount,
          windowStartedAt: windowExpired ? now : existing.windowStartedAt,
          blockedUntil,
        });
        return queryResult([{ blocked_until: blockedUntil ? new Date(blockedUntil).toISOString() : null }]);
      }
      if (statement.startsWith("delete from login_rate_limits where scope='identity'")) {
        limiterState.delete(`identity:${params[0]}`);
        return queryResult();
      }
      if (statement.startsWith("insert into security_events")) return queryResult();
      if (statement.includes("select * from accounts where role='parent' and email=$1")) {
        accountLookups += 1;
        return queryResult([{
          id: "11111111-1111-4111-8111-111111111111",
          role: "parent",
          email: params[0],
          contact_id: "SC-100-200-300",
          password_hash: passwordHash,
          display_name: "Parent test",
        }]);
      }
      throw new Error(`Requête SQL inattendue pendant le test de connexion : ${statement}`);
    };

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "parent@example.test", password: "incorrect" }),
      });
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "Identifiants incorrects." });
    }

    const thresholdResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "parent@example.test", password: "incorrect" }),
    });
    assert.equal(thresholdResponse.status, 429);
    assert.match(thresholdResponse.headers.get("retry-after") ?? "", /^\d+$/);
    assert.deepEqual(await thresholdResponse.json(), { error: "Trop de tentatives. Réessayez plus tard." });

    const blockedResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "parent@example.test", password: "MotDePasseValide!" }),
    });
    assert.equal(blockedResponse.status, 429);
    assert.equal(accountLookups, 5);
  });

  await t.test("bloque une même adresse IP qui essaie trop d’identités", async () => {
    const passwordHash = await bcrypt.hash("MotDePasseValide!", 4);
    const limiterState = new Map();
    let accountLookups = 0;

    pool.query = async (sql, params = []) => {
      const statement = String(sql).replace(/\s+/g, " ").trim();
      if (statement.startsWith("select blocked_until from login_rate_limits")) {
        const now = Date.now();
        const activeBlocks = [
          limiterState.get(`identity:${params[0]}`)?.blockedUntil,
          limiterState.get(`ip:${params[1]}`)?.blockedUntil,
        ].filter((blockedUntil) => blockedUntil > now);
        const blockedUntil = activeBlocks.sort((first, second) => second - first)[0];
        return queryResult(blockedUntil ? [{ blocked_until: new Date(blockedUntil).toISOString() }] : []);
      }
      if (statement.startsWith("insert into login_rate_limits")) {
        const [scope, keyHash, windowSeconds, maxFailures, blockSeconds] = params;
        const stateKey = `${scope}:${keyHash}`;
        const now = Date.now();
        const existing = limiterState.get(stateKey);
        const windowExpired = !existing || existing.windowStartedAt <= now - (windowSeconds * 1000);
        const failureCount = windowExpired ? 1 : existing.failureCount + 1;
        const blockedUntil = existing?.blockedUntil > now
          ? existing.blockedUntil
          : failureCount >= maxFailures
            ? now + (blockSeconds * 1000)
            : null;
        limiterState.set(stateKey, {
          failureCount,
          windowStartedAt: windowExpired ? now : existing.windowStartedAt,
          blockedUntil,
        });
        return queryResult([{ blocked_until: blockedUntil ? new Date(blockedUntil).toISOString() : null }]);
      }
      if (statement.startsWith("insert into security_events")) return queryResult();
      if (statement.includes("select * from accounts where role='parent' and email=$1")) {
        accountLookups += 1;
        return queryResult([{
          id: "11111111-1111-4111-8111-111111111111",
          role: "parent",
          email: params[0],
          contact_id: "SC-100-200-300",
          password_hash: passwordHash,
          display_name: "Parent test",
        }]);
      }
      throw new Error(`Requête SQL inattendue pendant le test de limitation IP : ${statement}`);
    };

    for (let attempt = 1; attempt <= 24; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `essai-${attempt}@example.test`, password: "incorrect" }),
      });
      assert.equal(response.status, 401);
      await response.body.cancel();
    }

    const thresholdResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "essai-25@example.test", password: "incorrect" }),
    });
    assert.equal(thresholdResponse.status, 429);
    await thresholdResponse.body.cancel();

    const blockedResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nouvelle-identite@example.test", password: "MotDePasseValide!" }),
    });
    assert.equal(blockedResponse.status, 429);
    await blockedResponse.body.cancel();
    assert.equal(accountLookups, 25);
  });

  await t.test("efface la limitation de l’identité après une connexion valide", async () => {
    const passwordHash = await bcrypt.hash("MotDePasseValide!", 4);
    let identityCleared = false;

    pool.query = async (sql, params = []) => {
      const statement = String(sql).replace(/\s+/g, " ").trim();
      if (statement.startsWith("select blocked_until from login_rate_limits")) return queryResult();
      if (statement.includes("select * from accounts where role='parent' and email=$1")) {
        return queryResult([{
          id: "22222222-2222-4222-8222-222222222222",
          role: "parent",
          email: params[0],
          contact_id: "SC-101-201-301",
          password_hash: passwordHash,
          display_name: "Parent valide",
        }]);
      }
      if (statement.startsWith("delete from login_rate_limits where scope='identity'")) {
        identityCleared = true;
        return queryResult();
      }
      if (statement.startsWith("update accounts set last_activity_at=now()")) return queryResult();
      if (statement.startsWith("insert into security_events")) return queryResult();
      if (statement.startsWith("insert into auth_sessions")) return queryResult();
      throw new Error(`Requête SQL inattendue pendant le test de connexion valide : ${statement}`);
    };

    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Secret-Clubhouse-Client": "native",
      },
      body: JSON.stringify({ email: "valide@example.test", password: "MotDePasseValide!" }),
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.account.email, "valide@example.test");
    assert.equal(typeof payload.token, "string");
    assert.equal(identityCleared, true);
  });

  await t.test("la connexion web utilise un cookie HttpOnly SameSite sans jeton JSON puis le logout révoque la session", async () => {
    const passwordHash = await bcrypt.hash("MotDePasseValide!", 4);
    const accountId = "77777777-7777-4777-8777-777777777777";
    const sessionId = "88888888-8888-4888-8888-888888888888";
    const originalNodeEnv = process.env.NODE_ENV;
    let sessionHash = "";
    let revoked = false;

    pool.query = async (sql, params = []) => {
      const statement = String(sql).replace(/\s+/g, " ").trim();
      if (statement.startsWith("select blocked_until from login_rate_limits")) return queryResult();
      if (statement.includes("select * from accounts where role='parent' and email=$1")) {
        return queryResult([{
          id: accountId,
          role: "parent",
          email: params[0],
          contact_id: "SC-707-808-909",
          password_hash: passwordHash,
          display_name: "Parent cookie",
        }]);
      }
      if (statement.startsWith("delete from login_rate_limits where scope='identity'")) return queryResult();
      if (statement.startsWith("update accounts set last_activity_at=now()")) return queryResult();
      if (statement.startsWith("insert into security_events")) return queryResult();
      if (statement.startsWith("insert into auth_sessions")) {
        sessionHash = params[1];
        return queryResult([{
          id: sessionId,
          account_id: accountId,
          client_type: "web",
          device_id: null,
          created_at: new Date().toISOString(),
          expires_at: params[4],
          revoked_at: null,
        }]);
      }
      if (statement.includes("from auth_sessions session")) {
        assert.equal(params[0], sessionHash);
        return revoked
          ? queryResult()
          : queryResult([{
              id: sessionId,
              account_id: accountId,
              role: "parent",
              client_type: "web",
              device_id: null,
              created_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 300_000).toISOString(),
              revoked_at: null,
            }]);
      }
      if (statement.includes("select processing_restricted_at,processing_restriction_reason from accounts")) {
        return queryResult([{ processing_restricted_at: null, processing_restriction_reason: null }]);
      }
      if (statement.startsWith("update auth_sessions set revoked_at=")) {
        assert.equal(params[0], sessionHash);
        assert.equal(params[2], "logout");
        revoked = true;
        return queryResult([{
          id: sessionId,
          account_id: accountId,
          client_type: "web",
          device_id: null,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 300_000).toISOString(),
          revoked_at: params[1],
        }]);
      }
      throw new Error(`Requête SQL inattendue pendant le test de session web : ${statement}`);
    };

    process.env.NODE_ENV = "production";
    try {
      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "cookie@example.test",
          password: "MotDePasseValide!",
        }),
      });
      const setCookie = loginResponse.headers.get("set-cookie") ?? "";
      const cookiePair = setCookie.split(";", 1)[0];
      const rawSessionToken = cookiePair.slice(cookiePair.indexOf("=") + 1);
      const loginText = await loginResponse.text();
      const loginPayload = JSON.parse(loginText);

      assert.equal(loginResponse.status, 200);
      assert.match(setCookie, /^__Host-sc_session=[A-Za-z0-9_-]{43};/);
      assert.match(setCookie, /; HttpOnly(?:;|$)/);
      assert.match(setCookie, /; SameSite=Lax(?:;|$)/);
      assert.match(setCookie, /; Secure(?:;|$)/);
      assert.equal(Object.hasOwn(loginPayload, "token"), false);
      assert.equal(loginText.includes(rawSessionToken), false);
      assert.match(sessionHash, /^[a-f0-9]{64}$/);

      const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
        headers: {
          Cookie: cookiePair,
          Origin: baseUrl,
          "Sec-Fetch-Site": "same-origin",
        },
      });
      const clearedCookie = logoutResponse.headers.get("set-cookie") ?? "";

      assert.equal(logoutResponse.status, 204);
      assert.equal(revoked, true);
      assert.match(clearedCookie, /^__Host-sc_session=;/);
      assert.match(clearedCookie, /Max-Age=0/);
      assert.match(clearedCookie, /HttpOnly/);
      assert.match(clearedCookie, /SameSite=Lax/);

      const afterLogout = await fetch(`${baseUrl}/api/me`, {
        headers: { Cookie: cookiePair },
      });
      assert.equal(afterLogout.status, 401);
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
    }
  });

  await t.test("une erreur interne sentinelle n’est jamais renvoyée au client", async () => {
    const sentinel = "POSTGRES_INTERNE_SENTINEL_password=secret_table=messages";
    const internalError = new Error(sentinel);
    internalError.statusCode = 400;
    internalError.detail = `select contenu_prive from messages -- ${sentinel}`;
    const originalConsoleError = console.error;

    pool.query = async () => {
      throw internalError;
    };
    console.error = () => undefined;
    try {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "erreur@example.test",
          password: "MotDePasseValide!",
        }),
      });
      const responseText = await response.text();
      const payload = JSON.parse(responseText);

      assert.equal(response.status, 500);
      assert.equal(payload.error, "Erreur interne.");
      assert.match(payload.requestId, /^[0-9a-f-]{36}$/i);
      assert.equal(responseText.includes(sentinel), false);
      assert.equal(responseText.includes("select contenu_prive"), false);
    } finally {
      console.error = originalConsoleError;
    }
  });

  await t.test("omet la présence d’un identifiant sans relation autorisée", async () => {
    const accountId = "33333333-3333-4333-8333-333333333333";
    const authorizedContactId = "SC-111-222-333";
    const unrelatedContactId = "SC-444-555-666";
    let presenceQuery = "";

    pool.query = async (sql, params = []) => {
      const statement = String(sql);
      if (statement.includes("from auth_sessions session")) {
        return queryResult([{
          id: "55555555-5555-4555-8555-555555555555",
          account_id: accountId,
          client_type: "native",
          device_id: null,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 300_000).toISOString(),
          revoked_at: null,
          role: "parent",
        }]);
      }
      if (statement.includes("select processing_restricted_at,processing_restriction_reason from accounts")) {
        assert.deepEqual(params, [accountId]);
        return queryResult([{ processing_restricted_at: null, processing_restriction_reason: null }]);
      }
      presenceQuery = statement;
      assert.deepEqual(params, [[authorizedContactId, unrelatedContactId], accountId]);
      return queryResult([{ contact_id: authorizedContactId, online: true }]);
    };

    const unauthenticated = await fetch(`${baseUrl}/api/presence?contactIds=${authorizedContactId}`);
    assert.equal(unauthenticated.status, 401);

    const token = Buffer.alloc(32, 7).toString("base64url");
    const response = await fetch(
      `${baseUrl}/api/presence?contactIds=${authorizedContactId},${unrelatedContactId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Secret-Clubhouse-Client": "native",
        },
      },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { presence: { [authorizedContactId]: true } });
    assert.match(presenceQuery, /contact_relationships/);
    assert.match(presenceQuery, /family_memberships/);
    assert.match(presenceQuery, /family_children/);
    assert.match(presenceQuery, /join authorized_accounts/);
  });
});
