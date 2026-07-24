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
  aipdVersion,
} from "./aipd-register.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dossierPath = path.join(repositoryRoot, "docs", "aipd-secret-clubhouse.md");
const a03RegisterPath = path.join(repositoryRoot, "docs", "registre-sous-traitants-et-transferts.md");
const a02ProtocolPath = path.join(repositoryRoot, "docs", "a02-protocole-consultation.md");
const a04ProcedurePath = path.join(repositoryRoot, "docs", "a04-procedure-gestion-acces-et-cles.md");
const a04ChecklistPath = path.join(repositoryRoot, "docs", "a04-checklist-preuves.md");
const a06ReportPath = path.join(repositoryRoot, "docs", "a06-validation-postgresql-2026-07-23.md");
const a08ChecklistPath = path.join(repositoryRoot, "docs", "a08-checklist-configuration-production-2026-07-23.md");

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
  assert.match(aipdDecision.priorConsultationRule, /consult(?:er|ation)[\s\S]{0,30}la CNIL/i);
});

test("A02 reste ouverte sans consultation appropriée ni décision circonstanciée", () => {
  const action = aipdActions.find(({ id }) => id === "A02");
  const protocol = fs.readFileSync(a02ProtocolPath, "utf8");

  assert.ok(action);
  assert.equal(action.status, "open");
  assert.match(action.acceptance, /soit consultation adaptée[\s\S]+soit décision signée et circonstanciée/i);
  assert.match(protocol, /modèle vierge — aucune consultation réalisée, aucune réponse collectée/i);
  assert.match(protocol, /lorsque cela est approprié/i);
  assert.match(protocol, /décision distincte, signée et circonstanciée/i);
  for (const heading of [
    "## 7. Questionnaire parent",
    "## 8. Questionnaire enfant — 6 à 9 ans",
    "## 9. Questionnaire enfant — 10 à 13 ans",
    "## 11. Formulaire de compte rendu anonymisé",
    "## 12. Formulaire de refus, retrait ou impossibilité",
  ]) {
    assert.ok(protocol.includes(heading), `section A02 absente : ${heading}`);
  }
});

