import test from "node:test";
import assert from "node:assert/strict";
import { createContentCipher } from "./content-encryption.js";
import { decryptCallSignal } from "./call-signal-content.js";
import { migrateLegacyCallSignals } from "./call-signal-encryption-migration.js";

test("le backfill chiffre un signal legacy et efface son JSON en clair", async () => {
  const cipher = createContentCipher({
    CONTENT_ENCRYPTION_KEY: "call-signal-migration-key-with-at-least-32-bytes",
  });
  const legacyRows = [{
    id: "42",
    encryption_context_id: "11111111-1111-4111-8111-111111111111",
    call_id: "22222222-2222-4222-8222-222222222222",
    sender_id: "33333333-3333-4333-8333-333333333333",
    recipient_id: "44444444-4444-4444-8444-444444444444",
    signal_type: "ice",
    payload: { candidate: "candidate private 192.0.2.30" },
    payload_ciphertext: null,
    content_encryption_version: 0,
    content_encryption_key_id: null,
  }];
  const updates = [];
  const statements = [];
  const pool = {
    async connect() {
      return {
        async query(sql, params = []) {
          const statement = String(sql).replace(/\s+/g, " ").trim();
          statements.push(statement);
          if (statement.startsWith("select id,encryption_context_id")) {
            const row = legacyRows.shift();
            return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
          }
          if (statement.startsWith("update call_signals")) {
            updates.push(params);
            return { rows: [], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        },
        release() {},
      };
    },
  };

  assert.equal(await migrateLegacyCallSignals(pool, {
    cipher,
    logger: { info() {} },
  }), 1);
  assert.equal(updates.length, 1);
  assert.doesNotMatch(updates[0][1], /192\.0\.2\.30/u);
  assert.equal(updates[0][2], 1);
  assert.equal(updates[0][3], cipher.activeKeyId);
  assert.ok(
    statements.some((statement) => statement.includes("content_encryption_key_id is distinct from $1")),
  );

  assert.deepEqual(
    decryptCallSignal({
      ...legacyRows[0],
      id: updates[0][0],
      encryption_context_id: "11111111-1111-4111-8111-111111111111",
      call_id: "22222222-2222-4222-8222-222222222222",
      sender_id: "33333333-3333-4333-8333-333333333333",
      recipient_id: "44444444-4444-4444-8444-444444444444",
      signal_type: "ice",
      payload: null,
      payload_ciphertext: updates[0][1],
      content_encryption_version: updates[0][2],
      content_encryption_key_id: updates[0][3],
    }, cipher).payload,
    { candidate: "candidate private 192.0.2.30" },
  );
});
