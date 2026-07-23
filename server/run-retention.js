import { initializeDatabase, pool } from "./db.js";
import { purgeExpiredData } from "./retention.js";

try {
  await initializeDatabase();
  const result = await purgeExpiredData(pool);
  console.log(JSON.stringify({ event: "retention.completed", ...result }));
  if (result.overduePrivacyRequests > 0) {
    console.error(`${result.overduePrivacyRequests} demande(s) RGPD ont dépassé l’échéance d’un mois.`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error("La purge de conservation a échoué.", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