test("A03 regroupe les preuves en cinq dossiers sans micro-identifiants", () => {
  const action = aipdActions.find(({ id }) => id === "A03");
  const register = fs.readFileSync(a03RegisterPath, "utf8");

  assert.equal(action?.status, "open");
  assert.match(action?.acceptance ?? "", /cinq dossiers regroupés D1 à D5/i);
  assert.match(action?.acceptance ?? "", /techniquement désactivé en production/i);
  for (const dossierId of ["D1", "D2", "D3", "D4", "D5"]) {
    assert.match(register, new RegExp(`## \\d+\\. Dossier ${dossierId}\\b`), `dossier ${dossierId} absent`);
  }
  assert.match(register, /cinq dossiers de preuve/i);
  assert.doesNotMatch(register, /\b(?:R|CF|WP|FCM|APN)-\d{2}\b/);
  assert.doesNotMatch(register, /56 micro-preuves et 11 fiches séparées sont (?:encore )?exigées/i);
  assert.match(register, /fonctions correspondant à un dossier non validé sont techniquement désactivées en production/i);
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
    "## 12. Projet de décision finale à signer",
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

test("la réévaluation 1.11 ferme A07 sur le périmètre restreint et conserve les actions non prouvées", () => {
  assert.equal(aipdVersion, "1.11");

  const statusByAction = Object.fromEntries(aipdActions.map(({ id, status }) => [id, status]));
  assert.deepEqual(
    Object.fromEntries(["A02", "A03", "A04", "A05", "A06", "A07", "A08"].map((id) => [id, statusByAction[id]])),
    {
      A02: "open",
      A03: "open",
      A04: "open",
      A05: "closed",
      A06: "closed",
      A07: "closed",
      A08: "open",
    },
  );

  const likelihoodByRisk = Object.fromEntries(
    aipdRisks.map(({ id, residual }) => [id, residual.likelihood]),
  );
  assert.deepEqual(likelihoodByRisk, {
    R01: 3,
    R02: 3,
    R03: 2,
    R04: 2,
    R05: 3,
    R06: 3,
    R07: 2,
    R08: 3,
    R09: 2,
    R10: 3,
  });

  const highRiskIds = aipdRisks
    .filter(({ residual }) => aipdRiskLevel(residual) === "high")
    .map(({ id }) => id);
  assert.deepEqual(highRiskIds, ["R01", "R02", "R06", "R08", "R10"]);
  assert.match(aipdDecision.reason, /A02, A03, A04 et A08 restent ouvertes/i);
});

test("A07 est fermée uniquement tant que les flux fournisseur et natifs restent désactivés", () => {
  const action = aipdActions.find(({ id }) => id === "A07");
  assert.equal(action?.status, "closed");
  assert.equal(action?.closedAt, "2026-07-23");
  assert.ok(action?.evidence?.includes("docs/a07-evaluation-securite-2026-07-23.md"));
  assert.match(action?.scopeRestriction ?? "", /RTC, Web Push, APNs\/FCM[\s\S]+agrégats administrateur[\s\S]+désactivés/i);
  assert.match(action?.scopeRestriction ?? "", /activation de ces canaux ou distribution native rouvre A07/i);
});

test("A04 reste ouverte sans contrôle réel des services et secrets actifs", () => {
  const action = aipdActions.find(({ id }) => id === "A04");
  assert.equal(action?.status, "open");
  assert.match(action?.acceptance ?? "", /fournisseurs et secrets réellement actifs/i);
  assert.match(action?.acceptance ?? "", /révocation/i);
  assert.match(action?.acceptance ?? "", /services désactivés[\s\S]+non applicables/i);

  const procedure = fs.readFileSync(a04ProcedurePath, "utf8");
  const checklist = fs.readFileSync(a04ChecklistPath, "utf8");
  assert.match(procedure, /A04.*OUVERT/is);
  assert.match(procedure, /test unitaire[\s\S]{0,160}ne ferment pas/i);
  assert.match(procedure, /Render.*GitHub.*Cloudflare.*Firebase.*Apple/is);
  assert.match(procedure, /ni cadence trimestrielle[\s\S]+ni prestataire externe/i);
  assert.match(procedure, /VAPID[\s\S]{0,160}Blocage actuel/i);
  assert.match(checklist, /GABARIT VIERGE/i);
  assert.match(checklist, /maintenir A04 ouverte/i);
  assert.match(checklist, /révocation d’un accès ou jeton représentatif testée/i);
});

test("A06 est clôturée par une preuve PostgreSQL datée, complète et isolée de la production", () => {
  const action = aipdActions.find(({ id }) => id === "A06");
  const report = fs.readFileSync(a06ReportPath, "utf8");

  assert.equal(action?.status, "closed");
  assert.equal(action?.closedAt, "2026-07-23");
  assert.equal(action?.nextReviewAt, "2026-10-23");
  assert.ok(action?.evidence?.includes("docs/a06-validation-postgresql-2026-07-23.md"));
  assert.match(report, /TEST_DATABASE_URL/);
  assert.match(report, /Aucune connexion à la production/i);
  assert.match(report, /5\/5 réussis/i);
  assert.match(report, /absence de réapparition/i);
  assert.match(report, /journalisation sans contenu personnel/i);
  assert.match(report, /Anomalies produit résiduelles[\s\S]{0,100}\*\*Aucune\*\*/i);
  assert.doesNotMatch(report, /postgres(?:ql)?:\/\/[^"\s]+/i);
});

test("A08 reste ouverte lorsque le déploiement réel diverge du Blueprint", () => {
  const action = aipdActions.find(({ id }) => id === "A08");
  const checklist = fs.readFileSync(a08ChecklistPath, "utf8");

  assert.equal(action?.status, "open");
  assert.match(action?.acceptance ?? "", /état Render réel/i);
  assert.match(action?.acceptance ?? "", /SHA ou une preuve de déploiement équivalente/i);
  assert.match(action?.acceptance ?? "", /render\.yaml seul ne prouve jamais/i);
  assert.match(checklist, /A08 OUVERTE/i);
  assert.match(checklist, /Oregon \(US West\)/i);
  assert.match(checklist, /168 h au lieu de 12 h/i);
  assert.match(checklist, /aucune ressource `secret-clubhouse-retention`/i);
  assert.match(checklist, /aucun statut combiné et aucune exécution de workflow/i);
  assert.match(checklist, /Ne pas clôturer A08/i);
  assert.doesNotMatch(checklist, /postgres(?:ql)?:\/\/\S+/i);
});
