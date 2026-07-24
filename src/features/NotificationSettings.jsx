import { useEffect, useState } from "react";
import { Bell } from "@phosphor-icons/react/Bell";
import { Capacitor, PushNotifications, NativeCallNotifications, getNativeInstallationId, nativeApnsEnvironmentKey, nativeInstallationKey, nativePushOptInKey, nativeTokenDetails, registerForNativePushToken } from "../native-notifications";
import { api } from "../api";
import { notificationConsentCopy } from "../legal-framework";
import "../styles/notifications.css";

export function PushNotificationButton({ features }) {
  const native = Capacitor.isNativePlatform();
  const enabled = native ? features?.nativePush === true : features?.webPush === true;
  const isWindowsWeb = !native && /Windows/i.test(navigator.userAgent);
  const supported = enabled && (native || ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window));
  const [status, setStatus] = useState(supported ? "checking" : "unsupported");
  const [consent, setConsent] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supported) return undefined;
    let active = true;

    const refreshStatus = async () => {
      try {
        const consentResult = await api.notificationConsent();
        if (!active) return;
        setConsent(consentResult.consent);
        if (!consentResult.consent.active) {
          if (!native) {
            const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
              await api.unsubscribePush(subscription.endpoint).catch(() => undefined);
              await subscription.unsubscribe().catch(() => undefined);
            }
          }
          setStatus(consentResult.consent.subjectAgreed && consentResult.consent.requiresGuardian ? "awaiting-parent" : "disabled");
          return;
        }

        if (native) {
          const { receive } = await PushNotifications.checkPermissions();
          if (!active) return;
          if (receive === "denied") {
            setStatus("denied");
            return;
          }
          if (receive !== "granted" || localStorage.getItem(nativePushOptInKey) === "false") {
            setStatus("disabled");
            return;
          }
          const registration = await api.nativePushStatus(getNativeInstallationId()).catch(() => ({ registered: false }));
          if (active) setStatus(registration.registered ? "enabled" : "disabled");
          return;
        }

        const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
        await registration.update().catch(() => undefined);
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) await api.subscribePush(subscription.toJSON());
        if (active) setStatus(subscription ? "enabled" : Notification.permission === "denied" ? "denied" : "disabled");
      } catch (refreshError) {
        if (active) {
          setError(refreshError.message || "Le choix de notifications ne peut pas être vérifié.");
          setStatus("disabled");
        }
      }
    };

    const handleNativeSync = () => { void refreshStatus(); };
    window.addEventListener("secretclubhouse:native-push-synced", handleNativeSync);
    void refreshStatus();
    return () => {
      active = false;
      window.removeEventListener("secretclubhouse:native-push-synced", handleNativeSync);
    };
  }, [native, supported]);

  const togglePush = async () => {
    setError("");
    try {
      if (status === "enabled" || status === "awaiting-parent") {
        if (native) {
          await api.deleteNativePushToken({ deviceId: getNativeInstallationId() });
          await PushNotifications.unregister();
          localStorage.setItem(nativePushOptInKey, "false");
        } else {
          const registration = await navigator.serviceWorker.ready;
          const current = await registration.pushManager.getSubscription();
          if (current) {
            await api.unsubscribePush(current.endpoint);
            await current.unsubscribe();
          }
        }
        const result = await api.setNotificationConsent(false);
        setConsent(result.consent);
        setStatus("disabled");
        return;
      }

      const consentResult = await api.setNotificationConsent(true);
      setConsent(consentResult.consent);
      if (!consentResult.consent.active) {
        setStatus("awaiting-parent");
        return;
      }

      if (native) {
        const permission = await PushNotifications.requestPermissions();
        if (permission.receive !== "granted") {
          await api.setNotificationConsent(false).catch(() => undefined);
          setStatus("denied");
          return;
        }
        const platform = Capacitor.getPlatform();
        const pendingState = platform === "ios"
          ? await NativeCallNotifications.getPendingState().catch(() => ({}))
          : {};
        if (pendingState.deviceId) localStorage.setItem(nativeInstallationKey, String(pendingState.deviceId));
        if (pendingState.environment) localStorage.setItem(nativeApnsEnvironmentKey, String(pendingState.environment));
        const registration = await registerForNativePushToken();
        await api.saveNativePushToken(registration.value, nativeTokenDetails(platform));
        if (platform === "ios") {
          if (pendingState.voipToken) {
            await api.saveNativePushToken(pendingState.voipToken, nativeTokenDetails("ios", {
              tokenKind: "apns_voip",
              ...(pendingState.deviceId ? { deviceId: String(pendingState.deviceId) } : {}),
              environment: pendingState.environment,
              topic: pendingState.topic,
            }));
          }
        }
        localStorage.setItem(nativePushOptInKey, "true");
        setStatus("enabled");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        await api.setNotificationConsent(false).catch(() => undefined);
        setStatus("denied");
        return;
      }
      const { publicKey } = await api.pushPublicKey();
      const padding = "=".repeat((4 - publicKey.length % 4) % 4);
      const base64 = (publicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
      const applicationServerKey = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      await api.subscribePush(subscription.toJSON());
      setStatus("enabled");
    } catch (pushError) {
      setError(pushError.message || "Impossible d’activer les notifications.");
    }
  };

  const statusText = status === "enabled"
    ? isWindowsWeb ? "Activées dans Windows, même lorsque l’application est fermée" : "Activées même lorsque l’application est fermée"
    : status === "awaiting-parent"
      ? "Ton accord est enregistré · l’accord du parent manque encore"
    : status === "denied"
      ? isWindowsWeb ? "Bloquées dans les paramètres de notifications Windows ou du navigateur" : "Bloquées dans les réglages du téléphone"
      : status === "unsupported"
        ? "Non disponibles sur ce navigateur"
        : isWindowsWeb ? "Recevoir les messages et demandes dans Windows" : "Recevoir les nouveaux messages en veille";

  if (!enabled) return null;

  return (
    <div className="push-setting">
      <button type="button" onClick={togglePush} disabled={status === "checking" || status === "unsupported" || status === "denied"}>
        <Bell size={20} weight="fill" />
        <span><strong>{isWindowsWeb ? "Notifications Windows" : "Notifications et son système"}</strong><small>{statusText}</small></span>
        <span className={`toggle ${status === "enabled" ? "is-on" : ""}`} aria-hidden="true"><span /></span>
      </button>
      <small className="push-setting__legal">{consent?.role === "child" ? notificationConsentCopy.child : notificationConsentCopy.parent} {notificationConsentCopy.systemPermission}</small>
      {error && <small className="push-setting__error" role="alert">{error}</small>}
      {/iPhone|iPad|iPod/.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches && <small className="push-setting__hint">Sur iPhone/iPad, ajoutez d’abord Secret Clubhouse à l’écran d’accueil.</small>}
    </div>
  );
}

