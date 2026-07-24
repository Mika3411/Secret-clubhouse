import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./index.js", import.meta.url), "utf8");
const routeLines = source
  .split(/\r?\n/u)
  .filter((line) => /^app\.(?:get|post|put|patch|delete)\("\/api\//u.test(line.trim()));

const publicRoutes = new Set([
  'app.get("/api/health"',
  'app.get("/api/privacy/contact"',
  'app.post("/api/auth/register"',
  'app.post("/api/auth/register-with-invite"',
  'app.post("/api/auth/login"',
  'app.post("/api/family/invitations/preview"',
]);

const speciallyProtectedRoutes = new Set([
  'app.get("/api/privacy/admin/requests"',
  'app.patch("/api/privacy/admin/requests/:id"',
  'app.get("/api/native/calls/:callId/status"',
  'app.post("/api/native/calls/:callId/respond"',
  'app.post("/api/native/calls/:callId/respond/:nativeAction"',
]);

test("toute route API est authentifiée ou explicitement classée", () => {
  assert.ok(routeLines.length >= 50);
  for (const line of routeLines) {
    const trimmed = line.trim();
    const prefix = [...publicRoutes, ...speciallyProtectedRoutes]
      .find((candidate) => trimmed.startsWith(candidate));
    if (prefix) continue;
    assert.match(trimmed, /\brequireAuth\b/u, `route sans garde explicite : ${trimmed}`);
  }
});

test("les routes spéciales utilisent leurs secrets bornés et révocables", () => {
  assert.match(source, /function privacyAdminAuthorized\(req\)[\s\S]{0,500}timingSafeEqual/u);
  assert.match(
    source,
    /app\.get\("\/api\/native\/calls\/:callId\/status"[\s\S]{0,900}hashCallActionToken/u,
  );
  assert.match(
    source,
    /async function respondToNativeCall\(req, res\)[\s\S]{0,1400}hashCallActionToken/u,
  );
});

test("les médias sont bornés avant lecture et les fichiers temporaires sont supprimés", () => {
  assert.match(source, /const maxMediaRequestBytes = 30 \* 1024 \* 1024/u);
  assert.match(source, /limits:\s*\{[\s\S]{0,180}fileSize:\s*maxMediaFileBytes[\s\S]{0,180}files:\s*6/u);
  assert.match(
    source,
    /requireBoundedMediaRequest,\s*upload\.array\("media", 6\)/u,
  );
  assert.match(source, /fs\.rm\(filePath,\s*\{\s*force:\s*true\s*\}\)/u);
});
