import test from "node:test";
import assert from "node:assert/strict";
import { privacySafeNotificationPayload } from "./notification-privacy.js";

const privateSentinel = "Cyriaque dit : rendez-vous secret à 18 h";

for (const notificationType of ["message", "contact-request", "game", "incoming-call"]) {
  test(`la notification ${notificationType} ne révèle ni nom ni contenu privé`, () => {
    const safe = privacySafeNotificationPayload({
      notificationType,
      title: privateSentinel,
      body: privateSentinel,
      callerName: privateSentinel,
      conversationId: "11111111-1111-4111-8111-111111111111",
      callActionToken: "opaque-action-token",
    });
    const serialized = JSON.stringify(safe);
    assert.doesNotMatch(serialized, new RegExp(privateSentinel));
    assert.equal(safe.conversationId, "11111111-1111-4111-8111-111111111111");
    assert.equal(safe.callActionToken, "opaque-action-token");
    if (notificationType === "incoming-call") {
      assert.equal(safe.callerName, "Contact autorisé");
    } else {
      assert.equal("callerName" in safe, false);
    }
  });
}

test("un état d’appel reste silencieux et conserve seulement son routage", () => {
  const safe = privacySafeNotificationPayload({
    notificationType: "call-state",
    title: privateSentinel,
    body: privateSentinel,
    callerName: privateSentinel,
    callId: "22222222-2222-4222-8222-222222222222",
    status: "declined",
  });
  assert.equal("title" in safe, false);
  assert.equal("body" in safe, false);
  assert.equal("callerName" in safe, false);
  assert.equal(safe.status, "declined");
});
