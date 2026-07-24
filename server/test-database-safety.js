const localTestHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const testDatabaseNamePattern = /(?:^|[_-])(a06|test|testing|validation)(?:[_-]|$)/iu;

export function requireIsolatedTestDatabaseUrl(env = process.env) {
  if (env.NODE_ENV === "production") {
    throw new Error("La validation A06 est interdite avec NODE_ENV=production.");
  }
  if (String(env.DATABASE_URL ?? "").trim()
    || String(env.SOURCE_DATABASE_URL ?? "").trim()
    || String(env.RECOVERY_DATABASE_URL ?? "").trim()) {
    throw new Error(
      "La validation A06 refuse DATABASE_URL, SOURCE_DATABASE_URL et RECOVERY_DATABASE_URL ; utilisez uniquement TEST_DATABASE_URL.",
    );
  }

  const connectionString = String(env.TEST_DATABASE_URL ?? "").trim();
  if (!connectionString) throw new Error("TEST_DATABASE_URL est requise pour la validation A06.");

  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("TEST_DATABASE_URL doit être une URL PostgreSQL valide.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !localTestHosts.has(url.hostname)) {
    throw new Error("La validation A06 automatisée exige une base PostgreSQL locale isolée.");
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/u, ""));
  if (!testDatabaseNamePattern.test(databaseName)) {
    throw new Error("Le nom de la base doit contenir un marqueur explicite a06, test ou validation.");
  }

  return { connectionString, url, databaseName };
}

export function installIsolatedTestDatabaseUrl(env = process.env) {
  const validated = requireIsolatedTestDatabaseUrl(env);
  env.DATABASE_URL = validated.connectionString;
  return validated;
}
