import test from "node:test";
import assert from "node:assert/strict";
import {
  PublicHttpError,
  publicHttpError,
  safeHttpErrorResponse,
} from "./http-errors.js";

test("une erreur HTTP publique conserve uniquement son message fonctionnel", () => {
  const response = safeHttpErrorResponse(publicHttpError(403, "Action non autorisée."));
  assert.deepEqual(response, { statusCode: 403, message: "Action non autorisée." });
});

test("une erreur interne reste générique même si elle forge un statusCode", () => {
  const error = new Error("postgres://secret@host/table?constraint=private");
  error.statusCode = 400;
  error.detail = "select * from messages";
  assert.deepEqual(safeHttpErrorResponse(error), {
    statusCode: 500,
    message: "Erreur interne.",
  });
});

test("le JSON invalide et les erreurs Multer ont des réponses constantes", () => {
  const jsonError = new SyntaxError("Unexpected token SECRET");
  jsonError.type = "entity.parse.failed";
  assert.deepEqual(safeHttpErrorResponse(jsonError), {
    statusCode: 400,
    message: "Le contenu JSON de la requête est invalide.",
  });

  assert.deepEqual(safeHttpErrorResponse({ code: "LIMIT_FILE_SIZE", message: "chemin/interne" }, {
    multerError: true,
  }), {
    statusCode: 413,
    message: "Un fichier dépasse la taille autorisée.",
  });
});

test("une erreur publique refuse les statuts serveur", () => {
  assert.throws(
    () => new PublicHttpError(503, "Configuration secrète absente."),
    /compris entre 400 et 499/,
  );
});
