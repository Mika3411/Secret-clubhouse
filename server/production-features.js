const enabledValues = new Set(["1", "true", "yes", "on"]);
const disabledValues = new Set(["0", "false", "no", "off"]);

export function resolveFeatureFlag(env, key, {
  productionDefault = false,
  nonProductionDefault = true,
} = {}) {
  const raw = String(env[key] ?? "").trim().toLowerCase();
  if (!raw) return env.NODE_ENV === "production" ? productionDefault : nonProductionDefault;
  if (enabledValues.has(raw)) return true;
  if (disabledValues.has(raw)) return false;
  throw new Error(`${key} doit être un booléen explicite (true ou false).`);
}

export function resolveProductionFeatures(env = process.env) {
  return Object.freeze({
    rtc: resolveFeatureFlag(env, "RTC_ENABLED"),
    webPush: resolveFeatureFlag(env, "WEB_PUSH_ENABLED"),
    nativePush: resolveFeatureFlag(env, "NATIVE_PUSH_ENABLED"),
    privacyAdministration: resolveFeatureFlag(env, "PRIVACY_ADMIN_ENABLED"),
  });
}

function hasConfiguredTurnUrl(value) {
  return String(value ?? "")
    .split(",")
    .some((url) => /^(?:turn|turns):/u.test(url.trim()));
}

function hasConfiguredTurnInJson(value) {
  if (!String(value ?? "").trim()) return false;
  try {
    const servers = JSON.parse(value);
    return Array.isArray(servers) && servers.some((server) => {
      const urls = Array.isArray(server?.urls) ? server.urls : [server?.urls];
      return urls.some((url) => /^(?:turn|turns):/u.test(String(url ?? "").trim()))
        && Boolean(String(server?.username ?? "").trim())
        && Boolean(String(server?.credential ?? "").trim());
    });
  } catch {
    return false;
  }
}

export function assertProductionFeatureConfiguration(features, env = process.env) {
  if (env.NODE_ENV !== "production" || features?.rtc !== true) return;

  const hasManagedTurn = Boolean(
    String(env.RTC_TURN_KEY_ID ?? "").trim()
    && String(env.RTC_TURN_API_TOKEN ?? "").trim(),
  );
  const hasStaticTurn = Boolean(
    hasConfiguredTurnUrl(env.RTC_TURN_URLS)
    && String(env.RTC_TURN_USERNAME ?? "").trim()
    && String(env.RTC_TURN_CREDENTIAL ?? "").trim(),
  );

  if (!hasManagedTurn && !hasStaticTurn && !hasConfiguredTurnInJson(env.RTC_ICE_SERVERS_JSON)) {
    throw new Error("RTC_ENABLED exige une configuration TURN complète en production.");
  }
}
