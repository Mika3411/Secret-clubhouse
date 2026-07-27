import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "conversation-alias-test-secret-with-more-than-32-bytes";

const [{ app }, { pool }] = await Promise.all([
  import("./index.js"),
  import("./db.js"),
]);

const queryResult = (rows = []) => ({ rows, rowCount: rows.length });

test("un enfant peut nommer un parent pour son seul espace familial", async (t) => {
  const childId = "11111111-1111-4111-8111-111111111111";
  const parentId = "22222222-2222-4222-8222-222222222222";
  const conversationId = "33333333-3333-4333-8333-333333333333";
  const originalPoolQuery = pool.query;
  const writes = [];

  pool.query = async (sql, params = []) => {
    const statement = String(sql).replace(/\s+/g, " ").trim();
    if (statement.includes("from auth_sessions session")) {
      return queryResult([{
        id: "44444444-4444-4444-8444-444444444444",
        account_id: childId,
        client_type: "native",
        device_id: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 300_000).toISOString(),
        revoked_at: null,
        role: "child",
      }]);
    }
    if (statement.includes("select processing_restricted_at,processing_restriction_reason from accounts")) {
      return queryResult([{ processing_restricted_at: null, processing_restriction_reason: null }]);
    }
    if (statement.includes("from accounts account") && statement.includes("account.role='child'")) {
      return queryResult([{
        id: childId,
        display_name: "Lina",
        status: "active",
        safety_settings: {},
        communication_schedule: {},
      }]);
    }
    if (statement.includes("from family_conversations family_conversation")) {
      assert.deepEqual(params, [conversationId, childId]);
      return queryResult([{ id: parentId, display_name: "Mickael" }]);
    }
    if (statement.startsWith("insert into account_contact_aliases")) {
      writes.push({ kind: "upsert", params });
      return queryResult();
    }
    if (statement.startsWith("delete from account_contact_aliases")) {
      writes.push({ kind: "delete", params });
      return queryResult();
    }
    throw new Error(`Requête inattendue pendant le test des petits noms : ${statement}`);
  };

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.once("error", reject);
  });
  t.after(async () => {
    pool.query = originalPoolQuery;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const token = Buffer.alloc(32, 7).toString("base64url");
  const rename = (alias) => fetch(`${baseUrl}/api/conversations/${conversationId}/contact-alias`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Secret-Clubhouse-Client": "native",
    },
    body: JSON.stringify({ alias }),
  });

  const renamedResponse = await rename("  Papou  ");
  assert.equal(renamedResponse.status, 200);
  assert.deepEqual((await renamedResponse.json()).conversation, {
    id: conversationId,
    name: "Papou",
    canonicalName: "Mickael",
    contactAlias: "Papou",
  });
  assert.deepEqual(writes[0], {
    kind: "upsert",
    params: [childId, parentId, "Papou"],
  });

  const restoredResponse = await rename("mickael");
  assert.equal(restoredResponse.status, 200);
  assert.deepEqual((await restoredResponse.json()).conversation, {
    id: conversationId,
    name: "Mickael",
    canonicalName: "Mickael",
    contactAlias: null,
  });
  assert.deepEqual(writes[1], {
    kind: "delete",
    params: [childId, parentId],
  });
});
