import test from "node:test";
import assert from "node:assert/strict";
import {
  childUsernameMaxLength,
  isPrivateContactId,
  isValidChildUsername,
  normalizeChildUsername,
} from "../src/child-username.js";

test("le pseudo enfant privé possède une normalisation stable partagée par le client et l’API", () => {
  assert.equal(normalizeChildUsername("  Lïna Club  "), "lina.club");
  assert.equal(normalizeChildUsername("Jules---Cosmos"), "jules.cosmos");
  assert.equal(normalizeChildUsername("A".repeat(40)).length, childUsernameMaxLength);
  assert.equal(isValidChildUsername("lina.club"), true);
  assert.equal(isValidChildUsername("ab"), false);
  assert.equal(isValidChildUsername("..."), false);
});

test("un ancien identifiant de contact est distingué du pseudo de connexion", () => {
  assert.equal(isPrivateContactId("SC-123-456-789"), true);
  assert.equal(isPrivateContactId("sc-123-456-789"), true);
  assert.equal(isPrivateContactId("lina.club"), false);
});
