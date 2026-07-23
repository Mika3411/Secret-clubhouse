import test from "node:test";
import assert from "node:assert/strict";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test("PostgreSQL migre réellement messages, médias et signaux sans laisser le legacy", {
  skip: testDatabaseUrl ? false : "TEST_DATABASE_URL non configurée",
}, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.CONTENT_ENCRYPTION_KEY =
    "content-encryption-integration-key-with-at-least-32-bytes";

  const [
    { initializeDatabase, pool },
    { getContentCipher },
    { migrateLegacyMessageContent },
    { migrateLegacyCallSignals },
    { decryptMessageContent },
    { decryptCallSignal },
  ] = await Promise.all([
    import("./db.js"),
    import("./content-encryption.js"),
    import("./message-encryption-migration.js"),
    import("./call-signal-encryption-migration.js"),
    import("./message-content.js"),
    import("./call-signal-content.js"),
  ]);

  try {
    await initializeDatabase();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const first = (await pool.query(
      `insert into accounts(role,email,contact_id,password_hash,display_name)
       values('parent',$1,$2,'hash','Premier parent') returning id`,
      [`cipher-first-${suffix}@example.test`, `SC-${String(Date.now()).slice(-3)}-841-001`],
    )).rows[0];
    const second = (await pool.query(
      `insert into accounts(role,email,contact_id,password_hash,display_name)
       values('parent',$1,$2,'hash','Second parent') returning id`,
      [`cipher-second-${suffix}@example.test`, `SC-${String(Date.now() + 1).slice(-3)}-842-002`],
    )).rows[0];
    const conversation = (await pool.query(
      "insert into conversations(kind) values('parent') returning id",
    )).rows[0];
    await pool.query(
      `insert into conversation_members(conversation_id,account_id)
       values($1,$2),($1,$3)`,
      [conversation.id, first.id, second.id],
    );
    const message = (await pool.query(
      `insert into messages(
         conversation_id,sender_id,media_name,media_type,media_data
       ) values($1,$2,'photo-privee.jpg','image/jpeg',$3) returning id`,
      [conversation.id, first.id, Buffer.from("legacy-private-media")],
    )).rows[0];
    const call = (await pool.query(
      `insert into call_sessions(
         conversation_id,caller_id,callee_id,call_type,status,answered_at
       ) values($1,$2,$3,'audio','accepted',now()) returning id`,
      [conversation.id, first.id, second.id],
    )).rows[0];
    const signal = (await pool.query(
      `insert into call_signals(
         call_id,sender_id,recipient_id,signal_type,payload
       ) values($1,$2,$3,'ice',$4::jsonb) returning id`,
      [
        call.id,
        first.id,
        second.id,
        JSON.stringify({ candidate: "candidate:private 192.0.2.44" }),
      ],
    )).rows[0];

    const cipher = getContentCipher();
    const quietLogger = { info() {} };
    assert.equal(await migrateLegacyMessageContent(pool, { cipher, logger: quietLogger }), 1);
    assert.equal(await migrateLegacyCallSignals(pool, { cipher, logger: quietLogger }), 1);

    const migratedMessage = (await pool.query(
      `select id,conversation_id,sender_id,body,media_name,media_type,media_data,
              body_ciphertext,media_name_ciphertext,media_type_ciphertext,
              media_ciphertext,content_encryption_version,content_encryption_key_id
       from messages where id=$1`,
      [message.id],
    )).rows[0];
    assert.equal(migratedMessage.media_name, null);
    assert.equal(migratedMessage.media_type, null);
    assert.equal(migratedMessage.media_data, null);
    assert.ok(migratedMessage.media_ciphertext);
    const decryptedMessage = decryptMessageContent(migratedMessage, cipher);
    assert.equal(decryptedMessage.mediaName, "photo-privee.jpg");
    assert.equal(decryptedMessage.mediaType, "image/jpeg");
    assert.deepEqual(decryptedMessage.mediaData, Buffer.from("legacy-private-media"));

    const migratedSignal = (await pool.query(
      `select id,encryption_context_id,call_id,sender_id,recipient_id,signal_type,
              payload,payload_ciphertext,content_encryption_version,
              content_encryption_key_id
       from call_signals where id=$1`,
      [signal.id],
    )).rows[0];
    assert.equal(migratedSignal.payload, null);
    assert.doesNotMatch(migratedSignal.payload_ciphertext, /192\.0\.2\.44/u);
    assert.deepEqual(
      decryptCallSignal(migratedSignal, cipher).payload,
      { candidate: "candidate:private 192.0.2.44" },
    );
  } finally {
    const { pool } = await import("./db.js");
    await pool.end();
  }
});
