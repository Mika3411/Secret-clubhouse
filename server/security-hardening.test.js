import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readSource = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("aucun client ou script PostgreSQL ne réintroduit les réglages signalés", async () => {
  const [apiSource, dbSource, databaseConfigSource, recoverySource] = await Promise.all([
    readSource("src/api.js"),
    readSource("server/db.js"),
    readSource("server/database-config.js"),
    readSource("server/reapply-erasure-tombstones.js"),
  ]);

  assert.doesNotMatch(apiSource, /(?:local|session)Storage\.(?:getItem|setItem)\s*\(/u);
  assert.match(apiSource, /let nativeSessionToken = null/u);
  assert.match(apiSource, /credentials:\s*isNativeClient\s*\?\s*"omit"\s*:\s*"include"/u);
  assert.doesNotMatch(
    `${dbSource}\n${databaseConfigSource}\n${recoverySource}`,
    /rejectUnauthorized\s*:\s*false/u,
  );
  assert.match(dbSource, /createDatabasePoolConfig\(process\.env\)/u);
  assert.match(recoverySource, /createDatabasePoolConfig/u);
});

test("les écritures sensibles sont chiffrées et les migrations précèdent l’écoute", async () => {
  const indexSource = await readSource("server/index.js");

  assert.match(indexSource, /insert into messages\([\s\S]*body_ciphertext/u);
  assert.match(indexSource, /media_ciphertext[\s\S]*content_encryption_key_id/u);
  assert.match(indexSource, /encryptCallSignal\(\{/u);
  assert.match(
    indexSource,
    /insert into call_signals\([\s\S]*payload_ciphertext[\s\S]*content_encryption_key_id/u,
  );
  assert.doesNotMatch(
    indexSource,
    /insert into call_signals\([^)]*\bpayload\b[^)]*\)[\s\S]{0,120}\$5::jsonb/u,
  );

  const initializePosition = indexSource.indexOf("await initializeDatabase();");
  const messageMigrationPosition = indexSource.indexOf(
    "await migrateLegacyMessageContent(pool",
    initializePosition,
  );
  const signalMigrationPosition = indexSource.indexOf(
    "await migrateLegacyCallSignals(pool",
    initializePosition,
  );
  const listenPosition = indexSource.indexOf("app.listen(", initializePosition);
  assert.ok(initializePosition >= 0);
  assert.ok(messageMigrationPosition > initializePosition);
  assert.ok(signalMigrationPosition > messageMigrationPosition);
  assert.ok(listenPosition > signalMigrationPosition);
});

test("la pause enfant coupe les appels et la signalisation revérifie la politique", async () => {
  const indexSource = await readSource("server/index.js");

  assert.match(
    indexSource,
    /app\.post\("\/api\/calls\/:callId\/signals", requireAuth, requireActiveChild/u,
  );
  assert.match(
    indexSource,
    /assertConversationPolicy\([\s\S]{0,240}call\.call_type === "video" \? "video" : "calls"/u,
  );
  assert.match(
    indexSource,
    /if \(profile\.status === "paused"\)[\s\S]{0,900}update call_sessions[\s\S]{0,900}delete from call_signals/u,
  );
});
