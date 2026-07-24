import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  childPrivacyCards,
  parentPrivacyPolicy,
  privacyAudienceFromPath,
  privacyComplaint,
  privacyController,
  privacyRoutes,
} from "../src/privacy-policy.js";

test("la politique parent contient toutes les informations obligatoires", () => {
  assert.equal(privacyController.name.includes("à compléter"), false);
  assert.match(privacyController.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  assert.ok(parentPrivacyPolicy.dataCategories.length >= 5);
  assert.ok(parentPrivacyPolicy.purposes.length >= 9);
  assert.ok(parentPrivacyPolicy.purposes.every(({ subjects, purpose, legalBasis }) => subjects && purpose && legalBasis));
  assert.ok(parentPrivacyPolicy.consentExplanation.some((text) => /permission technique distincte/i.test(text)));
  assert.ok(parentPrivacyPolicy.consentExplanation.some((text) => /accord conjoint/i.test(text)));
  assert.ok(parentPrivacyPolicy.recipients.length >= 5);
  assert.ok(parentPrivacyPolicy.processors.some(({ name }) => /Render/i.test(name)));
  assert.ok(parentPrivacyPolicy.processors.some(({ name }) => /Cloudflare/i.test(name)));
  assert.ok(parentPrivacyPolicy.processors.some(({ name }) => /Web Push/i.test(name)));
  assert.ok(parentPrivacyPolicy.processors.some(({ name }) => /Firebase Cloud Messaging/i.test(name)));
  assert.ok(parentPrivacyPolicy.processors.some(({ name }) => /Apple Push Notification/i.test(name)));
  assert.ok(parentPrivacyPolicy.transfers.some((text) => /Oregon.*États-Unis/i.test(text)));
  assert.ok(parentPrivacyPolicy.transfers.some((text) => /Francfort/i.test(text)));
  assert.ok(parentPrivacyPolicy.transfers.some((text) => /clauses contractuelles types/i.test(text)));
  assert.ok(parentPrivacyPolicy.transfers.some((text) => /article 28/i.test(text)));
  assert.ok(parentPrivacyPolicy.retention.length >= 8);
  assert.ok(parentPrivacyPolicy.retention.every(({ data, duration }) => data && duration));
  assert.ok(parentPrivacyPolicy.rights.length >= 7);
  assert.match(privacyComplaint.url, /^https:\/\/www\.cnil\.fr\//);
});

test("le registre opérationnel encadre fournisseurs, preuves et transferts", async () => {
  const register = await readFile(
    new URL("../docs/registre-sous-traitants-et-transferts.md", import.meta.url),
    "utf8",
  );
  for (const expected of [
    "Render Services, Inc.",
    "PostgreSQL",
    "Cloudflare",
    "Web Push",
    "Firebase Cloud Messaging",
    "Apple Push Notification service",
    "article 28",
    "accès support",
    "sous-traitants ultérieurs",
    "sauvegardes",
    "analyse d’impact du transfert",
  ]) {
    assert.match(register, new RegExp(expected, "i"), `Mention manquante : ${expected}`);
  }

  const blueprint = await readFile(new URL("../render.yaml", import.meta.url), "utf8");
  assert.equal((blueprint.match(/region:\s*frankfurt/g) ?? []).length, 3);
});

test("la version enfant reste courte, concrète et sans jargon juridique", () => {
  assert.ok(childPrivacyCards.length >= 7);
  for (const card of childPrivacyCards) {
    assert.ok(card.title.length <= 45, `Titre trop long : ${card.title}`);
    assert.ok(card.text.length <= 280, `Texte trop long : ${card.title}`);
    assert.doesNotMatch(card.text, /base légale|sous-traitant|article 6|finalité du traitement/i);
  }
});

test("les deux politiques ont une route publique stable avant inscription", async () => {
  assert.equal(privacyAudienceFromPath(privacyRoutes.parent), "parent");
  assert.equal(privacyAudienceFromPath(privacyRoutes.child), "child");
  assert.equal(privacyAudienceFromPath("/"), null);

  const authSource = await readFile(new URL("../src/PublicAuth.jsx", import.meta.url), "utf8");
  assert.match(authSource, /openPrivacy\("parent"\)/);
  assert.match(authSource, /openPrivacy\("child"\)/);
  assert.match(authSource, /Avant l’inscription/);
  assert.match(authSource, /<PrivacyPolicyModal/);
});
