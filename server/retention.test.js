import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { retentionPolicy } from "./retention-policy.js";
import { purgeExpiredData } from "./retention.js";

test("la politique de conservation couvre toutes les catégories attendues", () => {
  assert.deepEqual(retentionPolicy, {
    accountInactivityDays: 730,
    textMessageDays: 365,
    mediaMessageDays: 90,
    authSessionHours: 12,
    revokedSessionPurgeHours: 24,
    loginRateLimitHours: 48,
    incomingCallTimeoutSeconds: 45,
    callSignalHours: 24,
    nativeCallActionControlHours: 2,
    nativeCallActionPurgeDelayHours: 24,
    nativeCallActionMaximumHours: 26,
    acceptedCallMaximumHours: 24,
    callMetadataDays: 90,
    presenceHours: 24,
    typingStateSeconds: 6,
    pushRegistrationDays: 180,
    familyInvitationValidityDays: 7,
    familyInvitationRecordDays: 90,
    contactRequestPendingDays: 30,
    contactRequestRecordDays: 180,
    gamePendingDays: 30,
    gameRecordDays: 180,
    securityEventDays: 365,
    legalEventDays: 1825,
    rightsRequestRecordDays: 1825,
    erasureTombstoneDays: 30,
    retentionRunDays: 365,
    backupDays: 7,
  });
});

test("le Cron Render exécute la purge quotidienne à 03:17 UTC", async () => {
  const renderConfiguration = await readFile(new URL("../render.yaml", import.meta.url), "utf8");
  assert.match(renderConfiguration, /name:\s*secret-clubhouse-retention/u);
  assert.match(renderConfiguration, /schedule:\s*"17 3 \* \* \*"/u);
  assert.match(renderConfiguration, /startCommand:\s*npm run retention:purge/u);
});

test("la purge est transactionnelle, sérialisée et journalisée", async () => {
  const statements = [];
  const client = {
    async query(sql) {
      const statement = String(sql).replace(/\s+/g, " ").trim();
      statements.push(statement);
      if (statement.includes("retention:inactive-families")) return { rows: [], rowCount: 0 };
      if (statement.includes("retention:overdue-privacy-requests")) return { rows: [{ count: 0 }], rowCount: 1 };
      return { rows: [], rowCount: statement.startsWith("delete") ? 1 : 0 };
    },
  };
  const executor = {
    async connect() {
      return { ...client, release() { statements.push("release"); } };
    },
  };

  const result = await purgeExpiredData(executor, { now: new Date("2026-07-23T12:00:00.000Z") });

  assert.equal(statements[0], "begin");
  assert.match(statements[1], /pg_advisory_xact_lock/);
  assert.ok(statements.some((statement) => statement.includes("retention:messages")));
  assert.ok(statements.some((statement) => statement.includes("retention:auth-sessions")));
  assert.ok(statements.some((statement) => statement.includes("retention:security-events")));
  assert.ok(statements.some((statement) => statement.includes("retention:legal-events")));
  assert.ok(statements.some((statement) => statement.includes("retention:privacy-requests")));
  assert.ok(statements.some((statement) => statement.includes("retention:erasure-tombstones")));
  assert.ok(statements.some((statement) => statement.includes("retention:overdue-privacy-requests")));
  assert.ok(statements.some((statement) => statement.includes("retention:orphan-accounts")));
  assert.ok(statements.some((statement) => statement.includes("retention:record-run")));
  assert.equal(statements.at(-2), "commit");
  assert.equal(statements.at(-1), "release");
  assert.equal(result.startedAt, "2026-07-23T12:00:00.000Z");
});

test("la purge annule la transaction en cas d’échec", async () => {
  const statements = [];
  const client = {
    async query(sql) {
      const statement = String(sql).replace(/\s+/g, " ").trim();
      statements.push(statement);
      if (statement.includes("retention:presence")) throw new Error("database unavailable");
      return { rows: [], rowCount: 0 };
    },
    release() {
      statements.push("release");
    },
  };

  await assert.rejects(
    purgeExpiredData({ connect: async () => client }),
    /database unavailable/,
  );
  assert.ok(statements.includes("rollback"));
  assert.equal(statements.at(-1), "release");
});
