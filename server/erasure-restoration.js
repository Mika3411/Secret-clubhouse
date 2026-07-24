const erasureRestorationLockKey = 1_386_829_043;

export async function reapplyErasureTombstones({ source, recovery, now = new Date() }) {
  if (!source || typeof source.query !== "function") {
    throw new TypeError("Une base source PostgreSQL est requise.");
  }
  if (!recovery || typeof recovery.connect !== "function") {
    throw new TypeError("Une base restaurée PostgreSQL est requise.");
  }

  const tombstoneResult = await source.query(
    `select id,family_id,account_ids,created_at,backup_expires_at
     from erasure_tombstones
     where expires_at>$1
     order by created_at`,
    [now],
  );
  const client = await recovery.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [erasureRestorationLockKey]);
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
    return {
      event: "privacy.erasure-reapplied",
      tombstones: tombstoneResult.rowCount,
      deletedAccounts,
      deletedFamilies,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
