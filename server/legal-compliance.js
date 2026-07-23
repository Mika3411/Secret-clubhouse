import {
  legalDocumentVersions,
  notificationConsentCopy,
  registrationLegalStatements,
} from "../src/legal-framework.js";
import { publicHttpError } from "./http-errors.js";

const registrationError = "Vous devez accepter les conditions d’utilisation et confirmer votre autorité parentale.";

export function validateRegistrationLegalEvidence(input) {
  const evidence = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const valid = evidence.termsAccepted === true
    && evidence.parentalAuthorityConfirmed === true
    && evidence.privacyNoticeProvided === true
    && evidence.termsVersion === legalDocumentVersions.terms.id
    && evidence.parentalAuthorityVersion === legalDocumentVersions.parentalAuthority.id
    && evidence.privacyVersion === legalDocumentVersions.privacy.id;
  return valid
    ? {
        valid: true,
        value: {
          termsVersion: evidence.termsVersion,
          parentalAuthorityVersion: evidence.parentalAuthorityVersion,
          privacyVersion: evidence.privacyVersion,
        },
      }
    : { valid: false, error: registrationError };
}

export async function writeLegalEvent(executor, {
  subjectAccountId,
  actorAccountId = subjectAccountId,
  eventType,
  purpose,
  legalBasis,
  documentVersion,
  evidence = {},
}) {
  await executor.query(
    `insert into legal_events(
       subject_account_id,actor_account_id,event_type,purpose,legal_basis,
       document_version,evidence,occurred_at,retain_until
     )
     values($1,$2,$3,$4,$5,$6,$7::jsonb,now(),now()+interval '5 years')`,
    [
      subjectAccountId,
      actorAccountId,
      eventType,
      purpose,
      legalBasis,
      documentVersion,
      JSON.stringify(evidence),
    ],
  );
}

export async function recordRegistrationLegalEvents(executor, accountId, versions) {
  await writeLegalEvent(executor, {
    subjectAccountId: accountId,
    eventType: "contract_accepted",
    purpose: "parent_account_service",
    legalBasis: "contract",
    documentVersion: versions.termsVersion,
    evidence: { channel: "registration_form", statement: registrationLegalStatements.terms },
  });
  await writeLegalEvent(executor, {
    subjectAccountId: accountId,
    eventType: "parental_authority_declared",
    purpose: "child_profile_management",
    legalBasis: "legitimate_interest",
    documentVersion: versions.parentalAuthorityVersion,
    evidence: { channel: "registration_form", statement: registrationLegalStatements.parentalAuthority },
  });
  await writeLegalEvent(executor, {
    subjectAccountId: accountId,
    eventType: "privacy_notice_provided",
    purpose: "transparency",
    legalBasis: "legal_obligation",
    documentVersion: versions.privacyVersion,
    evidence: { channel: "registration_form", statement: registrationLegalStatements.privacyNotice },
  });
}

export function serializeNotificationConsent(row) {
  if (!row) return null;
  const requiresGuardian = row.role === "child" && Number(row.age) < 15;
  const subjectAgreed = Boolean(row.subject_agreed_at);
  const guardianAgreed = !requiresGuardian || Boolean(row.guardian_agreed_at);
  return {
    subjectAccountId: row.id,
    role: row.role,
    age: row.age === null || row.age === undefined ? null : Number(row.age),
    requiresGuardian,
    subjectAgreed,
    guardianAgreed,
    active: subjectAgreed && guardianAgreed,
    subjectAgreedAt: row.subject_agreed_at ?? null,
    guardianAgreedAt: row.guardian_agreed_at ?? null,
    consentVersion: legalDocumentVersions.notificationConsent.id,
    systemPermissionIsSeparate: true,
  };
}

export async function getNotificationConsent(executor, accountId, { lock = false } = {}) {
  const result = await executor.query(
    `select account.id,account.role,account.age,
            consent.subject_agreed_at,consent.guardian_agreed_at
     from accounts account
     left join account_consent_preferences consent
       on consent.subject_account_id=account.id and consent.purpose='notifications'
     where account.id=$1
     ${lock ? "for update of account" : ""}`,
    [accountId],
  );
  return serializeNotificationConsent(result.rows[0]);
}

export async function assertActiveNotificationConsent(executor, accountId) {
  const consent = await getNotificationConsent(executor, accountId);
  if (!consent) {
    throw publicHttpError(404, "Compte introuvable.");
  }
  if (!consent.active) {
    throw publicHttpError(403, consent.requiresGuardian && consent.subjectAgreed && !consent.guardianAgreed
      ? "L’accord du parent est requis avant d’activer les notifications."
      : "Un consentement distinct est requis avant d’activer les notifications.");
  }
  return consent;
}

async function removeNotificationTokens(executor, subjectAccountId) {
  await executor.query("delete from push_subscriptions where account_id=$1", [subjectAccountId]);
  await executor.query("delete from native_push_tokens where account_id=$1", [subjectAccountId]);
}

export async function setSubjectNotificationConsent(executor, {
  subjectAccountId,
  agreed,
}) {
  const account = await getNotificationConsent(executor, subjectAccountId, { lock: true });
  if (!account) {
    throw publicHttpError(404, "Compte introuvable.");
  }
  await executor.query(
    `insert into account_consent_preferences(
       subject_account_id,purpose,subject_agreed_at,subject_document_version,updated_at
     )
     values($1,'notifications',case when $2 then now() else null end,$3,now())
     on conflict(subject_account_id,purpose) do update
       set subject_agreed_at=case when $2 then now() else null end,
           subject_document_version=$3,
           updated_at=now()`,
    [subjectAccountId, agreed, legalDocumentVersions.notificationConsent.id],
  );
  await writeLegalEvent(executor, {
    subjectAccountId,
    eventType: agreed ? "consent_granted" : "consent_withdrawn",
    purpose: "notifications",
    legalBasis: "consent",
    documentVersion: legalDocumentVersions.notificationConsent.id,
    evidence: {
      actorRole: account.role,
      statement: account.role === "child" ? notificationConsentCopy.child : notificationConsentCopy.parent,
      systemPermissionIsSeparate: true,
    },
  });
  if (!agreed) await removeNotificationTokens(executor, subjectAccountId);
  return getNotificationConsent(executor, subjectAccountId);
}

export async function setGuardianNotificationConsent(executor, {
  subjectAccountId,
  guardianAccountId,
  agreed,
}) {
  await executor.query(
    `insert into account_consent_preferences(
       subject_account_id,purpose,guardian_agreed_at,guardian_document_version,
       guardian_account_id,updated_at
     )
     values($1,'notifications',case when $3 then now() else null end,$4,$2,now())
     on conflict(subject_account_id,purpose) do update
       set guardian_agreed_at=case when $3 then now() else null end,
           guardian_document_version=$4,
           guardian_account_id=$2,
           updated_at=now()`,
    [
      subjectAccountId,
      guardianAccountId,
      agreed,
      legalDocumentVersions.notificationConsent.id,
    ],
  );
  await writeLegalEvent(executor, {
    subjectAccountId,
    actorAccountId: guardianAccountId,
    eventType: agreed ? "guardian_consent_granted" : "guardian_consent_withdrawn",
    purpose: "notifications",
    legalBasis: "consent",
    documentVersion: legalDocumentVersions.notificationConsent.id,
    evidence: {
      actorRole: "parent",
      statement: notificationConsentCopy.guardian,
      systemPermissionIsSeparate: true,
    },
  });
  if (!agreed) await removeNotificationTokens(executor, subjectAccountId);
  return getNotificationConsent(executor, subjectAccountId);
}
