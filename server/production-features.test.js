import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  resolveFeatureFlag,
  resolveProductionFeatures,
} from "./production-features.js";

test("les flux fournisseur sont fermés par défaut en production", () => {
  assert.deepEqual(resolveProductionFeatures({ NODE_ENV: "production" }), {
    rtc: false,
    webPush: false,
    nativePush: false,
    privacyAdministration: false,
  });
});

test("chaque flux exige une activation explicite en production", () => {
  assert.deepEqual(resolveProductionFeatures({
    NODE_ENV: "production",
    RTC_ENABLED: "true",
    WEB_PUSH_ENABLED: "1",
    NATIVE_PUSH_ENABLED: "yes",
    PRIVACY_ADMIN_ENABLED: "on",
  }), {
    rtc: true,
    webPush: true,
    nativePush: true,
    privacyAdministration: true,
  });
});

test("les valeurs ambiguës font échouer la configuration", () => {
  assert.throws(
    () => resolveFeatureFlag({ NODE_ENV: "production", RTC_ENABLED: "peut-être" }, "RTC_ENABLED"),
    /booléen explicite/u,
  );
});

test("les environnements de test conservent leurs fonctionnalités sauf désactivation explicite", () => {
  assert.deepEqual(resolveProductionFeatures({
    NODE_ENV: "test",
    WEB_PUSH_ENABLED: "false",
  }), {
    rtc: true,
    webPush: false,
    nativePush: true,
    privacyAdministration: true,
  });
});

test("le Blueprint de production désactive les flux non qualifiés sans demander leurs secrets", async () => {
  const blueprint = await readFile(new URL("../render.yaml", import.meta.url), "utf8");
  for (const key of [
    "RTC_ENABLED",
    "WEB_PUSH_ENABLED",
    "NATIVE_PUSH_ENABLED",
    "PRIVACY_ADMIN_ENABLED",
    "ADMIN_ANALYTICS_ENABLED",
  ]) {
    assert.match(blueprint, new RegExp(`key:\\s*${key}\\s*\\r?\\n\\s*value:\\s*\"false\"`, "u"));
  }
  for (const secretKey of [
    "RTC_TURN_API_TOKEN",
    "RTC_TURN_CREDENTIAL",
    "FCM_SERVICE_ACCOUNT_JSON",
    "FCM_SERVICE_ACCOUNT_JSON_BASE64",
    "APNS_PRIVATE_KEY",
    "APNS_PRIVATE_KEY_BASE64",
    "VAPID_PRIVATE_KEY",
    "PRIVACY_ADMIN_TOKEN",
  ]) {
    assert.doesNotMatch(blueprint, new RegExp(`key:\\s*${secretKey}\\b`, "u"));
  }
});

test("l’API refuse les routes fournisseur lorsque le drapeau est fermé", async () => {
  const source = await readFile(new URL("./index.js", import.meta.url), "utf8");
  assert.match(source, /app\.use\("\/api\/calls", requireRtcFeature\)/u);
  assert.match(source, /app\.use\("\/api\/conversations\/:id\/calls", requireRtcFeature\)/u);
  assert.match(source, /app\.use\("\/api\/native\/calls", requireRtcFeature\)/u);
  assert.match(source, /if \(!productionFeatures\.webPush \|\| !pushEnabled\)/u);
  assert.match(source, /if \(!productionFeatures\.nativePush\)/u);
  assert.match(source, /if \(!productionFeatures\.privacyAdministration\) return false/u);
});

test("le client masque les contrôles désactivés annoncés par l’API", async () => {
  const [serverSource, appSource, notificationSource] = await Promise.all([
    readFile(new URL("./index.js", import.meta.url), "utf8"),
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/NotificationSettings.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(serverSource, /features:\s*\{[\s\S]{0,180}rtc:\s*productionFeatures\.rtc/u);
  assert.match(appSource, /session\.features\?\.rtc === true \? openRealtimeCall : null/u);
  assert.match(appSource, /session\.features\?\.nativePush !== true/u);
  assert.match(notificationSource, /if \(!enabled\) return null/u);
});
