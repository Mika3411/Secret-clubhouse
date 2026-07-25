export function normalizeDeploymentCommit(value) {
  const commit = String(value ?? "").trim().toLowerCase();
  return /^[a-f0-9]{40}$/u.test(commit) ? commit : "";
}

export function registerSystemRoutes(app, {
  pool,
  privacyContactEmail,
  deploymentCommit = "",
}) {
  const commit = normalizeDeploymentCommit(deploymentCommit);
  app.get("/api/health", async (_req, res) => {
    await pool.query("select 1");
    res.json({
      ok: true,
      ...(commit ? { deployment: { commit } } : {}),
    });
  });

  app.get("/api/privacy/contact", (_req, res) => {
    res.set({ "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" });
    res.json({
      controller: "Secret Clubhouse",
      email: privacyContactEmail,
      responseDeadline: "un mois",
      childFriendlyNotice: "Un enfant peut exercer ses droits lui-même ou demander l’aide de son parent.",
    });
  });
}
