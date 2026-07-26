import pg from "pg";
import { requireIsolatedTestDatabaseUrl } from "../server/test-database-safety.js";

const { Pool } = pg;
const e2eDatabaseNamePattern = /(?:^|[_-])e2e(?:[_-]|$)/iu;

export const e2eUsers = Object.freeze({
  parent: Object.freeze({
    email: "parent.principal@e2e.test",
    password: "ClubhouseParent!42",
    name: "Camille",
  }),
  alice: Object.freeze({
    username: "alice.club",
    password: "ClubhouseKid!42",
    name: "Alice",
  }),
  dorian: Object.freeze({
    username: "dorian.club",
    password: "ClubhouseKid!42",
    name: "Dorian",
  }),
  quietChild: Object.freeze({
    username: "noe.calme",
    password: "ClubhouseKid!42",
    name: "Noé",
  }),
  pausedChild: Object.freeze({
    username: "milo.pause",
    password: "ClubhouseKid!42",
    name: "Milo",
  }),
});

export const e2eIds = Object.freeze({
  parent: "10000000-0000-4000-8000-000000000001",
  friendParent: "10000000-0000-4000-8000-000000000002",
  secondParent: "10000000-0000-4000-8000-000000000003",
  approvedParent: "10000000-0000-4000-8000-000000000004",
  alice: "20000000-0000-4000-8000-000000000001",
  basile: "20000000-0000-4000-8000-000000000002",
  chloe: "20000000-0000-4000-8000-000000000003",
  dorian: "20000000-0000-4000-8000-000000000004",
  quietChild: "20000000-0000-4000-8000-000000000005",
  pausedChild: "20000000-0000-4000-8000-000000000006",
  eve: "20000000-0000-4000-8000-000000000007",
  aliceDorianConversation: "40000000-0000-4000-8000-000000000001",
  quietConversation: "40000000-0000-4000-8000-000000000002",
  approveRequest: "50000000-0000-4000-8000-000000000001",
  declineRequest: "50000000-0000-4000-8000-000000000002",
});

const parentPasswordHash = "$2b$04$3CA5KJuiobcvD/rHXRpDyuLB5/nE7ZUYTxGM6d5sesgp4I/42kmOS";
const childPasswordHash = "$2b$04$sE4Gpxf1qxIR8xn22Vq3hOWRGj57vfK0gZV/xcVR7xgsUXcMcn.Wq";

const alwaysAllowedSchedule = Object.freeze({
  enabled: true,
  messages: { enabled: true, start: "00:00", end: "23:59" },
  calls: { enabled: true, start: "00:00", end: "23:59" },
  video: { enabled: true, start: "00:00", end: "23:59" },
  autoReply: { enabled: true, message: "Je ne peux pas répondre pour le moment." },
});

const quietSchedule = Object.freeze({
  ...alwaysAllowedSchedule,
  messages: { enabled: false, start: "07:30", end: "20:30" },
});

