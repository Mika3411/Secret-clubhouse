import test from "node:test";
import assert from "node:assert/strict";
import {
  maximumConversationContactAliasLength,
  normalizeConversationContactAlias,
} from "./conversation-contact-alias.js";

test("normalise les petits noms choisis par un enfant", () => {
  assert.deepEqual(normalizeConversationContactAlias("  Papou   chéri  "), { alias: "Papou chéri" });
  assert.deepEqual(normalizeConversationContactAlias(""), { alias: null });
  assert.deepEqual(normalizeConversationContactAlias("   "), { alias: null });
});

test("borne les petits noms et refuse les caractères de contrôle", () => {
  assert.equal(
    normalizeConversationContactAlias("a".repeat(maximumConversationContactAliasLength + 1)).error,
    "Choisis un petit nom de 32 caractères maximum.",
  );
  assert.equal(
    normalizeConversationContactAlias("Papa\u0000").error,
    "Choisis un petit nom de 32 caractères maximum.",
  );
  assert.equal(normalizeConversationContactAlias(null).error, "Choisis un petit nom avec du texte.");
});
