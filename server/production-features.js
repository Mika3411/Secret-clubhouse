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
