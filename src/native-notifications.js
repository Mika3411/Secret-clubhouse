import { Capacitor, registerPlugin } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

export { Capacitor, PushNotifications };

export const nativeInstallationKey = "secret-clubhouse-native-installation";

export const nativeApnsEnvironmentKey = "secret-clubhouse-apns-environment";

export const nativePushOptInKey = "secret-clubhouse-native-push-opt-in";

export const NativeCallNotifications = registerPlugin("NativeCallNotifications");

export const endNativeSystemCall = async (callId, status = "ended") => {
  if (!Capacitor.isNativePlatform() || !callId) return;
  const method = Capacitor.getPlatform() === "ios" ? "reportCallEnded" : "endNativeCall";
  await NativeCallNotifications[method]({ callId, status }).catch(() => undefined);
};

export const registerForNativePushToken = async () => {
  let resolveToken;
  let rejectToken;
  let registeredHandle;
  let failedHandle;
  let timeout;
  const tokenPromise = new Promise((resolve, reject) => {
    resolveToken = resolve;
    rejectToken = reject;
  });
  try {
    registeredHandle = await PushNotifications.addListener("registration", resolveToken);
    failedHandle = await PushNotifications.addListener("registrationError", (registrationError) => {
      rejectToken(new Error(registrationError.error || "L’inscription aux notifications a échoué."));
    });
    timeout = window.setTimeout(() => {
      rejectToken(new Error("Le service de notifications du téléphone n’a pas répondu."));
    }, 12_000);
    await PushNotifications.register();
    return await tokenPromise;
  } finally {
    window.clearTimeout(timeout);
    await Promise.allSettled([
      registeredHandle?.remove(),
      failedHandle?.remove(),
    ]);
  }
};

export const getNativeInstallationId = () => {
  let installationId = localStorage.getItem(nativeInstallationKey);
  if (!installationId) {
    installationId = globalThis.crypto?.randomUUID?.() ?? `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(nativeInstallationKey, installationId);
  }
  return installationId;
};

export const nativeTokenDetails = (platform = Capacitor.getPlatform(), overrides = {}) => ({
  platform,
  tokenKind: platform === "ios" ? "apns_alert" : "fcm",
  deviceId: getNativeInstallationId(),
  ...(platform === "ios" ? {
    topic: "fr.secretclubhouse.app",
    ...(localStorage.getItem(nativeApnsEnvironmentKey) ? { environment: localStorage.getItem(nativeApnsEnvironmentKey) } : {}),
  } : {}),
  ...overrides,
});
