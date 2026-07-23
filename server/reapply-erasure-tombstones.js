import pg from "pg";
import { createDatabasePoolConfig } from "./database-config.js";

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
  const tombstoneResult = await source.query(
    `select id,family_id,account_ids,created_at,backup_expires_at
     from erasure_tombstones
     where expires_at>now()
     order by created_at`,
  );
  const client = await recovery.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [1_386_829_043]);
    let deletedAccounts = 0;
    let deletedFamilies = 0;
    for (const tombstone of tombstoneResult.rows) {
      await client.query(
        `delete from conversations
         where id in (
           select conversation_id
           from conversation_members
           where account_id=any($1::uuid[])
         )`,
        [tombstone.account_ids],
      );
      await client.query(
        "delete from legal_events where subject_account_id=any($1::uuid[]) or actor_account_id=any($1::uuid[])",
        [tombstone.account_ids],
      );
      const accountResult = await client.query(
        "delete from accounts where id=any($1::uuid[])",
        [tombstone.account_ids],
      );
      deletedAccounts += Number(accountResult.rowCount ?? 0);
      if (tombstone.family_id) {
        const familyResult = await client.query(
          `delete from families family
           where family.id=$1
             and not exists(select 1 from family_memberships where family_id=family.id)
             and not exists(select 1 from family_children where family_id=family.id)`,
          [tombstone.family_id],
        );
        deletedFamilies += Number(familyResult.rowCount ?? 0);
      }
    }
    await client.query("commit");
    console.log(JSON.stringify({
      event: "privacy.erasure-reapplied",
      tombstones: tombstoneResult.rowCount,
      deletedAccounts,
      deletedFamilies,
    }));
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
} finally {
  await Promise.all([source.end(), recovery.end()]);
}
