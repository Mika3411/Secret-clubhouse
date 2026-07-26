import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

process.env.JWT_SECRET = "test-only-secret-with-more-than-thirty-two-characters";

const [{ app }, { pool }] = await Promise.all([
  import("./index.js"),
  import("./db.js"),
]);

const queryResult = (rows = [], rowCount = rows.length) => ({ rows, rowCount });
const accountId = "11111111-1111-4111-8111-111111111111";
const currentSessionId = "22222222-2222-4222-8222-222222222222";
const otherSessionId = "33333333-3333-4333-8333-333333333333";
const nativeToken = Buffer.alloc(32, 19).toString("base64url");

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

const authHeaders = (extra = {}) => ({
  Authorization: `Bearer ${nativeToken}`,
  "X-Secret-Clubhouse-Client": "native",
  ...extra,
});

function activeParentSession() {
  const timestamp = new Date().toISOString();
  return {
    id: currentSessionId,
    account_id: accountId,
    role: "parent",
    client_type: "native",
    device_id: "installation-parent",
    device_label: "Application Android",
    created_at: timestamp,
    last_used_at: timestamp,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    revoked_at: null,
  };
}

function mockAuthenticationQuery(sql) {
  const statement = String(sql).replace(/\s+/gu, " ").trim();
  if (statement.includes("from auth_sessions session")) {
    return queryResult([activeParentSession()]);
  }
  if (statement.includes("select processing_restricted_at,processing_restriction_reason from accounts")) {
    return queryResult([{ processing_restricted_at: null, processing_restriction_reason: null }]);
  }
  return null;
}

test("le parent liste et révoque ses sessions sans exposer de secret", async (t) => {
  const originalQuery = pool.query;
  const { server, baseUrl } = await startTestServer();
  const revokedSessionIds = [];
  let revokeOthersCount = 0;

  t.after(async () => {
    pool.query = originalQuery;
    await stopTestServer(server);
  });

  pool.query = async (sql, params = []) => {
    const authentication = mockAuthenticationQuery(sql);
    if (authentication) return authentication;
    const statement = String(sql).replace(/\s+/gu, " ").trim();
    if (statement.startsWith("select id,account_id,client_type,device_label")) {
      const current = activeParentSession();
      return queryResult([
        current,
        {
          ...current,
          id: otherSessionId,
          client_type: "web",
          device_label: "Navigateur web",
          device_id: "identifiant-technique-prive",
          token_hash: "secret-interdit",
        },
      ]);
    }
    if (statement.includes("where id=$1") && statement.includes("account_id=$2")) {
      revokedSessionIds.push(params[0]);
      assert.deepEqual(params.slice(0, 3), [otherSessionId, accountId, currentSessionId]);
      return queryResult([], 1);
    }
    if (statement.includes("id<>$2") && statement.includes("account_id=$1")) {
      revokeOthersCount += 1;
      assert.deepEqual(params.slice(0, 2), [accountId, currentSessionId]);
      return queryResult([], 1);
    }
    throw new Error(`Requête SQL inattendue : ${statement}`);
  };

  const listResponse = await fetch(`${baseUrl}/api/account/sessions`, {
    headers: authHeaders(),
  });
  const listPayload = await listResponse.json();
  assert.equal(listResponse.status, 200);
  assert.equal(listPayload.sessions.length, 2);
  assert.equal(listPayload.sessions[0].current, true);
  assert.equal(listPayload.sessions[1].deviceLabel, "Navigateur web");
  assert.equal(JSON.stringify(listPayload).includes("token_hash"), false);
  assert.equal(JSON.stringify(listPayload).includes("identifiant-technique-prive"), false);

  const currentResponse = await fetch(`${baseUrl}/api/account/sessions/${currentSessionId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  assert.equal(currentResponse.status, 409);
  assert.match((await currentResponse.json()).error, /Se déconnecter/iu);

  const revokeResponse = await fetch(`${baseUrl}/api/account/sessions/${otherSessionId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  assert.equal(revokeResponse.status, 204);
  assert.deepEqual(revokedSessionIds, [otherSessionId]);

  const othersResponse = await fetch(`${baseUrl}/api/account/sessions/revoke-others`, {
    method: "POST",
    headers: authHeaders(),
  });
  assert.equal(othersResponse.status, 200);
  assert.deepEqual(await othersResponse.json(), { revokedSessions: 1 });
  assert.equal(revokeOthersCount, 1);
});

test("changer le mot de passe parent révoque atomiquement toutes les autres sessions", async (t) => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const originalCompare = bcrypt.compare;
  const originalHash = bcrypt.hash;
  const { server, baseUrl } = await startTestServer();
  const transactionEvents = [];

  t.after(async () => {
    pool.query = originalQuery;
    pool.connect = originalConnect;
    bcrypt.compare = originalCompare;
    bcrypt.hash = originalHash;
    await stopTestServer(server);
  });

  pool.query = async (sql) => {
    const authentication = mockAuthenticationQuery(sql);
    if (authentication) return authentication;
    throw new Error(`Requête SQL hors transaction inattendue : ${String(sql)}`);
  };
  bcrypt.compare = async (submitted) => submitted === "mot-de-passe-actuel";
  bcrypt.hash = async () => "nouveau-hash-bcrypt";
  pool.connect = async () => ({
    async query(sql, params = []) {
      const statement = String(sql).replace(/\s+/gu, " ").trim();
      if (statement === "begin" || statement === "commit" || statement === "rollback") {
        transactionEvents.push(statement);
        return queryResult();
      }
      if (statement.includes("select password_hash") && statement.includes("for update")) {
        transactionEvents.push("lock-account");
        return queryResult([{ password_hash: "ancien-hash-bcrypt" }]);
      }
      if (statement.startsWith("update accounts set password_hash=$1")) {
        transactionEvents.push("update-password");
        assert.deepEqual(params, ["nouveau-hash-bcrypt", accountId]);
        return queryResult([], 1);
      }
      if (statement.includes("update auth_sessions") && statement.includes("id<>$2")) {
        transactionEvents.push("revoke-others");
        assert.equal(params[0], accountId);
        assert.equal(params[1], currentSessionId);
        assert.equal(params[3], "parent_password_change");
        return queryResult([], 2);
      }
      throw new Error(`Requête transactionnelle inattendue : ${statement}`);
    },
    release() {
      transactionEvents.push("release");
    },
  });

  const response = await fetch(`${baseUrl}/api/account/password`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      currentPassword: "mot-de-passe-actuel",
      newPassword: "nouveau-mot-de-passe",
    }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { revokedSessions: 2 });
  assert.deepEqual(transactionEvents, [
    "begin",
    "lock-account",
    "update-password",
    "revoke-others",
    "commit",
    "release",
  ]);
});

