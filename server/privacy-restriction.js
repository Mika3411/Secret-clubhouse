const exactAllowedRequests = new Set([
  "DELETE /api/account",
  "DELETE /api/family",
  "GET /api/me",
  "GET /api/privacy/contact",
  "GET /api/privacy/export",
  "GET /api/privacy/requests",
  "POST /api/auth/logout",
  "POST /api/privacy/requests",
]);

const childDeletionPath = /^\/api\/children\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function isAllowedDuringPrivacyRestriction(method, requestPath) {
  const normalizedMethod = String(method ?? "").toUpperCase();
  const normalizedPath = String(requestPath ?? "");
  if (exactAllowedRequests.has(`${normalizedMethod} ${normalizedPath}`)) return true;
  return normalizedMethod === "DELETE" && childDeletionPath.test(normalizedPath);
}
