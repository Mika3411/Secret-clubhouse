export const legalDocumentVersions = Object.freeze({
  terms: Object.freeze({ id: "2026-07-23", label: "23 juillet 2026" }),
  legalNotice: Object.freeze({ id: "2026-07-23", label: "23 juillet 2026" }),
  privacy: Object.freeze({ id: "2026-07-26-v7", label: "26 juillet 2026 — version 7" }),
  parentalAuthority: Object.freeze({ id: "2026-07-23", label: "23 juillet 2026" }),
  notificationConsent: Object.freeze({ id: "2026-07-23", label: "23 juillet 2026" }),
});

export function registrationLegalEvidence() {
  return {
    termsAccepted: true,
    parentalAuthorityConfirmed: true,
    privacyNoticeProvided: true,
    termsVersion: legalDocumentVersions.terms.id,
    parentalAuthorityVersion: legalDocumentVersions.parentalAuthority.id,
    privacyVersion: legalDocumentVersions.privacy.id,
  };
}
