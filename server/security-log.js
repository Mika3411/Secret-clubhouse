export async function writeSecurityEvent(executor, {
  accountId = null,
  eventType,
  outcome,
  identityHash = null,
  ipHash = null,
  metadata = {},
}) {
  await executor.query(
    `insert into security_events(account_id,event_type,outcome,identity_hash,ip_hash,metadata)
     values($1,$2,$3,$4,$5,$6::jsonb)`,
    [accountId, eventType, outcome, identityHash, ipHash, JSON.stringify(metadata)],
  );
}
