import { getContentCipher } from "./content-encryption.js";
import { decryptCallSignal, encryptCallSignal } from "./call-signal-content.js";

const selectSignalForMigrationSql = `
  select
    id,encryption_context_id,call_id,sender_id,recipient_id,signal_type,
    payload,payload_ciphertext,
    content_encryption_version,content_encryption_key_id
  from call_signals
  where content_encryption_version=0
     or (
       content_encryption_version=1
       and (
         content_encryption_key_id is distinct from $1
         or split_part(payload_ciphertext,'.',2) is distinct from $1
       )
     )
  order by id
  limit 1
  for update skip locked
`;

const updateEncryptedSignalSql = `
  update call_signals
  set payload=null,
      payload_ciphertext=$2,
      content_encryption_version=$3,
      content_encryption_key_id=$4
  where id=$1
`;

export async function migrateLegacyCallSignals(pool, {
  cipher = getContentCipher(),
  logger = console,
  maximumRows = Number.POSITIVE_INFINITY,
} = {}) {
  if (!pool || typeof pool.connect !== "function") {
    throw new TypeError("Un pool PostgreSQL est requis pour migrer les signaux WebRTC.");
  }

  let migrated = 0;
  while (migrated < maximumRows) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const selected = await client.query(selectSignalForMigrationSql, [cipher.activeKeyId]);
      const row = selected.rows?.[0];
      if (!row) {
        await client.query("commit");
        break;
      }

      const decrypted = decryptCallSignal(row, cipher);
      const encrypted = encryptCallSignal({
        contextId: row.encryption_context_id,
        callId: row.call_id,
        senderId: row.sender_id,
        recipientId: row.recipient_id,
        signalType: row.signal_type,
        payload: decrypted.payload,
      }, cipher);
      await client.query(updateEncryptedSignalSql, [
        row.id,
        encrypted.payloadCiphertext,
        encrypted.encryptionVersion,
        encrypted.encryptionKeyId,
      ]);
      await client.query("commit");
      migrated += 1;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  if (migrated) {
    logger.info?.(`${migrated} signal(aux) WebRTC chiffré(s) avec la clé active.`);
  }
  return migrated;
}
