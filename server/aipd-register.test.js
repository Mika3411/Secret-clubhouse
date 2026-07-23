import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  aipdActions,
  aipdDecision,
  aipdHighRiskCriteria,
  aipdRiskLevel,
  aipdRiskScore,
  aipdRisks,
} from "./aipd-register.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dossierPath = path.join(repositoryRoot, "docs", "aipd-secret-clubhouse.md");

test("l’AIPD identifie au moins deux critères CNIL de risque élevé", () => {
  const applicable = aipdHighRiskCriteria.filter((criterion) => criterion.applicable);
  assert.ok(applicable.length >= 2);
  assert.deepEqual(
    new Set(applicable.map((criterion) => criterion.id)),
    new Set([
      "vulnerable-data-subjects",
      "highly-personal-data",
      "systematic-monitoring",
      "innovative-technology",
    ]),
  );
});

test("chaque risque est traçable, coté et relié à une action ouverte", () => {
  const actionIds = new Set(aipdActions.map((action) => action.id));
  assert.equal(actionIds.size, aipdActions.length);
  assert.ok(aipdRisks.length >= 10);

  for (const risk of aipdRisks) {
    assert.match(risk.id, /^R\d{2}$/);
    assert.ok(risk.fearedEvent.length > 20);
    assert.ok(risk.threats.length > 0);
    assert.ok(risk.impacts.length > 0);
    assert.ok(risk.existingMeasures.length > 0);
    assert.ok(risk.actionIds.length > 0);
    for (const rating of [risk.initial, risk.residual]) {
      assert.ok(Number.isInteger(rating.severity) && rating.severity >= 1 && rating.severity <= 4);
      assert.ok(Number.isInteger(rating.likelihood) && rating.likelihood >= 1 && rating.likelihood <= 4);
      assert.ok(aipdRiskScore(rating) >= 1 && aipdRiskScore(rating) <= 16);
    }
    for (const actionId of risk.actionIds) assert.ok(actionIds.has(actionId), `${risk.id} référence ${actionId}`);
  }
});

test("une décision de production reste bloquée lorsqu’un risque résiduel est élevé", () => {
  const highResidualRisks = aipdRisks.filter((risk) => aipdRiskLevel(risk.residual) === "high");
  assert.ok(highResidualRisks.length > 0);
  assert.equal(aipdDecision.status, "blocked");
  assert.equal(aipdDecision.productionApproved, false);
  assert.match(aipdDecision.priorConsultationRule, /consulter la CNIL/i);
});

test("le dossier AIPD couvre les éléments minimaux et les preuves du dépôt", () => {
  const dossier = fs.readFileSync(dossierPath, "utf8");
  for (const heading of [
    "## 1. Décision et statut",
    "## 2. Pourquoi l’AIPD est obligatoire",
    "## 5. Description systématique du traitement",
    "## 8. Nécessité et proportionnalité",
    "## 10. Analyse des risques",
    "## 11. Plan d’actions",
    "## 12. Validation formelle",
    "## 13. Réexamen",
  ]) {
    assert.ok(dossier.includes(heading), `section absente : ${heading}`);
  }
  for (const evidence of [
    "server/parental-policy.js",
    "server/content-encryption.js",
    "server/auth-sessions.js",
    "server/notification-privacy.js",
    "server/retention.js",
    "docs/registre-bases-legales.md",
  ]) {
    assert.ok(dossier.includes(evidence), `preuve absente : ${evidence}`);
  }
  assert.match(dossier, /PRODUCTION BLOQUÉE/);
  assert.match(dossier, /consultation préalable de la CNIL/i);
});
