import pg from "pg";
import { createDatabasePoolConfig } from "./database-config.js";
import { reapplyErasureTombstones } from "./erasure-restoration.js";

const { Pool } = pg;
const sourceUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
const recoveryUrl = process.env.RECOVERY_DATABASE_URL;

if (!sourceUrl || !recoveryUrl) {
  throw new Error("SOURCE_DATABASE_URL (ou DATABASE_URL) et RECOVERY_DATABASE_URL sont requis.");
}
if (sourceUrl === recoveryUrl) {
  throw new Error("La base restaurée doit être distincte de la base source.");
}

const databaseConfig = (connectionString, prefix) => createDatabasePoolConfig({
  ...process.env,
  DATABASE_URL: connectionString,
  DATABASE_TRANSPORT: process.env[`${prefix}_DATABASE_TRANSPORT`] || process.env.DATABASE_TRANSPORT,
  DATABASE_TLS_CA: process.env[`${prefix}_DATABASE_TLS_CA`] || process.env.DATABASE_TLS_CA,
  DATABASE_TLS_CA_BASE64:
    process.env[`${prefix}_DATABASE_TLS_CA_BASE64`] || process.env.DATABASE_TLS_CA_BASE64,
});
const source = new Pool(databaseConfig(sourceUrl, "SOURCE"));
const recovery = new Pool(databaseConfig(recoveryUrl, "RECOVERY"));

try {
  console.log(JSON.stringify(await reapplyErasureTombstones({ source, recovery })));
} finally {
  await Promise.all([source.end(), recovery.end()]);
}
