import test from "node:test";
import assert from "node:assert/strict";
import { registrationLegalEvidence } from "../src/legal-framework.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test("cycle PostgreSQL demande → approbation/refus → conversation", {
  skip: testDatabaseUrl ? false : "TEST_DATABASE_URL non configurée",
}, async (t) => {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.JWT_SECRET = "contact-lifecycle-integration-secret-with-32-characters";
  process.env.CONTENT_ENCRYPTION_KEY = "contact-lifecycle-content-key-with-at-least-32-bytes";

  const [{ app }, { initializeDatabase, pool }] = await Promise.all([
    import("./index.js"),
    import("./db.js"),
  ]);

  await initializeDatabase();
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.once("error", reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await pool.end();
  });

  const apiRequest = async (path, { token, method = "GET", body } = {}) => {
    const response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        "X-Secret-Clubhouse-Client": "native",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  };

  const registerFamily = async (suffix) => {
    const parentPassword = `Parent-${suffix}-secret`;
    const registration = await apiRequest("/auth/register", {
      method: "POST",
      body: {
        name: `Parent ${suffix}`,
        email: `parent-${suffix}@example.test`,
        password: parentPassword,
        legal: registrationLegalEvidence(),
      },
    });
    assert.equal(registration.response.status, 201, JSON.stringify(registration.payload));

    const childPassword = `Enfant-${suffix}-secret`;
    const childCreation = await apiRequest("/children", {
      token: registration.payload.token,
      method: "POST",
      body: {
        name: `Enfant ${suffix}`,
        age: 9,
        username: `enfant-${suffix}`,
        color: "mint",
        password: childPassword,
      },
    });
    assert.equal(childCreation.response.status, 201, JSON.stringify(childCreation.payload));

    return {
      parent: registration.payload.account,
      parentToken: registration.payload.token,
      child: childCreation.payload.child,
      childPassword,
    };
  };

  const familyA = await registerFamily("alpha");
  const familyB = await registerFamily("beta");
  const familyC = await registerFamily("gamma");

  const createdRequest = await apiRequest("/contact-requests", {
    token: familyA.parentToken,
    method: "POST",
    body: {
      requesterContactId: familyA.child.contactId,
      contactId: familyB.child.contactId,
    },
  });
  assert.equal(createdRequest.response.status, 201, JSON.stringify(createdRequest.payload));
  assert.equal(createdRequest.payload.request.status, "pending");
  assert.equal(createdRequest.payload.requester.contactId, familyA.child.contactId);
  assert.equal(createdRequest.payload.contact.contactId, familyB.child.contactId);

  const outgoingList = await apiRequest("/contact-requests", { token: familyA.parentToken });
  assert.equal(outgoingList.response.status, 200, JSON.stringify(outgoingList.payload));
  assert.equal(outgoingList.payload.requests[0].direction, "outgoing");
  assert.equal(outgoingList.payload.requests[0].canRespond, false);

  const incomingList = await apiRequest("/contact-requests", { token: familyB.parentToken });
  assert.equal(incomingList.response.status, 200, JSON.stringify(incomingList.payload));
  const incomingRequest = incomingList.payload.requests.find((request) => request.id === createdRequest.payload.request.id);
  assert.equal(incomingRequest.direction, "incoming");
  assert.equal(incomingRequest.canRespond, true);
  assert.equal(incomingRequest.requester.contactId, familyA.child.contactId);
  assert.equal(incomingRequest.target.contactId, familyB.child.contactId);

  const unauthorizedApproval = await apiRequest(`/contact-requests/${createdRequest.payload.request.id}`, {
    token: familyA.parentToken,
    method: "PATCH",
    body: { action: "accept" },
  });
  assert.equal(unauthorizedApproval.response.status, 404);

  const approval = await apiRequest(`/contact-requests/${createdRequest.payload.request.id}`, {
    token: familyB.parentToken,
    method: "PATCH",
    body: { action: "accept" },
  });
  assert.equal(approval.response.status, 200, JSON.stringify(approval.payload));
  assert.equal(approval.payload.request.status, "approved");
  assert.match(approval.payload.request.conversationId, /^[0-9a-f-]{36}$/i);

  const approvedState = await apiRequest("/contact-requests", { token: familyB.parentToken });
  assert.equal(approvedState.response.status, 200, JSON.stringify(approvedState.payload));
  assert.ok(approvedState.payload.contacts.some(({ account, contact, conversationId }) => (
    account.contactId === familyB.child.contactId
    && contact.contactId === familyA.child.contactId
    && conversationId === approval.payload.request.conversationId
  )));
  assert.ok(approvedState.payload.contacts.some(({ account, contact }) => (
    account.contactId === familyB.parent.contactId
    && contact.contactId === familyA.parent.contactId
  )));

  const childLogin = await apiRequest("/auth/login", {
    method: "POST",
    body: {
      contactId: familyB.child.contactId,
      password: familyB.childPassword,
    },
  });
  assert.equal(childLogin.response.status, 200, JSON.stringify(childLogin.payload));
  const childConversations = await apiRequest("/conversations", { token: childLogin.payload.token });
  assert.equal(childConversations.response.status, 200, JSON.stringify(childConversations.payload));
  assert.ok(childConversations.payload.conversations.some((conversation) => (
    conversation.id === approval.payload.request.conversationId
    && conversation.contact_id === familyA.child.contactId
  )));

  const duplicateRequest = await apiRequest("/contact-requests", {
    token: familyA.parentToken,
    method: "POST",
    body: {
      requesterContactId: familyA.child.contactId,
      contactId: familyB.child.contactId,
    },
  });
  assert.equal(duplicateRequest.response.status, 409);

  const requestToDecline = await apiRequest("/contact-requests", {
    token: familyA.parentToken,
    method: "POST",
    body: {
      requesterContactId: familyA.child.contactId,
      contactId: familyC.child.contactId,
    },
  });
  assert.equal(requestToDecline.response.status, 201, JSON.stringify(requestToDecline.payload));

  const decline = await apiRequest(`/contact-requests/${requestToDecline.payload.request.id}`, {
    token: familyC.parentToken,
    method: "PATCH",
    body: { action: "decline" },
  });
  assert.equal(decline.response.status, 200, JSON.stringify(decline.payload));
  assert.equal(decline.payload.request.status, "declined");
  assert.equal(decline.payload.request.conversationId, null);

  const declinedState = await apiRequest("/contact-requests", { token: familyC.parentToken });
  assert.equal(declinedState.response.status, 200, JSON.stringify(declinedState.payload));
  assert.ok(declinedState.payload.requests.some((request) => (
    request.id === requestToDecline.payload.request.id
    && request.status === "declined"
  )));
  assert.ok(!declinedState.payload.contacts.some(({ contact }) => (
    contact.contactId === familyA.child.contactId
  )));
});
