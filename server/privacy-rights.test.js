import test from "node:test";
import assert from "node:assert/strict";
import {
  createPrivacyRequest,
  createReadablePrivacyExport,
  serializePrivacyRequest,
} from "./privacy-service.js";

process.env.CONTENT_ENCRYPTION_KEY = "privacy-rights-unit-test-content-key-with-at-least-32-bytes";

const parentId = "11111111-1111-4111-8111-111111111111";
const childId = "22222222-2222-4222-8222-222222222222";
const familyId = "33333333-3333-4333-8333-333333333333";

function subjectRow(requesterId = parentId) {
  return {
    id: childId,
    role: "child",
    display_name: "Lina",
    email: null,
    contact_id: "SC-222-222-222",
    username: "lina",
    age: 9,
    avatar_config: {},
    status: "active",
    safety_settings: {},
    communication_schedule: {},
    created_at: "2026-07-01T10:00:00.000Z",
    last_activity_at: "2026-07-23T10:00:00.000Z",
    processing_restricted_at: null,
    requester_role: requesterId === childId ? "child" : "parent",
    requester_email: requesterId === childId ? null : "parent@example.test",
    requester_contact_id: requesterId === childId ? "SC-222-222-222" : "SC-111-111-111",
    requester_family_id: familyId,
    subject_family_id: familyId,
  };
}

function exportExecutor(requesterId) {
  return {
    async query(sql) {
      const statement = String(sql);
      if (statement.includes("from accounts requester")) return { rows: [subjectRow(requesterId)], rowCount: 1 };
      if (statement.includes("from families family")) return { rows: [{ id: familyId, name: "Famille test", parent_role: requesterId === parentId ? "primary" : null }] };
      if (statement.includes("from contact_relationships")) return { rows: [] };
      if (statement.includes("from contact_requests request")) return { rows: [] };
      if (statement.includes("from messages message")) {
        return {
          rows: [{
            id: "44444444-4444-4444-8444-444444444444",
            conversation_id: "55555555-5555-4555-8555-555555555555",
            body: "Un contenu privé entre enfants",
            media_name: "photo-privee.jpg",
            media_type: "image/jpeg",
            message_kind: "user",
            created_at: "2026-07-22T10:00:00.000Z",
            expires_at: "2026-10-20T10:00:00.000Z",
            requester_is_member: false,
          }],
        };
      }
      if (statement.includes("from clubhouse_activity_progress")) return { rows: [] };
      if (statement.includes("from game_sessions")) return { rows: [] };
      if (statement.includes("from call_sessions")) return { rows: [] };
      if (statement.includes("from push_subscriptions")) return { rows: [] };
      if (statement.includes("from privacy_requests")) return { rows: [] };
      throw new Error(`Requête inattendue : ${statement}`);
    },
  };
}

test("l’export parent masque les contenus enfant–ami auxquels le parent ne participe pas", async () => {
  const exported = await createReadablePrivacyExport(exportExecutor(parentId), {
    requesterId: parentId,
    subjectId: childId,
    controllerEmail: "contact@example.test",
    decryptContent: (message) => ({ body: message.body, mediaName: message.media_name, mediaType: message.media_type }),
  });

  assert.equal(exported.scope.childExportRequestedByParent, true);
  assert.equal(exported.authoredMessages[0].content, null);
  assert.equal(exported.authoredMessages[0].media.name, null);
  assert.equal(exported.authoredMessages[0].contentWithheld, true);
});

test("l’enfant retrouve le contenu de ses propres messages dans son export", async () => {
  const exported = await createReadablePrivacyExport(exportExecutor(childId), {
    requesterId: childId,
    subjectId: childId,
    controllerEmail: "contact@example.test",
    decryptContent: (message) => ({ body: message.body, mediaName: message.media_name, mediaType: message.media_type }),
  });

  assert.equal(exported.scope.childExportRequestedByParent, false);
  assert.equal(exported.authoredMessages[0].content, "Un contenu privé entre enfants");
  assert.equal(exported.authoredMessages[0].media.name, "photo-privee.jpg");
  assert.equal(exported.authoredMessages[0].contentWithheld, false);
});

test("une demande déposée par l’enfant est accusée et tracée", async () => {
  const statements = [];
  const requestRow = {
    id: "66666666-6666-4666-8666-666666666666",
    request_type: "rectification",
    status: "submitted",
    details: "Je veux corriger mon prénom.",
    subject_account_id: childId,
    subject_display_name: "Lina",
    subject_role: "child",
    created_at: "2026-07-23T10:00:00.000Z",
    acknowledged_at: "2026-07-23T10:00:00.000Z",
    due_at: "2026-08-23T10:00:00.000Z",
  };
  const executor = {
    async query(sql) {
      const statement = String(sql);
      statements.push(statement);
      if (statement.includes("from accounts requester")) return { rows: [subjectRow(childId)], rowCount: 1 };
      if (statement.includes("from privacy_requests") && statement.includes("status in")) return { rows: [], rowCount: 0 };
      if (statement.includes("insert into privacy_requests")) return { rows: [requestRow], rowCount: 1 };
      if (statement.includes("insert into privacy_request_events")) return { rows: [], rowCount: 2 };
      throw new Error(`Requête inattendue : ${statement}`);
    },
  };

  const request = await createPrivacyRequest(executor, {
    requesterId: childId,
    subjectId: childId,
    requestType: "rectification",
    details: "Je veux corriger mon prénom.",
  });

  assert.equal(serializePrivacyRequest(request).dueAt, "2026-08-23T10:00:00.000Z");
  assert.ok(statements.some((statement) => statement.includes("'requester','submitted'")));
  assert.ok(statements.some((statement) => statement.includes("'system','acknowledged'")));
});
