import test from "node:test";
import assert from "node:assert/strict";
import { childLoginFeedback } from "../src/auth-feedback.js";

test("la connexion enfant distingue les identifiants incorrects du blocage temporaire", () => {
  assert.deepEqual(childLoginFeedback({ status: 401 }), {
    message: "Pseudo privé ou mot de passe incorrect.",
    invalidFields: ["username", "password"],
    focus: "username",
  });
  assert.deepEqual(childLoginFeedback({ status: 429, retryAfter: 61 }), {
    message: "Trop d’essais pour le moment. Attends 2 minutes, puis réessaie.",
    invalidFields: [],
    focus: null,
  });
});

test("la connexion enfant reste rassurante quand le serveur est indisponible", () => {
  assert.deepEqual(childLoginFeedback(new TypeError("Failed to fetch")), {
    message: "Le Clubhouse n’arrive pas à vérifier ta connexion. Réessaie dans un petit moment.",
    invalidFields: [],
    focus: null,
  });
});