test("changer le mot de passe enfant révoque toutes ses sessions dans la même transaction", async (t) => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const originalHash = bcrypt.hash;
  const { server, baseUrl } = await startTestServer();
  const childId = "44444444-4444-4444-8444-444444444444";
  const transactionEvents = [];
  const existingChild = {
    id: childId,
    role: "child",
    display_name: "Lina",
    age: 9,
    username: "lina.club",
    password_hash: "ancien-hash-enfant",
    avatar_color: "mint",
    avatar_path: null,
    avatar_config: null,
    status: "active",
    safety_settings: {},
    communication_schedule: {},
    contact_id: "SC-444-555-666",
    processing_restricted_at: null,
    processing_restriction_reason: null,
  };

  t.after(async () => {
    pool.query = originalQuery;
    pool.connect = originalConnect;
    bcrypt.hash = originalHash;
    await stopTestServer(server);
  });

  pool.query = async (sql) => {
    const authentication = mockAuthenticationQuery(sql);
    if (authentication) return authentication;
    const statement = String(sql).replace(/\s+/gu, " ").trim();
    if (statement.includes("from family_memberships membership")
      && statement.includes("join accounts child")) {
      return queryResult([existingChild]);
    }
    throw new Error(`Requête SQL hors transaction inattendue : ${statement}`);
  };
  bcrypt.hash = async () => "nouveau-hash-enfant";
  pool.connect = async () => ({
    async query(sql, params = []) {
      const statement = String(sql).replace(/\s+/gu, " ").trim();
      if (statement === "begin" || statement === "commit" || statement === "rollback") {
        transactionEvents.push(statement);
        return queryResult();
      }
      if (statement.startsWith("update accounts set password_hash=$1")) {
        transactionEvents.push("update-child");
        assert.equal(params[0], "nouveau-hash-enfant");
        return queryResult([{ ...existingChild, password_hash: params[0] }]);
      }
      if (statement.includes("update auth_sessions") && statement.includes("where account_id=$1")) {
        transactionEvents.push("revoke-child-sessions");
        assert.equal(params[0], childId);
        assert.equal(params[2], "child_password_change_by_parent");
        return queryResult([], 4);
      }
      throw new Error(`Requête transactionnelle inattendue : ${statement}`);
    },
    release() {
      transactionEvents.push("release");
    },
  });

  const response = await fetch(`${baseUrl}/api/children/${childId}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ password: "nouveau-secret-enfant" }),
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.child.id, childId);
  assert.equal(payload.revokedSessions, 4);
  assert.deepEqual(transactionEvents, [
    "begin",
    "update-child",
    "revoke-child-sessions",
    "commit",
    "release",
  ]);
});
