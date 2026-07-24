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
    body: "Nouvelle invitation à jouer dans l’application.",
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
  const profile = visibleProfiles[notificationType] ?? visibleProfiles.default;
  const safePayload = {
    ...payload,
    title: profile.title,
    body: profile.body,
  };
  if (notificationType === "incoming-call") {
    safePayload.callerName = profile.callerName;
  } else {
    delete safePayload.callerName;
  }
  return safePayload;
}
