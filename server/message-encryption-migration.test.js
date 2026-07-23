import test from "node:test";
import assert from "node:assert/strict";
import { createContentCipher } from "./content-encryption.js";
import { decryptMessageContent } from "./message-content.js";
import { migrateLegacyMessageContent } from "./message-encryption-migration.js";

test("le backfill remplace le legacy par du ciphertext et efface les colonnes en clair", async () => {
  const cipher = createContentCipher({
    CONTENT_ENCRYPTION_KEY: "migration-test-content-key-with-at-least-thirty-two-bytes",
  });
  const legacyRows = [{
    id: "11111111-1111-4111-8111-111111111111",
    conversation_id: "22222222-2222-4222-8222-222222222222",
    sender_id: "33333333-3333-4333-8333-333333333333",
    body: "message historique privé",
    media_name: null,
    media_type: null,
    media_data: null,
    body_ciphertext: null,
    media_name_ciphertext: null,
    media_type_ciphertext: null,
    media_ciphertext: null,
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
          if (statement.startsWith("select id,conversation_id")) {
            const row = legacyRows.shift();
            return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
          }
          if (statement.startsWith("update messages")) {
            updates.push(params);
            return { rows: [], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        },
        release() {},
      };
    },
  };

  const migrated = await migrateLegacyMessageContent(pool, {
    cipher,
    logger: { info() {} },
  });
  assert.equal(migrated, 1);
  assert.equal(updates.length, 1);
  assert.equal(updates[0][0], "11111111-1111-4111-8111-111111111111");
  assert.doesNotMatch(String(updates[0][1]), /historique privé/);
  assert.equal(updates[0][5], 1);
  assert.equal(updates[0][6], cipher.activeKeyId);
  assert.ok(statements.filter((statement) => statement === "commit").length >= 2);
  assert.ok(
    statements.some((statement) => statement.includes("content_encryption_key_id is distinct from $1")),
  );

  const encryptedRow = {
    id: updates[0][0],
    conversation_id: "22222222-2222-4222-8222-222222222222",
    sender_id: "33333333-3333-4333-8333-333333333333",
    body: null,
    media_name: null,
    media_type: null,
    media_data: null,
    body_ciphertext: updates[0][1],
    media_name_ciphertext: updates[0][2],
    media_type_ciphertext: updates[0][3],
    media_ciphertext: updates[0][4],
    content_encryption_version: updates[0][5],
    content_encryption_key_id: updates[0][6],
  };
  assert.equal(decryptMessageContent(encryptedRow, cipher).body, "message historique privé");
});
