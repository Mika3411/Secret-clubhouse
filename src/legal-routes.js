export const privacyRoutes = Object.freeze({
  parent: "/confidentialite",
  child: "/confidentialite-enfants",
});

export function privacyAudienceFromPath(pathname) {
  if (pathname === privacyRoutes.parent) return "parent";
  if (pathname === privacyRoutes.child) return "child";
  return null;
}

export const legalNoticeRoute = "/mentions-legales";

export function isLegalNoticePath(pathname) {
  return pathname === legalNoticeRoute;
}
