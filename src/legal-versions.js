export const legalDocumentVersions = Object.freeze({
  terms: Object.freeze({ id: "2026-07-23", label: "23 juillet 2026" }),
  legalNotice: Object.freeze({ id: "2026-07-23", label: "23 juillet 2026" }),
  privacy: Object.freeze({ id: "2026-07-27-v10", label: "27 juillet 2026 — version 10" }),
  parentalAuthority: Object.freeze({ id: "2026-07-23", label: "23 juillet 2026" }),
  notificationConsent: Object.freeze({ id: "2026-07-23", label: "23 juillet 2026" }),
});

export function registrationLegalEvidence({ parentalAuthority = true } = {}) {
  return {
    termsAccepted: true,
    parentalAuthorityConfirmed: parentalAuthority,
    privacyNoticeProvided: true,
    termsVersion: legalDocumentVersions.terms.id,
    parentalAuthorityVersion: parentalAuthority ? legalDocumentVersions.parentalAuthority.id : null,
    privacyVersion: legalDocumentVersions.privacy.id,
  };
}
