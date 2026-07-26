import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readSource = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("les routes de gestion des familles exigent la session et l’administrateur nommé", async () => {
  const indexSource = await readSource("server/index.js");
  assert.match(
    indexSource,
    /app\.get\("\/api\/admin\/families", requireAuth, requirePlatformAdministrator/u,
  );
  assert.match(
    indexSource,
    /app\.patch\("\/api\/admin\/accounts\/:id\/status", requireAuth, requirePlatformAdministrator/u,
  );
  assert.match(indexSource, /createHmac\("sha256", jwtSecret\)/u);
  assert.match(indexSource, /eventType: "admin\.families\.read"/u);
  assert.match(indexSource, /eventType: "admin\.account\.status"/u);
});

test("une suspension administrative coupe les sessions, la présence et les appels", async () => {
  const [serviceSource, presenceSource] = await Promise.all([
    readSource("server/services/admin-family-service.js"),
    readSource("server/services/presence-service.js"),
  ]);
  assert.match(serviceSource, /update auth_sessions[\s\S]*administrative_suspension/u);
  assert.match(serviceSource, /update call_sessions[\s\S]*status in \('ringing','accepted'\)/u);
  assert.match(serviceSource, /delete from call_signals/u);
  assert.match(serviceSource, /delete from presence/u);
  assert.match(serviceSource, /target\.id === administratorId \|\| target\.protected_administrator/u);
  assert.match(presenceSource, /row\.admin_suspended_at == null/u);
});

test("aucune notification n’est remise à un compte suspendu", async () => {
  const [indexSource, nativePushSource] = await Promise.all([
    readSource("server/index.js"),
    readSource("server/notifications/native-push.js"),
  ]);
  assert.ok(
    (indexSource.match(/account\.admin_suspended_at is null/gu) ?? []).length >= 2,
    "Les notifications web directes et de conversation doivent exclure les comptes suspendus.",
  );
  assert.ok(
    (nativePushSource.match(/account\.admin_suspended_at is null/gu) ?? []).length >= 2,
    "Les notifications natives directes et de conversation doivent exclure les comptes suspendus.",
  );
});