export function ChildNotificationConsentSetting({ child }) {
  const [consent, setConsent] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setConsent(null);
    setError("");
    api.childNotificationConsent(child.id)
      .then((result) => { if (active) setConsent(result.consent); })
      .catch((consentError) => { if (active) setError(consentError.message); });
    return () => { active = false; };
  }, [child.id]);

  const toggleGuardianConsent = async () => {
    if (!consent || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.setChildNotificationConsent(child.id, !consent.guardianAgreed);
      setConsent(result.consent);
    } catch (consentError) {
      setError(consentError.message || "L’accord parental n’a pas pu être enregistré.");
    } finally {
      setBusy(false);
    }
  };

  const detail = !consent
    ? "Vérification de l’accord…"
    : consent.guardianAgreed
      ? consent.subjectAgreed
        ? "Accord conjoint actif · révocable à tout moment"
        : `Votre accord est enregistré · ${child.name} doit aussi accepter`
      : "Votre accord parental est nécessaire avant l’activation";

  return (
    <div className="child-notification-consent">
      <button className="safety-setting" type="button" role="switch" aria-checked={Boolean(consent?.guardianAgreed)} onClick={toggleGuardianConsent} disabled={!consent || busy}>
        <span className="setting-icon"><Bell size={20} weight="fill" /></span>
        <span className="setting-copy"><strong>Notifications de {child.name}</strong><small>{detail}</small></span>
        <span className={`toggle ${consent?.guardianAgreed ? "is-on" : ""}`} aria-hidden="true"><span /></span>
      </button>
      <small>{notificationConsentCopy.guardian}</small>
      {error && <small className="push-setting__error" role="alert">{error}</small>}
    </div>
  );
}
