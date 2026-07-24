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

test("les conteneurs natifs refusent sauvegarde Android et transport en clair", async () => {
  const [androidManifest, iosInfo] = await Promise.all([
    readSource("android/app/src/main/AndroidManifest.xml"),
    readSource("ios/App/App/Info.plist"),
  ]);

  assert.match(androidManifest, /android:allowBackup="false"/u);
  assert.match(androidManifest, /android:usesCleartextTraffic="false"/u);
  assert.doesNotMatch(iosInfo, /NSAllowsArbitraryLoads/u);
  assert.doesNotMatch(iosInfo, /NSExceptionAllowsInsecureHTTPLoads/u);
});

test("iOS n’envoie un jeton d’action d’appel qu’à l’origine API et au chemin natif autorisés", async () => {
  const [iosCoordinator, iosInfo, androidClient] = await Promise.all([
    readSource("ios/App/App/NativeCallCoordinator.swift"),
    readSource("ios/App/App/Info.plist"),
    readSource("android/app/src/main/java/fr/secretclubhouse/app/nativecall/NativeCallActionClient.java"),
  ]);

  assert.match(iosInfo, /<key>NativeApiOrigin<\/key>\s*<string>https:\/\/secret-clubhouse\.onrender\.com<\/string>/u);
  assert.match(iosCoordinator, /object\(forInfoDictionaryKey: "NativeApiOrigin"\)/u);
  assert.match(iosCoordinator, /candidate\.scheme\?\.lowercased\(\) == "https"/u);
  assert.match(iosCoordinator, /originHost\.caseInsensitiveCompare\(candidateHost\) == \.orderedSame/u);
  assert.match(iosCoordinator, /\(origin\.port \?\? 443\) == \(candidate\.port \?\? 443\)/u);
  assert.match(iosCoordinator, /candidate\.path\.hasPrefix\("\/api\/native\/calls\/"\)/u);
  assert.ok(
    (iosCoordinator.match(/isTrustedNativeCallURL\(url\)/gu) ?? []).length >= 2,
    "Les actions POST et le suivi GET doivent revérifier l’URL avant d’ajouter le jeton.",
  );

  assert.match(androidClient, /origin\.getHost\(\)\.equalsIgnoreCase\(target\.getHost\(\)\)/u);
  assert.match(androidClient, /target\.getPath\(\)\.startsWith\("\/api\/native\/calls\/"\)/u);
});

test("la production ne distribue jamais l’APK de débogage du dépôt", async () => {
  const [indexSource, appSource] = await Promise.all([
    readSource("server/index.js"),
    readSource("src/App.jsx"),
  ]);

  assert.doesNotMatch(indexSource, /Secret-Clubhouse-debug\.apk/u);
  assert.doesNotMatch(indexSource, /\/downloads\/Secret-Clubhouse\.apk/u);
  assert.doesNotMatch(appSource, /\/downloads\/Secret-Clubhouse\.apk/u);
});
