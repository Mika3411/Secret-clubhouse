const visibleProfiles = Object.freeze({
  message: Object.freeze({
    title: "Secret Clubhouse",
    body: "Nouveau message. Ouvrez l’application pour le consulter.",
  }),
  "contact-request": Object.freeze({
    title: "Secret Clubhouse",
    body: "Nouvelle demande de contact à vérifier dans l’application.",
  }),
  game: Object.freeze({
    title: "Secret Clubhouse",
    body: "Une partie privée vous attend dans l’application.",
  }),
  "game-turn": Object.freeze({
    title: "Secret Clubhouse",
    body: "C’est à votre tour de jouer.",
  }),
  "game-stopped": Object.freeze({
    title: "Secret Clubhouse",
    body: "Une partie privée a été mise à jour.",
  }),
  "incoming-call": Object.freeze({
    title: "Appel Secret Clubhouse",
    body: "Un contact autorisé vous appelle.",
    callerName: "Contact autorisé",
  }),
  default: Object.freeze({
    title: "Secret Clubhouse",
    body: "Nouvelle activité à consulter dans l’application.",
  }),
});

/**
 * @param {Record<string, unknown>} [payload]
 * @returns {Record<string, unknown>}
 */
export function privacySafeNotificationPayload(payload = {}) {
  const notificationType = String(payload.notificationType ?? "");
  if (notificationType === "call-state") {
    const {
      title: _title,
      body: _body,
      callerName: _callerName,
      ...silentPayload
    } = payload;
    return silentPayload;
  }
  const requestedProfile = notificationType === "game"
    ? payload.gameEvent === "turn"
      ? "game-turn"
      : payload.gameEvent === "stopped" ? "game-stopped" : "game"
    : notificationType;
  const profile = requestedProfile in visibleProfiles
    ? visibleProfiles[/** @type {keyof typeof visibleProfiles} */ (requestedProfile)]
    : visibleProfiles.default;
  /** @type {Record<string, unknown>} */
  const safePayload = {
    ...payload,
    title: profile.title,
    body: profile.body,
  };
  if (notificationType === "incoming-call") {
    safePayload.callerName = visibleProfiles["incoming-call"].callerName;
  } else {
    delete safePayload.callerName;
  }
  return safePayload;
}
