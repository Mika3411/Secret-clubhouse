import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installIsolatedTestDatabaseUrl } from "../server/test-database-safety.js";

const productionOrigin = "https://secret-clubhouse.onrender.com";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function assertLocalOnlyBundle() {
  const assetsDirectory = path.join(root, "dist", "assets");
  const entries = await fs.readdir(assetsDirectory, { withFileTypes: true });
  const javascriptFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".js"));
  for (const entry of javascriptFiles) {
    const source = await fs.readFile(path.join(assetsDirectory, entry.name), "utf8");
    if (source.includes(productionOrigin)) {
      throw new Error(
        "Le bundle E2E contient l’origine de production. Utilisez exclusivement npm run build:e2e.",
      );
    }
  }
}

if (process.env.NODE_ENV === "production") {
  throw new Error("Le serveur E2E refuse NODE_ENV=production.");
}

const database = installIsolatedTestDatabaseUrl(process.env);
if (!/(?:^|[_-])e2e(?:[_-]|$)/iu.test(database.databaseName)) {
  throw new Error("Le serveur E2E exige une base dont le nom contient explicitement e2e.");
}

process.env.NODE_ENV = "test";
process.env.PORT = process.env.E2E_PORT || "4178";
process.env.JWT_SECRET = "secret-clubhouse-e2e-jwt-secret-never-used-outside-tests";
process.env.CONTENT_ENCRYPTION_KEY = "secret-clubhouse-e2e-content-key-with-at-least-32-bytes";
process.env.RTC_ENABLED = "false";
process.env.WEB_PUSH_ENABLED = "false";
process.env.NATIVE_PUSH_ENABLED = "false";
process.env.PRIVACY_ADMIN_ENABLED = "false";
process.env.ADMIN_ANALYTICS_ENABLED = "false";
process.env.PARENTAL_TIME_ZONE = "Europe/Paris";

await assertLocalOnlyBundle();
const { startServer } = await import("../server/index.js");
await startServer();
