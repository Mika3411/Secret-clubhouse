import test from "node:test";
import assert from "node:assert/strict";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test("cycle PostgreSQL enfant → demande/export et confidentialité parent", {
  skip: testDatabaseUrl ? false : "TEST_DATABASE_URL non configurée",
}, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.CONTENT_ENCRYPTION_KEY = "privacy-integration-content-key-32-bytes-minimum";
  const [{ initializeDatabase, pool }, { createPrivacyRequest, createReadablePrivacyExport }] = await Promise.all([
    import("./db.js"),
    import("./privacy-service.js"),
  ]);

  await initializeDatabase();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const parent = (await client.query(
      `insert into accounts(role,email,contact_id,password_hash,display_name)
       values('parent',$1,$2,'hash','Parent test') returning id`,
      [`privacy-parent-${suffix}@example.test`, `SC-${String(Date.now()).slice(-3)}-731-${String(Math.random()).slice(2, 5)}`],
    )).rows[0];
    const family = (await client.query(
      "insert into families(name,legacy_owner_id) values('Famille droits',$1) returning id",
      [parent.id],
    )).rows[0];
    await client.query(
      "insert into family_memberships(family_id,parent_id,role) values($1,$2,'primary')",
      [family.id, parent.id],
    );
    const child = (await client.query(
      `insert into accounts(role,contact_id,password_hash,display_name,parent_id,age,username)
       values('child',$1,'hash','Lina',$2,9,$3) returning id`,
      [`SC-${String(Date.now() + 1).slice(-3)}-732-${String(Math.random()).slice(2, 5)}`, parent.id, `lina-${suffix}`],
    )).rows[0];

    const otherParent = (await client.query(
      `insert into accounts(role,email,contact_id,password_hash,display_name)
       values('parent',$1,$2,'hash','Autre parent') returning id`,
      [`privacy-other-${suffix}@example.test`, `SC-${String(Date.now() + 2).slice(-3)}-733-${String(Math.random()).slice(2, 5)}`],
    )).rows[0];
    const otherFamily = (await client.query(
      "insert into families(name,legacy_owner_id) values('Autre famille',$1) returning id",
      [otherParent.id],
    )).rows[0];
    await client.query(
      "insert into family_memberships(family_id,parent_id,role) values($1,$2,'primary')",
      [otherFamily.id, otherParent.id],
    );
    const friend = (await client.query(
      `insert into accounts(role,contact_id,password_hash,display_name,parent_id,age,username)
       values('child',$1,'hash','Ami',$2,10,$3) returning id`,
      [`SC-${String(Date.now() + 3).slice(-3)}-734-${String(Math.random()).slice(2, 5)}`, otherParent.id, `ami-${suffix}`],
    )).rows[0];
    const conversation = (await client.query(
      "insert into conversations(kind) values('child') returning id",
    )).rows[0];
    await client.query(
      `insert into conversation_members(conversation_id,account_id)
       values($1,$2),($1,$3)`,
      [conversation.id, child.id, friend.id],
    );
    await client.query(
      "insert into messages(conversation_id,sender_id,body) values($1,$2,'Message privé de Lina')",
      [conversation.id, child.id],
    );

    const request = await createPrivacyRequest(client, {
      requesterId: child.id,
      subjectId: child.id,
      requestType: "rectification",
      details: "Je veux corriger mon prénom affiché.",
    });
    assert.equal(request.status, "submitted");
    assert.ok(new Date(request.due_at).getTime() > new Date(request.created_at).getTime());

    const parentExport = await createReadablePrivacyExport(client, {
      requesterId: parent.id,
      subjectId: child.id,
      controllerEmail: "contact@example.test",
    });
    assert.equal(parentExport.authoredMessages[0].content, null);
    assert.equal(parentExport.authoredMessages[0].contentWithheld, true);

    const childExport = await createReadablePrivacyExport(client, {
      requesterId: child.id,
      subjectId: child.id,
      controllerEmail: "contact@example.test",
    });
    assert.equal(childExport.authoredMessages[0].content, "Message privé de Lina");
    assert.equal(childExport.rightsRequests.length, 1);
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
    await pool.end();
  }
});
