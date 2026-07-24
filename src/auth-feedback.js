export function childLoginFeedback(error) {
  if (error?.status === 401) {
    return {
      message: "Pseudo privé ou mot de passe incorrect.",
      invalidFields: ["username", "password"],
      focus: "username",
    };
  }

  if (error?.status === 429) {
    const retryAfterSeconds = Number(error.retryAfter);
    const waitMinutes = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? Math.max(1, Math.ceil(retryAfterSeconds / 60))
      : 15;
    return {
      message: `Trop d’essais pour le moment. Attends ${waitMinutes} minute${waitMinutes > 1 ? "s" : ""}, puis réessaie.`,
      invalidFields: [],
      focus: null,
    };
  }

  return {
    message: "Le Clubhouse n’arrive pas à vérifier ta connexion. Réessaie dans un petit moment.",
    invalidFields: [],
    focus: null,
  };
}
