import test from "node:test";
import assert from "node:assert/strict";
import { createContentCipher } from "./content-encryption.js";
import {
  decryptMessageContent,
  encryptMessageContent,
  messageEncryptionContext,
} from "./message-content.js";

const cipher = createContentCipher({
  CONTENT_ENCRYPTION_KEY: "message-content-tests-key-with-at-least-32-bytes",
});
const identity = {
  id: "11111111-1111-4111-8111-111111111111",
  conversationId: "22222222-2222-4222-8222-222222222222",
  senderId: "33333333-3333-4333-8333-333333333333",
};

test("chiffre un message sans conserver son texte dans les colonnes applicatives", () => {
  const encrypted = encryptMessageContent({
    ...identity,
    body: "Le secret de Cyrielle",
  }, cipher);
  const row = {
    id: identity.id,
    conversation_id: identity.conversationId,
    sender_id: identity.senderId,
    body: null,
    media_name: null,
    media_type: null,
    media_data: null,
    body_ciphertext: encrypted.bodyCiphertext,
    media_name_ciphertext: encrypted.mediaNameCiphertext,
    media_type_ciphertext: encrypted.mediaTypeCiphertext,
    media_ciphertext: encrypted.mediaCiphertext,
    content_encryption_version: encrypted.encryptionVersion,
    content_encryption_key_id: encrypted.encryptionKeyId,
  };
  assert.doesNotMatch(row.body_ciphertext, /Cyrielle/);
  assert.equal(decryptMessageContent(row, cipher).body, "Le secret de Cyrielle");
});

test("chiffre ensemble le nom, le MIME et les octets d’un média", () => {
  const source = Buffer.from("private-image-bytes");
  const encrypted = encryptMessageContent({
    ...identity,
    mediaName: "photo-enfant.png",
    mediaType: "image/png",
    mediaData: source,
  }, cipher);
  const row = {
    id: identity.id,
    conversation_id: identity.conversationId,
    sender_id: identity.senderId,
    body_ciphertext: null,
    media_name_ciphertext: encrypted.mediaNameCiphertext,
    media_type_ciphertext: encrypted.mediaTypeCiphertext,
    media_ciphertext: encrypted.mediaCiphertext,
    content_encryption_version: encrypted.encryptionVersion,
    content_encryption_key_id: encrypted.encryptionKeyId,
  };
  const decrypted = decryptMessageContent(row, cipher);
  assert.equal(decrypted.mediaName, "photo-enfant.png");
  assert.equal(decrypted.mediaType, "image/png");
  assert.deepEqual(decrypted.mediaData, source);
});

test("le lecteur legacy dépend exclusivement de la version PostgreSQL explicite", () => {
  const legacy = {
    id: identity.id,
    conversation_id: identity.conversationId,
    sender_id: identity.senderId,
    body: "sc1.ancien.texte.qui.ressemble",
    media_name: null,
    media_type: null,
    media_data: null,
    content_encryption_version: 0,
  };
  assert.equal(decryptMessageContent(legacy, cipher).body, legacy.body);
  assert.deepEqual(messageEncryptionContext(legacy), {
    messageId: identity.id,
    conversationId: identity.conversationId,
    senderId: identity.senderId,
  });
});

test("refuse une métadonnée de clé qui ne correspond pas aux enveloppes", () => {
  const encrypted = encryptMessageContent({
    ...identity,
    body: "Contenu authentifié",
  }, cipher);
  assert.throws(
    () => decryptMessageContent({
      id: identity.id,
      conversation_id: identity.conversationId,
      sender_id: identity.senderId,
      body_ciphertext: encrypted.bodyCiphertext,
      media_name_ciphertext: null,
      media_type_ciphertext: null,
      media_ciphertext: null,
      content_encryption_version: encrypted.encryptionVersion,
      content_encryption_key_id: "0000000000000000",
    }, cipher),
    /métadonnées de chiffrement/u,
  );
});
