import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedDuringPrivacyRestriction } from "./privacy-restriction.js";

test("la restriction RGPD autorise uniquement les droits et suppressions explicitement prévus", () => {
  const allowed = [
    ["POST", "/api/auth/logout"],
    ["GET", "/api/me"],
    ["GET", "/api/privacy/contact"],
    ["GET", "/api/privacy/export"],
    ["GET", "/api/privacy/requests"],
    ["POST", "/api/privacy/requests"],
    ["DELETE", "/api/account"],
    ["DELETE", "/api/family"],
    ["DELETE", "/api/children/11111111-1111-4111-8111-111111111111"],
  ];
  for (const [method, requestPath] of allowed) {
    assert.equal(isAllowedDuringPrivacyRestriction(method, requestPath), true, `${method} ${requestPath}`);
  }
});

test("la restriction RGPD bloque les routes de consentement et les variantes de méthode", () => {
  const blocked = [
    ["GET", "/api/privacy/notification-consent"],
    ["PUT", "/api/privacy/notification-consent"],
    ["GET", "/api/privacy/admin/requests"],
    ["PATCH", "/api/privacy/requests"],
    ["POST", "/api/privacy/export"],
    ["DELETE", "/api/push/subscribe"],
    ["DELETE", "/api/children/not-an-account-id"],
  ];
  for (const [method, requestPath] of blocked) {
    assert.equal(isAllowedDuringPrivacyRestriction(method, requestPath), false, `${method} ${requestPath}`);
  }
});
