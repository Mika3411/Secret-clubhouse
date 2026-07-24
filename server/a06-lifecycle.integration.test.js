import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import pg from "pg";
import { registrationLegalEvidence } from "../src/legal-framework.js";
import { createDatabasePoolConfig } from "./database-config.js";
import { installIsolatedTestDatabaseUrl } from "./test-database-safety.js";

const { Pool } = pg;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;
const secondsBetween = (later, earlier) => (
  (new Date(later).getTime() - new Date(earlier).getTime()) / 1000
);
const assertSeconds = (row, later, earlier, expected, tolerance = 2) => {
  assert.ok(
    Math.abs(secondsBetween(row[later], row[earlier]) - expected) <= tolerance,
    `${later} - ${earlier} doit valoir ${expected} secondes`,
  );
};

test("validation A06 PostgreSQL : droits, effacements, sauvegarde et restauration", {
  skip: testDatabaseUrl ? false : "TEST_DATABASE_URL non configurée",
  timeout: 120_000,
}, async (t) => {
  const validated = installIsolatedTestDatabaseUrl(process.env);
  process.env.JWT_SECRET = "a06-validation-jwt-secret-with-at-least-32-characters";
  process.env.CONTENT_ENCRYPTION_KEY = "a06-validation-content-key-with-at-least-32-bytes";
  process.env.PRIVACY_ADMIN_TOKEN = "a06-validation-privacy-admin-token";

  const [
    { app },
    { initializeDatabase, pool },
    { createPrivacyRequest, createReadablePrivacyExport },
    { reapplyErasureTombstones },
  ] = await Promise.all([
    import("./index.js"),
    import("./db.js"),
    import("./privacy-service.js"),
    import("./erasure-restoration.js"),
  ]);

  await initializeDatabase();

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.once("error", reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const backupDirectory = await mkdtemp(path.join(os.tmpdir(), "secret-clubhouse-a06-"));
  const backupPath = path.join(backupDirectory, "a06-before-erasure.dump");
  const recoveryDatabaseName = `${validated.databaseName}_restored`;
  const recoveryUrl = new URL(validated.connectionString);
  recoveryUrl.pathname = `/${recoveryDatabaseName}`;
  const maintenanceUrl = new URL(validated.connectionString);
  maintenanceUrl.pathname = "/postgres";
  let recoveryPool;

  const maintenancePool = new Pool(createDatabasePoolConfig({
    DATABASE_URL: maintenanceUrl.toString(),
  }));
  const trackedAccountIds = [];
  const trackedFamilyIds = [];
  const trackedLegalEventIds = [];
  const trackedPrivacyRequestIds = [];
  const trackedRetentionRunIds = [];
  const trackedSecurityEventIds = [];

  const dropRecoveryDatabase = async () => {
    await maintenancePool.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where datname=$1 and pid<>pg_backend_pid()",
      [recoveryDatabaseName],
    );
    await maintenancePool.query(`drop database if exists ${quoteIdentifier(recoveryDatabaseName)}`);
  };

  t.after(async () => {
    await recoveryPool?.end().catch(() => undefined);
    await dropRecoveryDatabase().catch(() => undefined);
    await maintenancePool.end().catch(() => undefined);
    await new Promise((resolve) => server.close(() => resolve()));
    if (trackedAccountIds.length) {
      await pool.query(
        "delete from erasure_tombstones where account_ids && $1::uuid[]",
        [trackedAccountIds],
      ).catch(() => undefined);
    }
    if (trackedPrivacyRequestIds.length) {
      await pool.query(
        "delete from privacy_requests where id=any($1::uuid[])",
        [trackedPrivacyRequestIds],
      ).catch(() => undefined);
    }
    if (trackedLegalEventIds.length) {
      await pool.query(
        "delete from legal_events where id=any($1::bigint[])",
        [trackedLegalEventIds],
      ).catch(() => undefined);
    }
    if (trackedSecurityEventIds.length) {
      await pool.query(
        "delete from security_events where id=any($1::bigint[])",
        [trackedSecurityEventIds],
      ).catch(() => undefined);
    }
    if (trackedRetentionRunIds.length) {
      await pool.query(
        "delete from retention_runs where id=any($1::bigint[])",
        [trackedRetentionRunIds],
      ).catch(() => undefined);
    }
    if (trackedAccountIds.length) {
      await pool.query(
        "delete from accounts where id=any($1::uuid[])",
        [trackedAccountIds],
      ).catch(() => undefined);
    }
    if (trackedFamilyIds.length) {
      await pool.query(
        "delete from families where id=any($1::uuid[])",
        [trackedFamilyIds],
      ).catch(() => undefined);
    }
    await pool.end().catch(() => undefined);
    await rm(backupDirectory, { recursive: true, force: true });
  });

  const apiRequest = async (route, {
    token,
    method = "GET",
    body,
    privacyAdmin = false,
  } = {}) => {
    const response = await fetch(`${baseUrl}/api${route}`, {
      method,
      headers: {
        "X-Secret-Clubhouse-Client": "native",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(privacyAdmin ? { "X-Privacy-Admin-Token": process.env.PRIVACY_ADMIN_TOKEN } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  };

  const createChild = async (parentToken, suffix, age = 9) => {
    const normalizedSuffix = suffix.replace(/[^a-z0-9]/giu, "").slice(-15);
    const result = await apiRequest("/children", {
      token: parentToken,
      method: "POST",
      body: {
        name: `Enfant test ${suffix}`,
        age,
        username: `e${normalizedSuffix}`,
        color: "mint",
        password: `Enfant-${suffix}-secret`,
      },
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.payload));
    trackedAccountIds.push(result.payload.child.id);
    return { ...result.payload.child, password: `Enfant-${suffix}-secret` };
  };

  const registerFamily = async (suffix, childCount = 1) => {
    const password = `Parent-${suffix}-secret`;
    const registration = await apiRequest("/auth/register", {
      method: "POST",
      body: {
        name: `Parent test ${suffix}`,
        email: `parent-${suffix}@example.test`,
        password,
        legal: registrationLegalEvidence(),
      },
    });
    assert.equal(registration.response.status, 201, JSON.stringify(registration.payload));
    trackedAccountIds.push(registration.payload.account.id);
    const children = [];
    for (let index = 1; index <= childCount; index += 1) {
      children.push(await createChild(registration.payload.token, `${suffix}-${index}`, 8 + index));
    }
    const family = (await pool.query(
      "select family_id from family_memberships where parent_id=$1",
      [registration.payload.account.id],
    )).rows[0];
    trackedFamilyIds.push(family.family_id);
    return {
      parent: registration.payload.account,
      parentToken: registration.payload.token,
      password,
      children,
      familyId: family.family_id,
    };
  };

  const runSuffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const childDeletionFamily = await registerFamily(`a06-child-${runSuffix}`, 2);
  const familyDeletionFamily = await registerFamily(`a06-family-${runSuffix}`, 1);
  const controlFamily = await registerFamily(`a06-control-${runSuffix}`, 1);
  const externalFamily = await registerFamily(`a06-external-${runSuffix}`, 1);

  await t.test("toutes les échéances documentées sont portées par le schéma et les services", async () => {
    const parentId = controlFamily.parent.id;
    const childId = controlFamily.children[0].id;
    const externalChildId = externalFamily.children[0].id;
    const conversation = (await pool.query(
      "insert into conversations(kind) values('child') returning id,created_at",
    )).rows[0];
    await pool.query(
      `insert into conversation_members(conversation_id,account_id)
       values($1,$2),($1,$3)`,
      [conversation.id, childId, externalChildId],
    );

    const account = (await pool.query(
      "select last_activity_at,inactive_after from accounts where id=$1",
      [childId],
    )).rows[0];
    assertSeconds(account, "inactive_after", "last_activity_at", 730 * 86_400);

    const session = (await pool.query(
      `select created_at,expires_at
       from auth_sessions
       where account_id=$1
       order by created_at desc limit 1`,
      [parentId],
    )).rows[0];
    assertSeconds(session, "expires_at", "created_at", 12 * 3_600);

    const messages = (await pool.query(
      `insert into messages(conversation_id,sender_id,body,media_name,media_type,media_data,message_kind)
       values
         ($1,$2,'texte test',null,null,null,'user'),
         ($1,$2,null,'media.test','application/octet-stream',$3,'user'),
         ($1,$2,'appel test',null,null,null,'call_event')
       returning message_kind,media_data is not null as has_media,created_at,expires_at`,
      [conversation.id, childId, Buffer.from("synthetic-media")],
    )).rows;
    assertSeconds(messages.find((row) => !row.has_media && row.message_kind === "user"), "expires_at", "created_at", 365 * 86_400);
    assertSeconds(messages.find((row) => row.has_media), "expires_at", "created_at", 90 * 86_400);
    assertSeconds(messages.find((row) => row.message_kind === "call_event"), "expires_at", "created_at", 90 * 86_400);

    const call = (await pool.query(
      `insert into call_sessions(
         conversation_id,caller_id,callee_id,call_type,status,ended_at
       ) values($1,$2,$3,'video','ended',now())
       returning id,created_at,expires_at,updated_at,retention_until`,
      [conversation.id, childId, externalChildId],
    )).rows[0];
    assertSeconds(call, "expires_at", "created_at", 45);
    assertSeconds(call, "retention_until", "updated_at", 90 * 86_400);

    const signal = (await pool.query(
      `insert into call_signals(
         call_id,sender_id,recipient_id,signal_type,payload
       ) values($1,$2,$3,'offer','{"synthetic":true}'::jsonb)
       returning created_at,expires_at`,
      [call.id, childId, externalChildId],
    )).rows[0];
    assertSeconds(signal, "expires_at", "created_at", 24 * 3_600);

    const actionToken = (await pool.query(
      `insert into native_call_action_tokens(
         call_id,account_id,token_hash,expires_at,control_expires_at
       ) values($1,$2,$3,now()+interval '45 seconds',now()+interval '2 hours')
       returning created_at,control_expires_at`,
      [call.id, externalChildId, `${runSuffix}${"a".repeat(52)}`],
    )).rows[0];
    assertSeconds(actionToken, "control_expires_at", "created_at", 2 * 3_600);

    const presence = (await pool.query(
      `insert into presence(account_id)
       values($1)
       on conflict(account_id) do update set last_seen=now(),expires_at=now()+interval '24 hours'
       returning last_seen,expires_at`,
      [childId],
    )).rows[0];
    assertSeconds(presence, "expires_at", "last_seen", 24 * 3_600);

    const typing = (await pool.query(
      `insert into typing_states(conversation_id,account_id,expires_at)
       values($1,$2,now()+interval '6 seconds')
       returning now() as created_at,expires_at`,
      [conversation.id, childId],
    )).rows[0];
    assertSeconds(typing, "expires_at", "created_at", 6);

    const webPush = (await pool.query(
      `insert into push_subscriptions(account_id,endpoint,subscription)
       values($1,$2,'{"keys":{"auth":"test","p256dh":"test"}}'::jsonb)
       returning created_at,expires_at`,
      [childId, `https://push.example.test/${childId}`],
    )).rows[0];
    assertSeconds(webPush, "expires_at", "created_at", 180 * 86_400, 3_601);

    const nativePush = (await pool.query(
      `insert into native_push_tokens(
         account_id,platform,device_id,token_kind,token
       ) values($1,'android',$2,'fcm',$3)
       returning created_at,expires_at`,
      [childId, `device-${childId}`, `token-${childId}`],
    )).rows[0];
    assertSeconds(nativePush, "expires_at", "created_at", 180 * 86_400, 3_601);

    const invitation = (await pool.query(
      `insert into family_parent_invitations(
         family_id,email,token_hash,invited_by,expires_at
       ) values($1,'invite@example.test',$2,$3,now()+interval '7 days')
       returning created_at,expires_at`,
      [controlFamily.familyId, `invite-${parentId}`, parentId],
    )).rows[0];
    assertSeconds(invitation, "expires_at", "created_at", 7 * 86_400);

    const contactRequest = (await pool.query(
      `insert into contact_requests(
         requester_id,requested_by_parent_id,target_account_id,recipient_parent_id
       ) values($1,$2,$3,$4)
       returning id,created_at,expires_at,retention_until`,
      [childId, parentId, externalChildId, externalFamily.parent.id],
    )).rows[0];
    assertSeconds(contactRequest, "expires_at", "created_at", 30 * 86_400);
    assertSeconds(contactRequest, "retention_until", "expires_at", 180 * 86_400, 3_601);
    const resolvedContactRequest = (await pool.query(
      `update contact_requests
       set status='declined',updated_at=now(),resolved_at=now()
       where id=$1
       returning updated_at,retention_until`,
      [contactRequest.id],
    )).rows[0];
    assertSeconds(resolvedContactRequest, "retention_until", "updated_at", 180 * 86_400, 3_601);

    const pendingGame = (await pool.query(
      `insert into game_sessions(
         game_type,player_one_id,player_two_id,invited_by
       ) values('tic_tac_toe',$1,$2,$1)
       returning id,created_at,expires_at`,
      [childId, externalChildId],
    )).rows[0];
    assertSeconds(pendingGame, "expires_at", "created_at", 30 * 86_400);
    const activeGame = (await pool.query(
      `update game_sessions
       set status='active',updated_at=now()
       where id=$1
       returning updated_at,expires_at`,
      [pendingGame.id],
    )).rows[0];
    assertSeconds(activeGame, "expires_at", "updated_at", 180 * 86_400, 3_601);

    const security = (await pool.query(
      `insert into security_events(event_type,outcome)
       values('a06.deadline','success')
       returning id,created_at,expires_at`,
    )).rows[0];
    trackedSecurityEventIds.push(security.id);
    assertSeconds(security, "expires_at", "created_at", 365 * 86_400);

    const legal = (await pool.query(
      `insert into legal_events(
         subject_account_id,actor_account_id,event_type,purpose,legal_basis,document_version
       ) values($1,$1,'privacy_notice_provided','a06-test','legal_obligation','test')
       returning id,occurred_at,retain_until`,
      [parentId],
    )).rows[0];
    trackedLegalEventIds.push(legal.id);
    assertSeconds(legal, "retain_until", "occurred_at", 1_825 * 86_400, 86_400);

    const rightsRequest = await createPrivacyRequest(pool, {
      requesterId: parentId,
      subjectId: parentId,
      requestType: "access",
      details: "Demande synthétique A06.",
    });
    trackedPrivacyRequestIds.push(rightsRequest.id);
    assertSeconds(rightsRequest, "due_at", "created_at", 31 * 86_400, 3 * 86_400);
    assertSeconds(rightsRequest, "expires_at", "created_at", 1_825 * 86_400, 86_400);

    const tombstone = (await pool.query(
      `insert into erasure_tombstones(
         privacy_request_id,family_id,account_ids
       ) values($1,null,array['00000000-0000-4000-8000-000000000006']::uuid[])
       returning created_at,backup_expires_at,expires_at`,
      [rightsRequest.id],
    )).rows[0];
    assertSeconds(tombstone, "backup_expires_at", "created_at", 7 * 86_400);
    assertSeconds(tombstone, "expires_at", "created_at", 30 * 86_400);
    await pool.query("delete from erasure_tombstones where privacy_request_id=$1", [rightsRequest.id]);

    const retentionRun = (await pool.query(
      `insert into retention_runs(started_at,deleted_counts)
       values(now(),'{}'::jsonb)
       returning id,completed_at,expires_at`,
    )).rows[0];
    trackedRetentionRunIds.push(retentionRun.id);
    assertSeconds(retentionRun, "expires_at", "completed_at", 365 * 86_400);
  });

  await t.test("exports et cinq types de demandes RGPD fonctionnent sans exposer le contenu enfant-ami au parent", async () => {
    const child = controlFamily.children[0];
    const friend = externalFamily.children[0];
    const conversation = (await pool.query(
      "insert into conversations(kind) values('child') returning id",
    )).rows[0];
    await pool.query(
      `insert into conversation_members(conversation_id,account_id)
       values($1,$2),($1,$3)`,
      [conversation.id, child.id, friend.id],
    );
    await pool.query(
      `insert into messages(conversation_id,sender_id,body)
       values($1,$2,'A06_PRIVATE_SYNTHETIC_SENTINEL')`,
      [conversation.id, child.id],
    );

    const createdRequests = [];
    for (const requestType of ["access", "rectification", "erasure", "restriction", "objection"]) {
      createdRequests.push(await createPrivacyRequest(pool, {
        requesterId: child.id,
        subjectId: child.id,
        requestType,
        details: `Demande synthétique ${requestType}.`,
      }));
    }
    assert.equal(createdRequests.length, 5);
    trackedPrivacyRequestIds.push(...createdRequests.map(({ id }) => id));
    assert.ok(createdRequests.every((request) => request.status === "submitted"));

    const events = await pool.query(
      `select request_id,count(*)::integer as count
       from privacy_request_events
       where request_id=any($1::uuid[])
       group by request_id`,
      [createdRequests.map((request) => request.id)],
    );
    assert.equal(events.rowCount, 5);
    assert.ok(events.rows.every((row) => row.count === 2));

    const parentExport = await createReadablePrivacyExport(pool, {
      requesterId: controlFamily.parent.id,
      subjectId: child.id,
      controllerEmail: "contact@example.test",
    });
    const childExport = await createReadablePrivacyExport(pool, {
      requesterId: child.id,
      subjectId: child.id,
      controllerEmail: "contact@example.test",
    });
    assert.equal(parentExport.authoredMessages.some(({ content }) => content === "A06_PRIVATE_SYNTHETIC_SENTINEL"), false);
    assert.ok(parentExport.authoredMessages.some(({ contentWithheld }) => contentWithheld));
    assert.ok(childExport.authoredMessages.some(({ content }) => content === "A06_PRIVATE_SYNTHETIC_SENTINEL"));
    assert.equal(childExport.rightsRequests.length >= 5, true);

    const restrictionRequest = createdRequests.find(({ request_type }) => request_type === "restriction");
    const applyRestriction = await apiRequest(`/privacy/admin/requests/${restrictionRequest.id}`, {
      privacyAdmin: true,
      method: "PATCH",
      body: {
        status: "in_review",
        applyRestriction: true,
        response: "Limitation appliquée pendant l’examen.",
      },
    });
    assert.equal(applyRestriction.response.status, 200, JSON.stringify(applyRestriction.payload));
    const restricted = await pool.query(
      "select processing_restricted_at from accounts where id=$1",
      [child.id],
    );
    assert.ok(restricted.rows[0].processing_restricted_at);

    const liftRestriction = await apiRequest(`/privacy/admin/requests/${restrictionRequest.id}`, {
      privacyAdmin: true,
      method: "PATCH",
      body: {
        status: "completed",
        liftRestriction: true,
        response: "Demande traitée et limitation levée.",
      },
    });
    assert.equal(liftRestriction.response.status, 200, JSON.stringify(liftRestriction.payload));
    const unrestricted = await pool.query(
      "select processing_restricted_at from accounts where id=$1",
      [child.id],
    );
    assert.equal(unrestricted.rows[0].processing_restricted_at, null);
  });

  await t.test("les journaux de sécurité et de purge ne contiennent ni identité ni contenu personnel", async () => {
    const sentinelEmail = `a06-personal-${runSuffix}@example.test`;
    const response = await apiRequest("/auth/login", {
      method: "POST",
      body: { email: sentinelEmail, password: "incorrect-test-password" },
    });
    assert.equal(response.response.status, 401);

    const securityEvent = (await pool.query(
      `select id,account_id,event_type,outcome,identity_hash,ip_hash,metadata
       from security_events
       where event_type='auth.login'
       order by id desc limit 1`,
    )).rows[0];
    trackedSecurityEventIds.push(securityEvent.id);
    const serializedSecurityEvent = JSON.stringify(securityEvent);
    assert.match(securityEvent.identity_hash, /^[a-f0-9]{64}$/);
    assert.match(securityEvent.ip_hash, /^[a-f0-9]{64}$/);
    assert.equal(serializedSecurityEvent.includes(sentinelEmail), false);
    assert.equal(serializedSecurityEvent.includes("127.0.0.1"), false);
    assert.deepEqual(securityEvent.metadata, {});

    const retentionRun = (await pool.query(
      `insert into retention_runs(started_at,deleted_counts)
       values(now(),'{"messages":2,"presence":1}'::jsonb)
       returning id,deleted_counts`,
    )).rows[0];
    trackedRetentionRunIds.push(retentionRun.id);
    const serializedRetentionRun = JSON.stringify(retentionRun);
    assert.equal(serializedRetentionRun.includes("sentinel"), false);
    assert.deepEqual(retentionRun.deleted_counts, { messages: 2, presence: 1 });
  });

  await t.test("suppression enfant et famille, tombstones, restauration et absence de réapparition", async () => {
    const deletedChild = childDeletionFamily.children[0];
    const retainedSibling = childDeletionFamily.children[1];
    const familyDeletedAccountIds = [
      familyDeletionFamily.parent.id,
      ...familyDeletionFamily.children.map(({ id }) => id),
    ];
    const childConversation = (await pool.query(
      "insert into conversations(kind) values('child') returning id as conversation_id",
    )).rows[0];
    await pool.query(
      `insert into conversation_members(conversation_id,account_id)
       values($1,$2),($1,$3)`,
      [childConversation.conversation_id, deletedChild.id, childDeletionFamily.parent.id],
    );
    await pool.query(
      `insert into messages(conversation_id,sender_id,body)
       values($1,$2,'A06_CHILD_DELETE_SENTINEL')`,
      [childConversation.conversation_id, deletedChild.id],
    );
    await pool.query(
      "insert into presence(account_id) values($1) on conflict(account_id) do nothing",
      [deletedChild.id],
    );
    await pool.query(
      `insert into push_subscriptions(account_id,endpoint,subscription)
       values($1,$2,'{"keys":{"auth":"test","p256dh":"test"}}'::jsonb)
       on conflict(endpoint) do nothing`,
      [deletedChild.id, `https://delete.example.test/${deletedChild.id}`],
    );
    await pool.query(
      `insert into clubhouse_activity_progress(child_id,activity_id,awarded_stars)
       values($1,'color-hunt',25)
       on conflict(child_id,activity_id) do nothing`,
      [deletedChild.id],
    );

    const pgEnvironment = { ...process.env };
    delete pgEnvironment.DATABASE_URL;
    delete pgEnvironment.SOURCE_DATABASE_URL;
    delete pgEnvironment.RECOVERY_DATABASE_URL;
    execFileSync(process.env.PG_DUMP_BIN || "pg_dump", [
      validated.connectionString,
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      "--file",
      backupPath,
    ], { env: pgEnvironment, stdio: "pipe" });

    const deleteChildResponse = await apiRequest(`/children/${deletedChild.id}`, {
      token: childDeletionFamily.parentToken,
      method: "DELETE",
    });
    assert.equal(deleteChildResponse.response.status, 204, JSON.stringify(deleteChildResponse.payload));

    const childAfterDeletion = await pool.query(
      `select
         (select count(*) from accounts where id=$1)::integer as accounts,
         (select count(*) from family_children where child_id=$1)::integer as family_children,
         (select count(*) from conversation_members where account_id=$1)::integer as conversation_members,
         (select count(*) from messages where sender_id=$1)::integer as messages,
         (select count(*) from presence where account_id=$1)::integer as presence,
         (select count(*) from push_subscriptions where account_id=$1)::integer as push,
         (select count(*) from clubhouse_activity_progress where child_id=$1)::integer as progress`,
      [deletedChild.id],
    );
    assert.deepEqual(childAfterDeletion.rows[0], {
      accounts: 0,
      family_children: 0,
      conversation_members: 0,
      messages: 0,
      presence: 0,
      push: 0,
      progress: 0,
    });
    assert.equal((await pool.query("select 1 from accounts where id=$1", [retainedSibling.id])).rowCount, 1);

    const deleteFamilyResponse = await apiRequest("/family", {
      token: familyDeletionFamily.parentToken,
      method: "DELETE",
      body: {
        currentPassword: familyDeletionFamily.password,
        confirmation: "SUPPRIMER MA FAMILLE",
      },
    });
    assert.equal(deleteFamilyResponse.response.status, 204, JSON.stringify(deleteFamilyResponse.payload));
    assert.equal(
      (await pool.query("select 1 from families where id=$1", [familyDeletionFamily.familyId])).rowCount,
      0,
    );
    assert.equal(
      (await pool.query("select 1 from accounts where id=any($1::uuid[])", [familyDeletedAccountIds])).rowCount,
      0,
    );

    const tombstones = await pool.query(
      `select family_id,account_ids,created_at,backup_expires_at,expires_at
       from erasure_tombstones
       where account_ids && $1::uuid[]
       order by created_at`,
      [[deletedChild.id, ...familyDeletedAccountIds]],
    );
    assert.equal(tombstones.rowCount, 2);
    for (const tombstone of tombstones.rows) {
      assertSeconds(tombstone, "backup_expires_at", "created_at", 7 * 86_400, 3);
      assertSeconds(tombstone, "expires_at", "created_at", 30 * 86_400, 3);
    }

    await dropRecoveryDatabase();
    await maintenancePool.query(`create database ${quoteIdentifier(recoveryDatabaseName)}`);
    execFileSync(process.env.PG_RESTORE_BIN || "pg_restore", [
      "--dbname",
      recoveryUrl.toString(),
      "--no-owner",
      "--no-privileges",
      backupPath,
    ], { env: pgEnvironment, stdio: "pipe" });

    recoveryPool = new Pool(createDatabasePoolConfig({
      DATABASE_URL: recoveryUrl.toString(),
    }));
    assert.equal((await recoveryPool.query("select 1 from accounts where id=$1", [deletedChild.id])).rowCount, 1);
    assert.equal(
      (await recoveryPool.query("select 1 from accounts where id=any($1::uuid[])", [familyDeletedAccountIds])).rowCount,
      familyDeletedAccountIds.length,
    );

    const reapplied = await reapplyErasureTombstones({
      source: pool,
      recovery: recoveryPool,
    });
    assert.equal(reapplied.tombstones >= 2, true);
    assert.equal(reapplied.deletedAccounts, familyDeletedAccountIds.length + 1);
    assert.equal(reapplied.deletedFamilies, 1);

    assert.equal((await recoveryPool.query("select 1 from accounts where id=$1", [deletedChild.id])).rowCount, 0);
    assert.equal(
      (await recoveryPool.query("select 1 from accounts where id=any($1::uuid[])", [familyDeletedAccountIds])).rowCount,
      0,
    );
    assert.equal(
      (await recoveryPool.query("select 1 from families where id=$1", [familyDeletionFamily.familyId])).rowCount,
      0,
    );
    assert.equal((await recoveryPool.query("select 1 from accounts where id=$1", [retainedSibling.id])).rowCount, 1);
    assert.equal((await recoveryPool.query("select 1 from accounts where id=$1", [controlFamily.parent.id])).rowCount, 1);
    assert.equal(
      (await recoveryPool.query(
        "select 1 from messages where body in ('A06_CHILD_DELETE_SENTINEL')",
      )).rowCount,
      0,
    );
  });
});
