import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { aipdActions } from "./aipd-register.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relativeManifestPath = "docs/exercices/a05-2026-07-23-manifest.json";
const manifestPath = path.join(repositoryRoot, relativeManifestPath);
const procedurePath = path.join(repositoryRoot, "docs", "incident-response.md");
const reportPath = path.join(repositoryRoot, "docs", "exercices", "a05-2026-07-23-fuite-messages-enfants.md");
const registerPath = path.join(repositoryRoot, "docs", "registre-violations.md");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

test("l’exercice A05 est daté, synthétique et attribué à des rôles déclarés", () => {
  assert.equal(manifest.exerciseId, "SIM-A05-2026-07-23");
  assert.equal(manifest.actionId, "A05");
  assert.match(manifest.exerciseDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(manifest.syntheticScenario, true);
  assert.equal(manifest.realDataUsed, false);
  assert.equal(manifest.externalNotificationSent, false);
  assert.ok(manifest.participants.length >= 4);
  assert.equal(new Set(manifest.participants.map(({ id }) => id)).size, manifest.participants.length);
  for (const participant of manifest.participants) {
    assert.match(participant.id, /^EX-[A-Z]+$/);
    assert.ok(participant.role.length > 4);
    assert.equal(participant.fictional, true);
  }
});

test("le délai CNIL part de la prise de connaissance et vaut exactement 72 heures", () => {
  const firstSignal = Date.parse(manifest.timeline.firstSignal);
  const awareness = Date.parse(manifest.timeline.awareness);
  const deadline = Date.parse(manifest.timeline.cnilDeadline);
  const containment = Date.parse(manifest.timeline.initialContainment);
  const cnilDraft = Date.parse(manifest.timeline.cnilDraftReady);

  for (const value of [firstSignal, awareness, deadline, containment, cnilDraft]) {
    assert.ok(Number.isFinite(value));
  }
  assert.ok(awareness >= firstSignal);
  assert.equal(deadline - awareness, 72 * 60 * 60 * 1000);
  assert.ok(containment - firstSignal <= 30 * 60 * 1000);
  assert.ok(cnilDraft < deadline);
});

test("le résultat A05 ne peut être clos sans décisions, résultats et corrections vérifiables", () => {
  assert.equal(manifest.risk.level, "high");
  assert.equal(manifest.risk.score, manifest.risk.severity * manifest.risk.likelihood);
  assert.equal(manifest.risk.cnilNotificationRequired, true);
  assert.equal(manifest.risk.dataSubjectCommunicationRequired, true);
  assert.equal(manifest.risk.article34ExceptionApplied, false);
  assert.equal(manifest.results.status, "completed-with-verified-corrections");
  assert.ok(manifest.results.objectivesEvaluated > 0);
  assert.equal(manifest.results.objectivesMet, manifest.results.objectivesEvaluated);
  assert.ok(manifest.results.defectsFound > 0);
  assert.equal(manifest.results.defectsClosed, manifest.results.defectsFound);
  assert.equal(manifest.corrections.length, manifest.results.defectsClosed);
  assert.equal(manifest.verification.performedOn, manifest.exerciseDate);
  assert.equal(manifest.verification.targetedTests.failed, 0);
  assert.ok(manifest.verification.targetedTests.passed > 0);
  assert.equal(manifest.verification.fullTestSuite.status, "not-clean-out-of-scope-concurrent-control");
  assert.match(manifest.verification.fullTestSuite.failureScope, /out-of-scope[\s\S]*A05 tests passed/i);
  assert.equal(manifest.verification.productionBuild.status, "passed");
  assert.equal(manifest.verification.localPreview.httpStatus, 200);
  assert.equal(manifest.verification.localPreview.phoneViewportChecked, true);

  for (const correction of manifest.corrections) {
    assert.match(correction.id, /^EX-A05-\d{2}$/);
    assert.equal(correction.status, "closed");
    assert.ok(correction.evidence.length > 0);
    for (const evidencePath of correction.evidence) {
      assert.equal(fs.existsSync(path.join(repositoryRoot, evidencePath)), true, `preuve absente : ${evidencePath}`);
    }
  }
});

test("la procédure, le registre et le compte rendu couvrent les livrables demandés", () => {
  const procedure = fs.readFileSync(procedurePath, "utf8");
  const report = fs.readFileSync(reportPath, "utf8");
  const violationRegister = fs.readFileSync(registerPath, "utf8");

  for (const heading of [
    "## 2. Détection",
    "## 3. Qualification",
    "## 4. Confinement et conservation de la preuve",
    "## 5. Notification CNIL",
    "## 6. Information des familles et des enfants",
    "## 7. Modèles de communication neutres",
  ]) {
    assert.ok(procedure.includes(heading), `section de procédure absente : ${heading}`);
  }
  assert.ok(procedure.includes("T0 + 72 heures"));
  for (const evidence of ["notification initiale", "risque élevé", "version enfant", "Aucun contenu privé"]) {
    assert.match(procedure, new RegExp(evidence, "i"));
  }
  assert.match(violationRegister, /Aucune violation réelle/i);
  assert.match(violationRegister, /SIM-A05-2026-07-23/);
  assert.match(report, /## 4\. Chronologie de confinement/);
  assert.match(report, /## 7\. Défauts et corrections vérifiables/);
  assert.match(report, /Aucun log, compte, message, média, enfant, parent, adresse, jeton, clé ou service réel/i);
});

test("le registre AIPD ferme A05 uniquement avec les preuves et la prochaine échéance", () => {
  const action = aipdActions.find(({ id }) => id === "A05");
  assert.ok(action);
  assert.equal(action.status, "closed");
  assert.equal(action.closedAt, manifest.exerciseDate);
  assert.equal(action.nextReviewAt, manifest.results.nextExerciseDue);
  assert.ok(action.closedBy.length > 0);
  assert.deepEqual(
    new Set(action.evidence),
    new Set([
      "docs/incident-response.md",
      "docs/registre-violations.md",
      "docs/exercices/a05-2026-07-23-fuite-messages-enfants.md",
      relativeManifestPath,
      "server/incident-response-evidence.test.js",
    ]),
  );
  for (const evidencePath of action.evidence) {
    assert.equal(fs.existsSync(path.join(repositoryRoot, evidencePath)), true, `preuve A05 absente : ${evidencePath}`);
  }
});
