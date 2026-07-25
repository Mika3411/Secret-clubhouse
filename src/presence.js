const knownPresenceStates = new Set([
  "online",
  "background",
  "unavailable",
  "offline",
  "unknown",
]);

const presenceCopy = {
  online: {
    label: "En ligne",
    shortLabel: "En ligne",
    detail: "Cette personne utilise Secret Clubhouse et peut recevoir un appel.",
  },
  background: {
    label: "En veille · joignable",
    shortLabel: "Joignable en veille",
    detail: "L’application peut être en arrière-plan ou le téléphone en veille. L’appel peut quand même sonner.",
  },
  unavailable: {
    label: "Connecté · appels indisponibles",
    shortLabel: "Appels indisponibles",
    detail: "Cette personne est connectée, mais aucun appareil ne peut recevoir l’appel pour le moment.",
  },
  offline: {
    label: "Déconnecté",
    shortLabel: "Déconnecté",
    detail: "Cette personne doit se reconnecter avant de pouvoir recevoir un appel.",
  },
  unknown: {
    label: "Vérification…",
    shortLabel: "Vérification…",
    detail: "Secret Clubhouse vérifie si cette personne peut recevoir un appel.",
  },
};

export function normalizePresenceAvailability(value) {
  const legacyState = value === true ? "online" : value === false ? "offline" : "unknown";
  const requestedState = typeof value === "object" && value
    ? String(value.state ?? "")
    : legacyState;
  const state = knownPresenceStates.has(requestedState) ? requestedState : "unknown";
  const connected = typeof value?.connected === "boolean"
    ? value.connected
    : state === "online" || state === "background" || state === "unavailable";
  const online = typeof value?.online === "boolean" ? value.online : state === "online";
  const canCall = typeof value?.canCall === "boolean"
    ? value.canCall
    : state === "online" || state === "background";
  const copy = presenceCopy[state];
  const detail = !canCall && (state === "online" || state === "background")
    ? "Cette personne est connectée, mais les appels ne sont pas disponibles pour le moment."
    : copy.detail;

  return {
    state,
    connected,
    online,
    canCall,
    label: copy.label,
    shortLabel: copy.shortLabel,
    detail,
  };
}

export function callAvailabilityPolicy(value) {
  const availability = normalizePresenceAvailability(value);
  if (availability.canCall) {
    return {
      allowed: true,
      reason: availability.label,
      detail: availability.detail,
    };
  }
  return {
    allowed: false,
    reason: availability.state === "offline" ? "Cette personne est déconnectée" : "Appel indisponible",
    detail: availability.detail,
  };
}
