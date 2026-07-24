import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertProductionFeatureConfiguration,
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

test("le Blueprint active RTC avec des secrets Render et laisse les autres flux non qualifiés fermés", async () => {
  const blueprint = await readFile(new URL("../render.yaml", import.meta.url), "utf8");
  assert.match(blueprint, /key:\s*RTC_ENABLED\s*\r?\n\s*value:\s*"true"/u);
  assert.match(blueprint, /key:\s*RTC_STUN_URLS\s*\r?\n\s*value:\s*stun:stun\.cloudflare\.com:3478/u);
  assert.match(blueprint, /key:\s*WEB_PUSH_ENABLED\s*\r?\n\s*value:\s*"true"/u);
  for (const key of [
    "RTC_TURN_KEY_ID",
    "RTC_TURN_API_TOKEN",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
  ]) {
    assert.match(blueprint, new RegExp(`key:\\s*${key}\\s*\\r?\\n\\s*sync:\\s*false`, "u"));
  }
  for (const key of [
    "NATIVE_PUSH_ENABLED",
    "PRIVACY_ADMIN_ENABLED",
    "ADMIN_ANALYTICS_ENABLED",
  ]) {
    assert.match(blueprint, new RegExp(`key:\\s*${key}\\s*\\r?\\n\\s*value:\\s*\"false\"`, "u"));
  }
  for (const secretKey of [
    "RTC_TURN_CREDENTIAL",
    "FCM_SERVICE_ACCOUNT_JSON",
    "FCM_SERVICE_ACCOUNT_JSON_BASE64",
    "APNS_PRIVATE_KEY",
    "APNS_PRIVATE_KEY_BASE64",
    "PRIVACY_ADMIN_TOKEN",
  ]) {
    assert.doesNotMatch(blueprint, new RegExp(`key:\\s*${secretKey}\\b`, "u"));
  }
});

test("RTC échoue fermé en production sans relais TURN complet", () => {
  const features = resolveProductionFeatures({ NODE_ENV: "production", RTC_ENABLED: "true" });
  assert.throws(
    () => assertProductionFeatureConfiguration(features, { NODE_ENV: "production" }),
    /configuration TURN complète/u,
  );
  assert.doesNotThrow(() => assertProductionFeatureConfiguration(features, {
    NODE_ENV: "production",
    RTC_TURN_KEY_ID: "turn-key-id",
    RTC_TURN_API_TOKEN: "turn-api-token",
  }));
  assert.doesNotThrow(() => assertProductionFeatureConfiguration(features, {
    NODE_ENV: "production",
    RTC_TURN_URLS: "turns:turn.example.test:5349",
    RTC_TURN_USERNAME: "temporary-user",
    RTC_TURN_CREDENTIAL: "temporary-password",
  }));
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

test("le client suit le drapeau RTC et conserve les deux actions d’appel", async () => {
  const [serverSource, appSource, conversationSource, notificationSource] = await Promise.all([
    readFile(new URL("./index.js", import.meta.url), "utf8"),
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/ConversationsSpace.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/NotificationSettings.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(serverSource, /features:\s*\{[\s\S]{0,180}rtc:\s*productionFeatures\.rtc/u);
  assert.match(appSource, /session\.features\?\.rtc === true \? openRealtimeCall : null/u);
  assert.match(conversationSource, /onStartCall\(selectedThread,\s*"audio"\)/u);
  assert.match(conversationSource, /onStartCall\(selectedThread,\s*"video"\)/u);
  assert.match(appSource, /session\.features\?\.nativePush !== true/u);
  assert.match(notificationSource, /if \(!enabled\) return null/u);
});