function isolatedE2eDatabase(env = process.env) {
  const validated = requireIsolatedTestDatabaseUrl(env);
  if (!e2eDatabaseNamePattern.test(validated.databaseName)) {
    throw new Error("Le nom de TEST_DATABASE_URL doit contenir un marqueur e2e explicite.");
  }
  return validated;
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

async function truncatePublicTables(client) {
  const result = await client.query(
    "select tablename from pg_tables where schemaname='public' order by tablename",
  );
  if (!result.rowCount) {
    throw new Error("Le schéma E2E n’est pas initialisé ; démarrez le serveur de test avant les scénarios.");
  }
  const tables = result.rows.map(({ tablename }) => quoteIdentifier(tablename));
  await client.query(`truncate table ${tables.join(", ")} restart identity cascade`);
}

async function seedAccounts(client) {
  const parents = [
    [e2eIds.parent, "parent.principal@e2e.test", "SC-100-000-001", "Camille"],
    [e2eIds.friendParent, "parent.basile@e2e.test", "SC-100-000-002", "Morgan"],
    [e2eIds.secondParent, "parent.chloe@e2e.test", "SC-100-000-003", "Sacha"],
    [e2eIds.approvedParent, "parent.dorian@e2e.test", "SC-100-000-004", "Nina"],
  ];
  for (const [id, email, contactId, name] of parents) {
    await client.query(
      `insert into accounts(
         id,role,email,contact_id,password_hash,display_name,status,
         created_at,last_activity_at
       )
       values($1,'parent',$2,$3,$4,$5,'active',$6,$6)`,
      [id, email, contactId, parentPasswordHash, name, "2026-07-20T08:00:00.000Z"],
    );
  }

  const families = [
    ["30000000-0000-4000-8000-000000000001", e2eIds.parent, "Famille Camille"],
    ["30000000-0000-4000-8000-000000000002", e2eIds.friendParent, "Famille Basile"],
    ["30000000-0000-4000-8000-000000000003", e2eIds.secondParent, "Famille Chloé"],
    ["30000000-0000-4000-8000-000000000004", e2eIds.approvedParent, "Famille Dorian"],
  ];
  for (const [familyId, parentId, name] of families) {
    await client.query(
      "insert into families(id,name,legacy_owner_id,created_at) values($1,$2,$3,$4)",
      [familyId, name, parentId, "2026-07-20T08:00:00.000Z"],
    );
    await client.query(
      "insert into family_memberships(family_id,parent_id,role,joined_at) values($1,$2,'primary',$3)",
      [familyId, parentId, "2026-07-20T08:00:00.000Z"],
    );
  }

  const children = [
    [e2eIds.alice, e2eIds.parent, "SC-200-000-001", "Alice", "alice.club", 9, "mint", "active", alwaysAllowedSchedule, "2026-07-20T08:01:00.000Z"],
    [e2eIds.quietChild, e2eIds.parent, "SC-200-000-005", "Noé", "noe.calme", 10, "violet", "active", quietSchedule, "2026-07-20T08:02:00.000Z"],
    [e2eIds.pausedChild, e2eIds.parent, "SC-200-000-006", "Milo", "milo.pause", 8, "sun", "paused", alwaysAllowedSchedule, "2026-07-20T08:03:00.000Z"],
    [e2eIds.basile, e2eIds.friendParent, "SC-200-000-002", "Basile", "basile.club", 9, "coral", "active", alwaysAllowedSchedule, "2026-07-20T08:04:00.000Z"],
    [e2eIds.chloe, e2eIds.secondParent, "SC-200-000-003", "Chloé", "chloe.club", 11, "mint", "active", alwaysAllowedSchedule, "2026-07-20T08:05:00.000Z"],
    [e2eIds.dorian, e2eIds.approvedParent, "SC-200-000-004", "Dorian", "dorian.club", 10, "violet", "active", alwaysAllowedSchedule, "2026-07-20T08:06:00.000Z"],
    [e2eIds.eve, e2eIds.approvedParent, "SC-200-000-007", "Ève", "eve.club", 9, "sun", "active", alwaysAllowedSchedule, "2026-07-20T08:07:00.000Z"],
  ];
  for (const [id, parentId, contactId, name, username, age, color, status, schedule, createdAt] of children) {
    await client.query(
      `insert into accounts(
         id,role,contact_id,password_hash,display_name,parent_id,age,username,
         avatar_color,status,safety_settings,communication_schedule,created_at,last_activity_at
       )
       values($1,'child',$2,$3,$4,$5,$6,$7,$8,$9,'{"media":true}'::jsonb,$10::jsonb,$11,$11)`,
      [
        id,
        contactId,
        childPasswordHash,
        name,
        parentId,
        age,
        username,
        color,
        status,
        JSON.stringify(schedule),
        createdAt,
      ],
    );
  }
}

async function seedContacts(client) {
  const conversations = [
    [e2eIds.aliceDorianConversation, e2eIds.alice, e2eIds.dorian],
    [e2eIds.quietConversation, e2eIds.quietChild, e2eIds.eve],
  ];
  for (const [conversationId, firstAccountId, secondAccountId] of conversations) {
    await client.query(
      "insert into conversations(id,kind,created_at) values($1,'child',$2)",
      [conversationId, "2026-07-20T09:00:00.000Z"],
    );
    await client.query(
      `insert into conversation_members(conversation_id,account_id)
       values($1,$2),($1,$3)`,
      [conversationId, firstAccountId, secondAccountId],
    );
    const [accountOneId, accountTwoId] = [firstAccountId, secondAccountId].sort();
    await client.query(
      `insert into contact_relationships(
         account_one_id,account_two_id,conversation_id,created_at
       )
       values($1,$2,$3,$4)`,
      [accountOneId, accountTwoId, conversationId, "2026-07-20T09:00:00.000Z"],
    );
  }

  const requests = [
    [e2eIds.approveRequest, e2eIds.basile, e2eIds.friendParent],
    [e2eIds.declineRequest, e2eIds.chloe, e2eIds.secondParent],
  ];
  for (const [requestId, requesterId, requestingParentId] of requests) {
    await client.query(
      `insert into contact_requests(
         id,requester_id,requested_by_parent_id,target_account_id,
         recipient_parent_id,status,created_at,updated_at
       )
       values($1,$2,$3,$4,$5,'pending',$6,$6)`,
      [
        requestId,
        requesterId,
        requestingParentId,
        e2eIds.alice,
        e2eIds.parent,
        "2026-07-21T10:00:00.000Z",
      ],
    );
  }
}

export async function resetE2eDatabase(env = process.env) {
  const { connectionString } = isolatedE2eDatabase(env);
  const pool = new Pool({ connectionString, ssl: false, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await truncatePublicTables(client);
    await seedAccounts(client);
    await seedContacts(client);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

export async function queryE2eDatabase(sql, params = [], env = process.env) {
  const { connectionString } = isolatedE2eDatabase(env);
  const pool = new Pool({ connectionString, ssl: false, max: 1 });
  try {
    return await pool.query(sql, params);
  } finally {
    await pool.end();
  }
}
