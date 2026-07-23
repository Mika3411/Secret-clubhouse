import assert from "node:assert/strict";
import test from "node:test";

const testJwtSecret = "native-push-routes-secret-with-more-than-thirty-two-characters";
process.env.JWT_SECRET = testJwtSecret;
process.env.CONTENT_ENCRYPTION_KEY = "native-push-routes-content-key-with-at-least-32-bytes";

const [{ app }, { pool }] = await Promise.all([
  import("./index.js"),
  import("./db.js"),
]);

const accountId = "11111111-1111-4111-8111-111111111111";
const callId = "22222222-2222-4222-8222-222222222222";
const callerId = "33333333-3333-4333-8333-333333333333";
const conversationId = "44444444-4444-4444-8444-444444444444";
const authToken = Buffer.alloc(32, 7).toString("base64url");
const callActionToken = `nca_${Buffer.alloc(32, 5).toString("base64url")}`;

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

test("routes serveur des appareils et actions d’appel natives", async (t) => {
  const originalPoolQuery = pool.query;
  const originalPoolConnect = pool.connect;
  const { server, baseUrl } = await startTestServer();

  t.after(async () => {
    pool.query = originalPoolQuery;
    pool.connect = originalPoolConnect;
    await stopTestServer(server);
  });

  await t.test("valide, remplace et dissocie les jetons par installation", async () => {
    const clientQueries = [];
    pool.query = async (text, values = []) => {
      const statement = String(text);
      if (statement.includes("from auth_sessions session")) {
        return queryResult([{
          id: "55555555-5555-4555-8555-555555555555",
          account_id: accountId,
          client_type: "native",
          device_id: "device.android.test",
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          revoked_at: null,
          role: "parent",
        }]);
      }
      if (statement.includes("select processing_restricted_at,processing_restriction_reason from accounts")) {
        assert.deepEqual(values, [accountId]);
        return queryResult([{ processing_restricted_at: null, processing_restriction_reason: null }]);
      }
      if (statement.includes("from accounts account") && statement.includes("account_consent_preferences")) {
        assert.deepEqual(values, [accountId]);
        return queryResult([{
          id: accountId,
          role: "parent",
          age: null,
          subject_agreed_at: new Date().toISOString(),
          guardian_agreed_at: null,
        }]);
      }
      throw new Error(`Requête inattendue : ${statement}`);
    };
    const client = {
      async query(text, values = []) {
        clientQueries.push({ text: String(text), values });
        return queryResult();
      },
      release() {},
    };
    pool.connect = async () => client;

    const registration = await fetch(`${baseUrl}/api/push/native-token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
        "X-Secret-Clubhouse-Client": "native",
      },
      body: JSON.stringify({
        token: "fcm-registration-token-value-that-is-long-enough",
        platform: "android",
        tokenKind: "fcm",
        deviceId: "device.android.test",
      }),
    });
    assert.equal(registration.status, 204);
    const insert = clientQueries.find(({ text }) => text.includes("insert into native_push_tokens"));
    assert.ok(insert);
    assert.deepEqual(insert.values.slice(0, 5), [
      accountId,
      "android",
      "device.android.test",
      "fcm",
      "fcm-registration-token-value-that-is-long-enough",
    ]);

    pool.query = async (text, values = []) => {
      const statement = String(text);
      if (statement.includes("from auth_sessions session")) {
        return queryResult([{
          id: "55555555-5555-4555-8555-555555555555",
          account_id: accountId,
          client_type: "native",
          device_id: "device.android.test",
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          revoked_at: null,
          role: "parent",
        }]);
      }
      if (statement.includes("select processing_restricted_at,processing_restriction_reason from accounts")) {
        assert.deepEqual(values, [accountId]);
        return queryResult([{ processing_restricted_at: null, processing_restriction_reason: null }]);
      }
      if (statement.includes("select token_kind")) {
        assert.deepEqual(values, [accountId, "device.android.test"]);
        return queryResult([{ token_kind: "fcm" }]);
      }
      if (statement.includes("delete from native_push_tokens")) {
        assert.deepEqual(values, [accountId, "device.android.test"]);
        return { rows: [{ id: "token-row" }], rowCount: 1 };
      }
      throw new Error(`Requête inattendue : ${statement}`);
    };

    const status = await fetch(`${baseUrl}/api/push/native-token?deviceId=device.android.test`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "X-Secret-Clubhouse-Client": "native",
      },
    });
    assert.equal(status.status, 200);
    assert.deepEqual(await status.json(), { registered: true, tokenKinds: ["fcm"] });

    const deletion = await fetch(`${baseUrl}/api/push/native-token`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
        "X-Secret-Clubhouse-Client": "native",
      },
      body: JSON.stringify({ deviceId: "device.android.test" }),
    });
    assert.equal(deletion.status, 200);
    assert.deepEqual(await deletion.json(), { removed: 1 });
  });

  await t.test("refuse une action verrouillée sans jeton natif, sans accepter un JWT général", async () => {
    let queried = false;
    pool.connect = async () => {
      queried = true;
      throw new Error("La base ne doit pas être interrogée sans jeton d’action.");
    };
    const response = await fetch(`${baseUrl}/api/native/calls/${callId}/respond`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "accept" }),
    });
    assert.equal(response.status, 401);
    assert.equal(queried, false);
  });

  await t.test("accepte puis raccroche une seule fois malgré les replays natifs", async () => {
    let callStatus = "ringing";
    let acceptedAt = null;
    let endedAt = null;
    let consumedAction = null;
    let acceptUpdates = 0;
    let hangupUpdates = 0;
    const expiresAt = new Date(Date.now() + 30_000).toISOString();
    const controlExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const makeCall = () => ({
      id: callId,
      conversation_id: conversationId,
      caller_id: callerId,
      callee_id: accountId,
      call_type: "audio",
      status: callStatus,
      expires_at: expiresAt,
      answered_at: acceptedAt,
      ended_at: endedAt,
      updated_at: new Date().toISOString(),
      caller_name: "Appelant",
      caller_contact_id: "SC-111-222-333",
      caller_role: "parent",
      callee_name: "Destinataire",
      callee_contact_id: "SC-444-555-666",
      callee_role: "parent",
    });
    const client = {
      async query(text) {
        const statement = String(text).replace(/\s+/g, " ").trim();
        if (statement === "begin" || statement === "commit" || statement === "rollback") return queryResult();
        if (statement.includes("from native_call_action_tokens") && statement.includes("for update")) {
          return queryResult([{
            call_id: callId,
            account_id: accountId,
            expires_at: expiresAt,
            control_expires_at: controlExpiresAt,
            accepted_at: acceptedAt,
            consumed_action: consumedAction,
            consumed_at: consumedAction ? endedAt : null,
          }]);
        }
        if (statement.startsWith("select call.*")) return queryResult([makeCall()]);
        if (statement.includes("from conversation_members member") && statement.includes("account.role='child'")) return queryResult();
        if (statement.startsWith("update call_sessions set status='accepted'")) {
          callStatus = "accepted";
          acceptedAt = new Date().toISOString();
          acceptUpdates += 1;
          return queryResult();
        }
        if (statement.startsWith("update native_call_action_tokens set accepted_at")) return queryResult();
        if (statement.startsWith("update call_sessions set status='ended'")) {
          callStatus = "ended";
          endedAt = new Date().toISOString();
          hangupUpdates += 1;
          return queryResult();
        }
        if (statement.includes("consumed_action='hangup'")) {
          consumedAction = "hangup";
          return queryResult();
        }
        throw new Error(`Requête inattendue pendant l’acceptation native : ${statement}`);
      },
      release() {},
    };
    pool.connect = async () => client;

    const respond = () => fetch(`${baseUrl}/api/native/calls/${callId}/respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Call-Action-Token": callActionToken,
      },
      body: JSON.stringify({ action: "accept", actionToken: callActionToken }),
    });

    const first = await respond();
    assert.equal(first.status, 200, JSON.stringify(await first.clone().json()));
    const firstPayload = await first.json();
    assert.equal(firstPayload.call.status, "accepted");
    assert.equal(firstPayload.idempotent, false);

    const replay = await respond();
    assert.equal(replay.status, 200, JSON.stringify(await replay.clone().json()));
    const replayPayload = await replay.json();
    assert.equal(replayPayload.call.status, "accepted");
    assert.equal(replayPayload.idempotent, true);
    assert.equal(acceptUpdates, 1);

    const hangup = () => fetch(`${baseUrl}/api/native/calls/${callId}/respond/hangup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Call-Action-Token": callActionToken,
      },
      body: JSON.stringify({ actionToken: callActionToken }),
    });
    const firstHangup = await hangup();
    assert.equal(firstHangup.status, 200, JSON.stringify(await firstHangup.clone().json()));
    assert.equal((await firstHangup.json()).idempotent, false);
    const replayHangup = await hangup();
    assert.equal(replayHangup.status, 200, JSON.stringify(await replayHangup.clone().json()));
    assert.equal((await replayHangup.json()).idempotent, true);
    assert.equal(hangupUpdates, 1);
  });

  await t.test("transforme un accept tardif en appel manqué sans l’accepter", async () => {
    let callStatus = "ringing";
    let accepted = false;
    const expiresAt = new Date(Date.now() - 5_000).toISOString();
    const controlExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const makeCall = () => ({
      id: callId,
      conversation_id: conversationId,
      caller_id: callerId,
      callee_id: accountId,
      call_type: "audio",
      status: callStatus,
      expires_at: expiresAt,
      answered_at: null,
      ended_at: callStatus === "missed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
      caller_name: "Appelant",
      caller_contact_id: "SC-111-222-333",
      caller_role: "parent",
      callee_name: "Destinataire",
      callee_contact_id: "SC-444-555-666",
      callee_role: "parent",
    });
    const client = {
      async query(text) {
        const statement = String(text).replace(/\s+/g, " ").trim();
        if (statement === "begin" || statement === "commit" || statement === "rollback") return queryResult();
        if (statement.includes("from native_call_action_tokens") && statement.includes("for update")) {
          return queryResult([{
            call_id: callId,
            account_id: accountId,
            expires_at: expiresAt,
            control_expires_at: controlExpiresAt,
            accepted_at: null,
            consumed_action: null,
            consumed_at: null,
          }]);
        }
        if (statement.startsWith("select call.*")) return queryResult([makeCall()]);
        if (statement.startsWith("update call_sessions set status='missed'")) {
          callStatus = "missed";
          return queryResult();
        }
        if (statement.startsWith("update call_sessions set status='accepted'")) {
          accepted = true;
          return queryResult();
        }
        throw new Error(`Requête inattendue pendant l’expiration native : ${statement}`);
      },
      release() {},
    };
    pool.connect = async () => client;
    const response = await fetch(`${baseUrl}/api/native/calls/${callId}/respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Call-Action-Token": callActionToken,
      },
      body: JSON.stringify({ action: "accept", actionToken: callActionToken }),
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).call.status, "missed");
    assert.equal(accepted, false);
  });
});
