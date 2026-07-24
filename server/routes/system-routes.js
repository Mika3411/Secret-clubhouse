export function registerSystemRoutes(app, { pool, privacyContactEmail }) {
  app.get("/api/health", async (_req, res) => {
    await pool.query("select 1");
    res.json({ ok: true });
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
