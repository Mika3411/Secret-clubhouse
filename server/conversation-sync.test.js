import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  decodeMessagePageCursor,
  defaultMessagePageSize,
  encodeMessagePageCursor,
  maximumMessagePageSize,
  normalizeConversationMessageIds,
  normalizeConversationSyncCursor,
  normalizeMessagePageLimit,
} from "./conversation-sync.js";

const messageId = "11111111-1111-4111-8111-111111111111";

test("le curseur de pagination conserve l’ordre date et UUID", () => {
  const encoded = encodeMessagePageCursor({
    createdAt: "2026-07-24T12:34:56.789Z",
    id: messageId,
  });
  assert.ok(encoded);
  assert.deepEqual(decodeMessagePageCursor(encoded), {
    createdAt: "2026-07-24T12:34:56.789Z",
    id: messageId,
  });
  assert.equal(decodeMessagePageCursor("invalide"), false);
});

test("les limites de page et le curseur de synchronisation sont strictement bornés", () => {
  assert.equal(normalizeMessagePageLimit(), defaultMessagePageSize);
  assert.equal(normalizeMessagePageLimit("25"), 25);
  assert.equal(normalizeMessagePageLimit("10000"), maximumMessagePageSize);
  assert.equal(normalizeMessagePageLimit("0"), null);
  assert.equal(normalizeConversationSyncCursor("42"), "42");
  assert.equal(normalizeConversationSyncCursor("-1"), null);
  assert.equal(normalizeConversationSyncCursor("1.5"), null);
  assert.deepEqual(normalizeConversationMessageIds([messageId, messageId]), [messageId]);
  assert.equal(normalizeConversationMessageIds(["invalide"]), null);
});

test("la liste, la pagination et la synchronisation restent séparées", async () => {
  const [serverSource, clientSource, databaseSource] = await Promise.all([
    readFile(new URL("./index.js", import.meta.url), "utf8"),
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("./db.js", import.meta.url), "utf8"),
  ]);
  const listStart = serverSource.indexOf('app.get("/api/conversations",');
  const syncStart = serverSource.indexOf('app.get("/api/conversations/sync",');
  const listRoute = serverSource.slice(listStart, syncStart);

  assert.ok(listStart >= 0 && syncStart > listStart);
  assert.doesNotMatch(listRoute, /json_agg/u);
  assert.match(listRoute, /listConversationSummaries/u);
  assert.match(serverSource, /left join lateral[\s\S]{0,1600}limit 1/u);
  assert.match(serverSource, /app\.get\("\/api\/conversations\/:id\/messages"/u);
  assert.match(serverSource, /message\.sync_version>\$2::bigint/u);
  assert.match(serverSource, /message\.id=any\(\$3::uuid\[\]\)/u);
  assert.match(clientSource, /setInterval\(synchronizeConversationState,\s*15000\)/u);
  assert.doesNotMatch(clientSource, /setInterval\(refreshConversations,\s*15000\)/u);
  assert.match(databaseSource, /message_receipts_touch_sync_version/u);
  assert.match(databaseSource, /messages_conversation_sync_idx/u);
});
