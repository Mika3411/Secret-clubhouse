function parseRtcIceServers(environment, warn) {
  if (environment.RTC_ICE_SERVERS_JSON) {
    try {
      const parsed = JSON.parse(environment.RTC_ICE_SERVERS_JSON);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (error) {
      warn(`Configuration RTC_ICE_SERVERS_JSON ignorée : ${error.message}.`);
    }
  }

  const defaultStunUrls = environment.NODE_ENV === "production" ? "" : "stun:stun.cloudflare.com:3478";
  const stunUrls = String(environment.RTC_STUN_URLS || defaultStunUrls)
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.startsWith("stun:") || url.startsWith("stuns:"));
  const turnUrls = String(environment.RTC_TURN_URLS || "")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.startsWith("turn:") || url.startsWith("turns:"));
  const iceServers = stunUrls.length ? [{ urls: stunUrls }] : [];
  if (turnUrls.length && environment.RTC_TURN_USERNAME && environment.RTC_TURN_CREDENTIAL) {
    iceServers.push({
      urls: turnUrls,
      username: environment.RTC_TURN_USERNAME,
      credential: environment.RTC_TURN_CREDENTIAL,
    });
  }
  return iceServers;
}

export function createRtcIceServerProvider({
  enabled,
  environment = process.env,
  fetchImplementation = globalThis.fetch,
  now = Date.now,
  warn = console.warn,
}) {
  const fallbackRtcIceServers = parseRtcIceServers(environment, warn);
  let managedTurnCache = null;

  return async function getRtcIceServers() {
    if (!enabled) return [];
    const keyId = environment.RTC_TURN_KEY_ID;
    const apiToken = environment.RTC_TURN_API_TOKEN;
    if (!keyId || !apiToken) return fallbackRtcIceServers;
    if (managedTurnCache?.expiresAt > now()) return managedTurnCache.iceServers;

    try {
      const response = await fetchImplementation(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ttl: 3600 }),
        },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.iceServers) || !payload.iceServers.length) throw new Error("réponse ICE vide");
      managedTurnCache = {
        iceServers: payload.iceServers,
        expiresAt: now() + 55 * 60 * 1000,
      };
      return managedTurnCache.iceServers;
    } catch (error) {
      warn(`Identifiants TURN temporaires indisponibles, repli STUN/TURN statique : ${error.message}.`);
      managedTurnCache = {
        iceServers: fallbackRtcIceServers,
        expiresAt: now() + 60 * 1000,
      };
      return managedTurnCache.iceServers;
    }
  };
}
