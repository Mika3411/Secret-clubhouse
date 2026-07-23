import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  legalBasisRegister,
  legalDocumentVersions,
  notificationConsentCopy,
  registrationLegalEvidence,
} from "../src/legal-framework.js";
import {
  assertActiveNotificationConsent,
  recordRegistrationLegalEvents,
  serializeNotificationConsent,
  validateRegistrationLegalEvidence,
} from "./legal-compliance.js";

test("l’inscription exige les versions exactes des documents et deux confirmations distinctes", () => {
  assert.equal(validateRegistrationLegalEvidence(undefined).valid, false);
  assert.equal(validateRegistrationLegalEvidence({
    ...registrationLegalEvidence(),
    termsAccepted: false,
  }).valid, false);
  assert.equal(validateRegistrationLegalEvidence({
    ...registrationLegalEvidence(),
    privacyVersion: "ancienne-version",
  }).valid, false);

  const result = validateRegistrationLegalEvidence(registrationLegalEvidence());
  assert.deepEqual(result, {
    valid: true,
    value: {
      termsVersion: legalDocumentVersions.terms.id,
      parentalAuthorityVersion: legalDocumentVersions.parentalAuthority.id,
      privacyVersion: legalDocumentVersions.privacy.id,
    },
  });
});

test("la preuve d’inscription est horodatée côté serveur dans trois événements minimaux", async () => {
  const calls = [];
  const executor = {
    async query(sql, params) {
      calls.push({ sql: String(sql).replace(/\s+/g, " ").trim(), params });
      return { rows: [], rowCount: 1 };
    },
  };
  await recordRegistrationLegalEvents(
    executor,
    "11111111-1111-4111-8111-111111111111",
    validateRegistrationLegalEvidence(registrationLegalEvidence()).value,
  );

  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map(({ params }) => params[2]), [
    "contract_accepted",
    "parental_authority_declared",
    "privacy_notice_provided",
  ]);
  assert.deepEqual(calls.map(({ params }) => params[4]), [
    "contract",
    "legitimate_interest",
    "legal_obligation",
  ]);
  assert.ok(calls.every(({ sql }) => /now\(\).*interval '5 years'/.test(sql)));
  assert.ok(calls.every(({ params }) => !JSON.stringify(params).includes("password")));
});

test("chaque finalité possède une base légale déterminée et le consentement reste facultatif", () => {
  const ids = new Set(legalBasisRegister.map(({ id }) => id));
  assert.equal(ids.size, legalBasisRegister.length);
  assert.ok(legalBasisRegister.length >= 9);
  assert.ok(legalBasisRegister.every(({ subjects, purpose, basisCode, basisLabel, justification }) => (
    subjects && purpose && basisCode && basisLabel && justification
  )));

  const notifications = legalBasisRegister.find(({ id }) => id === "optional-notifications");
  assert.equal(notifications.optional, true);
  assert.match(notifications.basisLabel, /Consentement/);
  assert.match(notifications.justification, /accord conjoint/i);
  assert.match(notificationConsentCopy.systemPermission, /ne vaut pas consentement RGPD/i);

  const security = legalBasisRegister.find(({ id }) => id === "service-security");
  assert.match(security.basisLabel, /Intérêt légitime/);
  assert.match(security.justification, /accès non autorisés/);
});

test("un profil de moins de 15 ans nécessite les accords de l’enfant et du parent", () => {
  const childOnly = serializeNotificationConsent({
    id: "22222222-2222-4222-8222-222222222222",
    role: "child",
    age: 12,
    subject_agreed_at: "2026-07-23T12:00:00.000Z",
    guardian_agreed_at: null,
  });
  assert.equal(childOnly.requiresGuardian, true);
  assert.equal(childOnly.subjectAgreed, true);
  assert.equal(childOnly.guardianAgreed, false);
  assert.equal(childOnly.active, false);

  const joint = serializeNotificationConsent({
    id: childOnly.subjectAccountId,
    role: "child",
    age: 12,
    subject_agreed_at: "2026-07-23T12:00:00.000Z",
    guardian_agreed_at: "2026-07-23T12:05:00.000Z",
  });
  assert.equal(joint.active, true);

  const adult = serializeNotificationConsent({
    id: "33333333-3333-4333-8333-333333333333",
    role: "parent",
    age: null,
    subject_agreed_at: "2026-07-23T12:00:00.000Z",
    guardian_agreed_at: null,
  });
  assert.equal(adult.requiresGuardian, false);
  assert.equal(adult.active, true);
});

test("l’API refuse un jeton push tant que le consentement conjoint est incomplet", async () => {
  const executor = {
    async query() {
      return {
        rows: [{
          id: "44444444-4444-4444-8444-444444444444",
          role: "child",
          age: 9,
          subject_agreed_at: "2026-07-23T12:00:00.000Z",
          guardian_agreed_at: null,
        }],
        rowCount: 1,
      };
    },
  };
  await assert.rejects(
    assertActiveNotificationConsent(executor, "44444444-4444-4444-8444-444444444444"),
    (error) => error.statusCode === 403 && /accord du parent/i.test(error.message),
  );
});

test("le schéma, l’API et l’interface câblent les preuves et le retrait", async () => {
  const [databaseSource, serverSource, appSource, apiSource, registerSource] = await Promise.all([
    readFile(new URL("./db.js", import.meta.url), "utf8"),
    readFile(new URL("./index.js", import.meta.url), "utf8"),
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/api.js", import.meta.url), "utf8"),
    readFile(new URL("../docs/registre-bases-legales.md", import.meta.url), "utf8"),
  ]);

  assert.match(databaseSource, /create table if not exists legal_events/);
  assert.match(databaseSource, /create table if not exists account_consent_preferences/);
  assert.match(serverSource, /recordRegistrationLegalEvents/);
  assert.match(serverSource, /assertActiveNotificationConsent\(pool, req\.auth\.sub\)/);
  assert.match(serverSource, /guardian_agreed_at is not null/);
  assert.match(appSource, /registrationLegalEvidence\(\)/);
  assert.match(appSource, /ChildNotificationConsentSetting/);
  assert.match(apiSource, /setChildNotificationConsent/);
  assert.match(registerSource, /Test de mise en balance/);
  assert.match(registerSource, /permission technique distincte/);
});
