import test from "node:test";
import assert from "node:assert/strict";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test("la purge PostgreSQL efface les données arrivées à échéance", {
  skip: testDatabaseUrl ? false : "TEST_DATABASE_URL non configurée",
}, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const [{ initializeDatabase, pool }, { purgeExpiredData }] = await Promise.all([
    import("./db.js"),
    import("./retention.js"),
  ]);

  try {
    await initializeDatabase();
    const client = await pool.connect();
    let parentOne;
    let parentTwo;
    try {
      await client.query("begin");
      parentOne = (await client.query(
        `insert into accounts(role,email,contact_id,password_hash,display_name,last_activity_at)
         values('parent',$1,$2,'hash','Retention One',now()-interval '731 days')
         returning id`,
        [`retention-one-${Date.now()}@example.test`, `SC-${Date.now().toString().slice(-3)}-901-001`],
      )).rows[0];
      parentTwo = (await client.query(
        `insert into accounts(role,email,contact_id,password_hash,display_name,last_activity_at)
         values('parent',$1,$2,'hash','Retention Two',now()-interval '731 days')
         returning id`,
        [`retention-two-${Date.now()}@example.test`, `SC-${Date.now().toString().slice(-3)}-902-002`],
      )).rows[0];
      const family = (await client.query(
        "insert into families(name,legacy_owner_id) values('Retention test',$1) returning id",
        [parentOne.id],
      )).rows[0];
      await client.query(
        `insert into family_memberships(family_id,parent_id,role)
         values($1,$2,'primary'),($1,$3,'coparent')`,
        [family.id, parentOne.id, parentTwo.id],
      );
      const conversation = (await client.query(
        "insert into conversations(kind) values('parent') returning id",
      )).rows[0];
      await client.query(
        `insert into conversation_members(conversation_id,account_id)
         values($1,$2),($1,$3)`,
        [conversation.id, parentOne.id, parentTwo.id],
      );
      await client.query(
        `insert into messages(conversation_id,sender_id,body,created_at)
         values($1,$2,'ancien message',now()-interval '366 days')`,
        [conversation.id, parentOne.id],
      );
      await client.query(
        `insert into messages(conversation_id,sender_id,media_name,media_type,media_data,created_at)
         values($1,$2,'ancien.jpg','image/jpeg',$3,now()-interval '91 days')`,
        [conversation.id, parentOne.id, Buffer.from("expired-media")],
      );
      await client.query(
        `insert into presence(account_id,last_seen,expires_at)
         values($1,now()-interval '2 days',now()-interval '1 day')`,
        [parentOne.id],
      );
      await client.query(
        `insert into push_subscriptions(account_id,endpoint,subscription,expires_at)
         values($1,$2,'{"keys":{"auth":"x","p256dh":"y"}}'::jsonb,now()-interval '1 day')`,
        [parentOne.id, `https://push.example.test/${parentOne.id}`],
      );
      await client.query(
        `insert into native_push_tokens(
           account_id,platform,device_id,token_kind,token,environment,expires_at
         ) values($1,'android',$2,'fcm',$3,null,now()-interval '1 day')`,
        [parentOne.id, `retention-device-${parentOne.id}`, `retention-native-token-${parentOne.id}`],
      );
      await client.query(
        `insert into security_events(account_id,event_type,outcome,expires_at)
         values($1,'retention.test','success',now()-interval '1 day')`,
        [parentOne.id],
      );
      await client.query(
        `insert into family_parent_invitations(family_id,email,token_hash,invited_by,status,expires_at,created_at)
         values($1,'expired@example.test',$2,$3,'pending',now()-interval '100 days',now()-interval '107 days')`,
        [family.id, `retention-${parentOne.id}`, parentOne.id],
      );
      await client.query(
        `insert into contact_requests(
           requester_id,requested_by_parent_id,target_account_id,recipient_parent_id,expires_at
         ) values($1,$1,$2,$2,now()-interval '1 day')`,
        [parentOne.id, parentTwo.id],
      );
      await client.query(
        `insert into game_sessions(
           game_type,player_one_id,player_two_id,invited_by,created_at,updated_at
         ) values('tic_tac_toe',$1,$2,$1,now()-interval '31 days',now()-interval '31 days')`,
        [parentOne.id, parentTwo.id],
      );
      const call = (await client.query(
        `insert into call_sessions(
           conversation_id,caller_id,callee_id,call_type,status,expires_at,answered_at,created_at,updated_at
         ) values(
           $1,$2,$3,'audio','accepted',now()-interval '2 days',now()-interval '2 days',
           now()-interval '100 days',now()-interval '100 days'
         ) returning id`,
        [conversation.id, parentOne.id, parentTwo.id],
      )).rows[0];
      await client.query(
        `insert into call_signals(
           call_id,sender_id,recipient_id,signal_type,payload,expires_at
         ) values($1,$2,$3,'offer','{"type":"offer","sdp":"expired"}'::jsonb,now()-interval '1 day')`,
        [call.id, parentOne.id, parentTwo.id],
      );
      await client.query(
        `insert into native_call_action_tokens(
           call_id,account_id,token_hash,expires_at,control_expires_at
         ) values(
           $1,$2,$3,now()-interval '2 days',now()-interval '2 days'
         )`,
        [call.id, parentTwo.id, "0".repeat(64)],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    const result = await purgeExpiredData(pool);
    assert.equal(result.counts.messages, 2);
    assert.equal(result.counts.presence, 1);
    assert.equal(result.counts.pushSubscriptions, 1);
    assert.equal(result.counts.nativePushTokens, 1);
    assert.equal(result.counts.callSignals, 1);
    assert.equal(result.counts.nativeCallActionTokens, 1);
    assert.equal(result.counts.games, 1);
    assert.equal(result.counts.securityEvents, 1);
    assert.equal(result.counts.expiredContactRequests, 1);
    assert.equal(result.counts.expiredFamilyInvitations, 1);
    assert.equal(result.counts.expiredCalls, 1);
    assert.equal(result.counts.inactiveAccounts, 2);
    assert.equal(result.counts.inactiveFamilies, 1);

    const accounts = await pool.query(
      "select id from accounts where id=any($1::uuid[])",
      [[parentOne.id, parentTwo.id]],
    );
    assert.equal(accounts.rowCount, 0);
  } finally {
    await pool.end();
  }
});
