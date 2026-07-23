export class PublicHttpError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message, options);
    if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode >= 500) {
      throw new TypeError("Une erreur publique doit utiliser un statut HTTP compris entre 400 et 499.");
    }
    this.name = "PublicHttpError";
    this.statusCode = statusCode;
  }
}

export function publicHttpError(statusCode, message, options) {
  return new PublicHttpError(statusCode, message, options);
}

const multerMessages = Object.freeze({
  LIMIT_FILE_SIZE: "Un fichier dépasse la taille autorisée.",
  LIMIT_FILE_COUNT: "Trop de fichiers ont été envoyés.",
  LIMIT_PART_COUNT: "L’envoi contient trop de parties.",
  LIMIT_FIELD_COUNT: "L’envoi contient des champs inattendus.",
  LIMIT_FIELD_KEY: "Un nom de champ est trop long.",
  LIMIT_FIELD_VALUE: "La valeur d’un champ est trop longue.",
  LIMIT_UNEXPECTED_FILE: "Un fichier inattendu a été envoyé.",
});

export function safeHttpErrorResponse(error, { multerError = false } = {}) {
  if (error instanceof PublicHttpError) {
    return { statusCode: error.statusCode, message: error.message };
  }
  if (error?.type === "entity.parse.failed") {
    return { statusCode: 400, message: "Le contenu JSON de la requête est invalide." };
  }
  if (multerError) {
    return {
      statusCode: String(error?.code ?? "").startsWith("LIMIT_") ? 413 : 400,
      message: multerMessages[error?.code] ?? "L’envoi de média est invalide.",
    };
  }
  return { statusCode: 500, message: "Erreur interne." };
}
