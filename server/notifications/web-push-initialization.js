import { loadVapidKeyRing } from "../web-push-keyring.js";

export async function initializeWebPushNotifications({
  enabled,
  environment = process.env,
  webPushClient,
  database,
  log = console.log,
  warn = console.warn,
}) {
  if (!enabled) {
    log("Web Push désactivé par WEB_PUSH_ENABLED.");
    return {
      pushEnabled: false,
      vapidPublicKey: "",
      vapidKeyRing: null,
    };
  }

  let keys = environment.VAPID_PUBLIC_KEY && environment.VAPID_PRIVATE_KEY
    ? { publicKey: environment.VAPID_PUBLIC_KEY, privateKey: environment.VAPID_PRIVATE_KEY }
    : null;

  if (!keys) {
    if (environment.NODE_ENV === "production") {
      throw new Error("WEB_PUSH_ENABLED=true exige VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY en production.");
    }
    const generatedKeys = webPushClient.generateVAPIDKeys();
    await database.query(
      `insert into application_settings(setting_key,setting_value)
       values('web_push_vapid_keys',$1::jsonb)
       on conflict(setting_key) do nothing`,
      [JSON.stringify(generatedKeys)],
    );
    const stored = await database.query("select setting_value from application_settings where setting_key='web_push_vapid_keys'");
    keys = stored.rows[0]?.setting_value ?? generatedKeys;
  }

  try {
    const vapidKeyRing = loadVapidKeyRing(environment, keys);
    for (const pair of vapidKeyRing.all) {
      webPushClient.setVapidDetails(pair.subject, pair.publicKey, pair.privateKey);
    }
    webPushClient.setVapidDetails(
      vapidKeyRing.current.subject,
      vapidKeyRing.current.publicKey,
      vapidKeyRing.current.privateKey,
    );
    return {
      pushEnabled: true,
      vapidPublicKey: vapidKeyRing.current.publicKey,
      vapidKeyRing,
    };
  } catch (error) {
    if (environment.NODE_ENV === "production") throw error;
    warn(`Notifications push désactivées : configuration VAPID invalide (${error.message}).`);
    return {
      pushEnabled: false,
      vapidPublicKey: "",
      vapidKeyRing: null,
    };
  }
}
