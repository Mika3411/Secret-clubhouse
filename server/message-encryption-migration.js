import { getContentCipher } from "./content-encryption.js";
import { decryptMessageContent, encryptMessageContent } from "./message-content.js";

const selectMessageForMigrationSql = `
  select
    id,conversation_id,sender_id,
    body,media_name,media_type,media_data,
    body_ciphertext,media_name_ciphertext,media_type_ciphertext,media_ciphertext,
    content_encryption_version,content_encryption_key_id
  from messages
  where content_encryption_version=0
     or (
       content_encryption_version=1
       and (
         content_encryption_key_id is distinct from $1
         or (
           body_ciphertext is not null
           and split_part(body_ciphertext,'.',2) is distinct from $1
         )
         or (
           media_name_ciphertext is not null
           and split_part(media_name_ciphertext,'.',2) is distinct from $1
         )
         or (
           media_type_ciphertext is not null
           and split_part(media_type_ciphertext,'.',2) is distinct from $1
         )
         or (
           media_ciphertext is not null
           and encode(substring(media_ciphertext from 5 for 8),'hex') is distinct from $1
         )
       )
     )
  order by created_at,id
  limit 1
  for update skip locked
`;

const updateEncryptedMessageSql = `
  update messages
  set body=null,
      media_name=null,
      media_type=null,
      media_data=null,
      body_ciphertext=$2,
      media_name_ciphertext=$3,
      media_type_ciphertext=$4,
      media_ciphertext=$5,
      content_encryption_version=$6,
      content_encryption_key_id=$7
  where id=$1
`;

export async function migrateLegacyMessageContent(pool, {
  cipher = getContentCipher(),
  logger = console,
  maximumRows = Number.POSITIVE_INFINITY,
} = {}) {
  if (!pool || typeof pool.connect !== "function") {
    throw new TypeError("Un pool PostgreSQL est requis pour migrer les messages.");
  }
  let migrated = 0;
  while (migrated < maximumRows) {
    const client = await pool.connect();
    let legacyMedia = null;
    let decryptedMedia = null;
    let encryptedMedia = null;
    try {
      await client.query("begin");
      const selected = await client.query(selectMessageForMigrationSql, [cipher.activeKeyId]);
      const row = selected.rows?.[0];
      if (!row) {
        await client.query("commit");
        break;
      }

      legacyMedia = Buffer.isBuffer(row.media_data) ? row.media_data : null;
      const decrypted = decryptMessageContent(row, cipher);
      decryptedMedia = decrypted.mediaData;
      const encrypted = encryptMessageContent({
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        body: decrypted.body,
        mediaName: decrypted.mediaName,
        mediaType: decrypted.mediaType,
        mediaData: decrypted.mediaData,
      }, cipher);
      encryptedMedia = encrypted.mediaCiphertext;
      await client.query(updateEncryptedMessageSql, [
        row.id,
        encrypted.bodyCiphertext,
        encrypted.mediaNameCiphertext,
        encrypted.mediaTypeCiphertext,
        encrypted.mediaCiphertext,
        encrypted.encryptionVersion,
        encrypted.encryptionKeyId,
      ]);
      await client.query("commit");
      migrated += 1;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      encryptedMedia?.fill(0);
      if (decryptedMedia && decryptedMedia !== legacyMedia) decryptedMedia.fill(0);
      legacyMedia?.fill(0);
      client.release();
    }
  }
  if (migrated) logger.info?.(`${migrated} message(s) ou média(s) chiffré(s) avec la clé active.`);
  return migrated;
}
