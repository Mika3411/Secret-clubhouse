import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { registrationLegalEvidence } from "../src/legal-framework.js";
import { registrationRateLimits } from "./login-protection.js";

process.env.JWT_SECRET = "registration-protection-test-secret-with-thirty-two-characters";

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

function createRegistrationLimiterQuery({ invitation = null } = {}) {
  const limiterState = new Map();
  let invitationLookups = 0;
  let blockedEvents = 0;

  return {
    async query(sql, params = []) {
      const statement = String(sql).replace(/\s+/g, " ").trim();
      if (statement.startsWith("insert into login_rate_limits") && statement.includes("'registration_ip'")) {
        const [keyHash, windowSeconds, maxAttempts, blockSeconds] = params;
        const now = Date.now();
        const existing = limiterState.get(keyHash);
        const activeBlock = existing?.blockedUntil > now;
        const windowExpired = !existing || existing.windowStartedAt <= now - (windowSeconds * 1000);
        const attemptCount = activeBlock
          ? existing.attemptCount
          : windowExpired
            ? 1
            : existing.attemptCount + 1;
        const blockedUntil = activeBlock
          ? existing.blockedUntil
          : attemptCount > maxAttempts
            ? now + (blockSeconds * 1000)
            : null;
        limiterState.set(keyHash, {
          attemptCount,
          windowStartedAt: activeBlock
            ? existing.windowStartedAt
            : windowExpired
              ? now
              : existing.windowStartedAt,
          blockedUntil,
        });
        return queryResult([{ blocked_until: blockedUntil ? new Date(blockedUntil).toISOString() : null }]);
      }
      if (statement.includes("from family_parent_invitations i")) {
        invitationLookups += 1;
        return queryResult(invitation ? [invitation] : []);
      }
      if (statement.startsWith("insert into security_events")) {
        blockedEvents += 1;
        return queryResult();
      }
      throw new Error(`Requête SQL inattendue pendant le test d’inscription : ${statement}`);
    },
    get invitationLookups() {
      return invitationLookups;
    },
    get blockedEvents() {
      return blockedEvents;
    },
  };
}

test("les inscriptions publiques bornent le travail bcrypt par adresse IP", async (t) => {
  const originalPoolQuery = pool.query;
  const originalPoolConnect = pool.connect;
  const originalBcryptHash = bcrypt.hash;
  const originalConsoleError = console.error;
  const { server, baseUrl } = await startTestServer();

  t.after(async () => {
    pool.query = originalPoolQuery;
    pool.connect = originalPoolConnect;
    bcrypt.hash = originalBcryptHash;
    console.error = originalConsoleError;
    await stopTestServer(server);
  });

  await t.test("l’inscription parent refuse le onzième hachage dans la fenêtre", async () => {
    const limiter = createRegistrationLimiterQuery();
    let hashCalls = 0;
    let connectionCalls = 0;
    pool.query = limiter.query;
    bcrypt.hash = async () => {
      hashCalls += 1;
      return "hash-test";
    };
    pool.connect = async () => {
      connectionCalls += 1;
      return {
        async query(sql) {
          const statement = String(sql).replace(/\s+/g, " ").trim();
          if (statement === "begin" || statement === "rollback") return queryResult();
          if (statement.startsWith("insert into accounts")) {
            throw Object.assign(new Error("duplicate"), {
              code: "23505",
              constraint: "accounts_email_key",
            });
          }
          throw new Error(`Requête transactionnelle inattendue : ${statement}`);
        },
        release() {},
      };
    };

    for (let attempt = 1; attempt <= registrationRateLimits.ipAttempts; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Parent test",
          email: `parent-${attempt}@example.test`,
          password: "MotDePasseValide!",
          legal: registrationLegalEvidence(),
        }),
      });
      assert.equal(response.status, 409);
      await response.body.cancel();
    }

    const blockedResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Parent bloqué",
        email: "parent-blocked@example.test",
        password: "MotDePasseValide!",
        legal: registrationLegalEvidence(),
      }),
    });
    assert.equal(blockedResponse.status, 429);
    assert.match(blockedResponse.headers.get("retry-after") ?? "", /^\d+$/);
    assert.deepEqual(await blockedResponse.json(), { error: "Trop de tentatives. Réessayez plus tard." });
    assert.equal(hashCalls, registrationRateLimits.ipAttempts);
    assert.equal(connectionCalls, registrationRateLimits.ipAttempts);
    assert.equal(limiter.blockedEvents, 1);
  });

  await t.test("un faux jeton est recherché avant bcrypt puis limité par la même IP", async () => {
    const limiter = createRegistrationLimiterQuery();
    let hashCalls = 0;
    pool.query = limiter.query;
    bcrypt.hash = async () => {
      hashCalls += 1;
      return "hash-test";
    };
    pool.connect = async () => {
      throw new Error("Une invitation inexistante ne doit pas ouvrir de transaction.");
    };
    const token = "A".repeat(43);
    console.error = () => {};
    try {
      for (let attempt = 1; attempt <= registrationRateLimits.ipAttempts; attempt += 1) {
        const response = await fetch(`${baseUrl}/api/auth/register-with-invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            name: "Co-parent test",
            password: "MotDePasseValide!",
            legal: registrationLegalEvidence(),
          }),
        });
        assert.equal(response.status, 404);
        await response.body.cancel();
      }

      const blockedResponse = await fetch(`${baseUrl}/api/auth/register-with-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: "Co-parent test",
          password: "MotDePasseValide!",
          legal: registrationLegalEvidence(),
        }),
      });
      assert.equal(blockedResponse.status, 429);
      assert.match(blockedResponse.headers.get("retry-after") ?? "", /^\d+$/);
      await blockedResponse.body.cancel();
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(hashCalls, 0);
    assert.equal(limiter.invitationLookups, registrationRateLimits.ipAttempts);
    assert.equal(limiter.blockedEvents, 1);
  });
});
