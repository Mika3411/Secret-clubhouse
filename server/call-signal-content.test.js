import test from "node:test";
import assert from "node:assert/strict";
import { createContentCipher } from "./content-encryption.js";
import {
  callSignalEncryptionContext,
  decryptCallSignal,
  encryptCallSignal,
} from "./call-signal-content.js";

const cipher = createContentCipher({
  CONTENT_ENCRYPTION_KEY: "call-signal-content-test-key-with-at-least-32-bytes",
});
const identity = {
  contextId: "11111111-1111-4111-8111-111111111111",
  callId: "22222222-2222-4222-8222-222222222222",
  senderId: "33333333-3333-4333-8333-333333333333",
  recipientId: "44444444-4444-4444-8444-444444444444",
  signalType: "offer",
};

test("chiffre et authentifie le payload SDP/ICE avant PostgreSQL", () => {
  const source = {
    type: "offer",
    sdp: "v=0\r\nc=IN IP4 192.0.2.10\r\n",
  };
  const encrypted = encryptCallSignal({ ...identity, payload: source }, cipher);
  assert.doesNotMatch(encrypted.payloadCiphertext, /192\.0\.2\.10|offer/u);

  const row = {
    encryption_context_id: identity.contextId,
    call_id: identity.callId,
    sender_id: identity.senderId,
    recipient_id: identity.recipientId,
    signal_type: identity.signalType,
    payload: null,
    payload_ciphertext: encrypted.payloadCiphertext,
    content_encryption_version: encrypted.encryptionVersion,
    content_encryption_key_id: encrypted.encryptionKeyId,
  };
  assert.deepEqual(decryptCallSignal(row, cipher).payload, source);
  assert.deepEqual(callSignalEncryptionContext(row), {
    messageId: identity.contextId,
    conversationId: `${identity.callId}:${identity.recipientId}`,
    senderId: identity.senderId,
  });
});

test("refuse un contexte ou un identifiant de clé modifié", () => {
  const encrypted = encryptCallSignal({
    ...identity,
    signalType: "ice",
    payload: { candidate: "candidate:1 1 UDP 1 192.0.2.20 5000 typ host" },
  }, cipher);
  const row = {
    encryption_context_id: identity.contextId,
    call_id: identity.callId,
    sender_id: identity.senderId,
    recipient_id: identity.recipientId,
    signal_type: "ice",
    payload_ciphertext: encrypted.payloadCiphertext,
    content_encryption_version: encrypted.encryptionVersion,
    content_encryption_key_id: encrypted.encryptionKeyId,
  };
  assert.throws(
    () => decryptCallSignal({ ...row, call_id: "44444444-4444-4444-8444-444444444444" }, cipher),
  );
  assert.throws(
    () => decryptCallSignal({ ...row, content_encryption_key_id: "0000000000000000" }, cipher),
    /métadonnées de chiffrement/u,
  );
});

test("le legacy ne dépend que de la version PostgreSQL explicite", () => {
  const payload = { type: "answer", sdp: "sc1.false.envelope" };
  assert.deepEqual(
    decryptCallSignal({
      ...identity,
      recipient_id: identity.recipientId,
      signal_type: "answer",
      payload,
      content_encryption_version: 0,
    }, cipher).payload,
    payload,
  );
});
