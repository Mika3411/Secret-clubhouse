import {
  contentEncryptionFields,
  contentEncryptionVersion,
  getContentCipher,
} from "./content-encryption.js";

function valueFrom(row, snakeName, camelName) {
  return row?.[snakeName] ?? row?.[camelName] ?? null;
}

export function messageEncryptionContext(row) {
  return {
    messageId: String(valueFrom(row, "id", "messageId") ?? ""),
    conversationId: String(valueFrom(row, "conversation_id", "conversationId") ?? ""),
    senderId: String(valueFrom(row, "sender_id", "senderId") ?? ""),
  };
}

export function encryptMessageContent({
  id,
  conversationId,
  senderId,
  body = null,
  mediaName = null,
  mediaType = null,
  mediaData = null,
}, cipher = getContentCipher()) {
  const context = messageEncryptionContext({
    id,
    conversation_id: conversationId,
    sender_id: senderId,
  });
  const hasMedia = mediaData !== null && mediaData !== undefined;
  return {
    bodyCiphertext: body === null || body === undefined
      ? null
      : cipher.encryptText(body, context, contentEncryptionFields.body),
    mediaNameCiphertext: hasMedia
      ? cipher.encryptText(mediaName || "media", context, contentEncryptionFields.mediaName)
      : null,
    mediaTypeCiphertext: hasMedia
      ? cipher.encryptText(mediaType || "application/octet-stream", context, contentEncryptionFields.mediaType)
      : null,
    mediaCiphertext: hasMedia
      ? cipher.encryptBinary(mediaData, context, contentEncryptionFields.media)
      : null,
    encryptionVersion: contentEncryptionVersion,
    encryptionKeyId: cipher.activeKeyId,
  };
}

export function decryptMessageContent(row, cipher = getContentCipher()) {
  const context = messageEncryptionContext(row);
  const version = Number(valueFrom(row, "content_encryption_version", "contentEncryptionVersion") ?? 0);
  if (version === 0) {
    const legacyOptions = { version: 0, allowLegacy: true };
    return {
      body: valueFrom(row, "body", "text") === null
        ? null
        : cipher.decryptText(valueFrom(row, "body", "text"), context, contentEncryptionFields.body, legacyOptions),
      mediaName: valueFrom(row, "media_name", "mediaName") === null
        ? null
        : cipher.decryptText(valueFrom(row, "media_name", "mediaName"), context, contentEncryptionFields.mediaName, legacyOptions),
      mediaType: valueFrom(row, "media_type", "mediaType") === null
        ? null
        : cipher.decryptText(valueFrom(row, "media_type", "mediaType"), context, contentEncryptionFields.mediaType, legacyOptions),
      mediaData: valueFrom(row, "media_data", "mediaData") === null
        ? null
        : cipher.decryptBinary(valueFrom(row, "media_data", "mediaData"), context, contentEncryptionFields.media, legacyOptions),
      encryptionVersion: 0,
      encryptionKeyId: null,
    };
  }
  if (version !== contentEncryptionVersion) {
    throw new Error(`Version de chiffrement de message non prise en charge : ${version}.`);
  }
  const encryptedOptions = { version: contentEncryptionVersion };
  const bodyCiphertext = valueFrom(row, "body_ciphertext", "bodyCiphertext");
  const mediaNameCiphertext = valueFrom(row, "media_name_ciphertext", "mediaNameCiphertext");
  const mediaTypeCiphertext = valueFrom(row, "media_type_ciphertext", "mediaTypeCiphertext");
  const mediaCiphertext = valueFrom(row, "media_ciphertext", "mediaCiphertext");
  const declaredKeyId = String(
    valueFrom(row, "content_encryption_key_id", "contentEncryptionKeyId") ?? "",
  );
  const envelopeKeyIds = [
    bodyCiphertext === null ? null : cipher.textKeyId(bodyCiphertext, encryptedOptions),
    mediaNameCiphertext === null ? null : cipher.textKeyId(mediaNameCiphertext, encryptedOptions),
    mediaTypeCiphertext === null ? null : cipher.textKeyId(mediaTypeCiphertext, encryptedOptions),
    mediaCiphertext === null ? null : cipher.binaryKeyId(mediaCiphertext, encryptedOptions),
  ].filter(Boolean);
  if (!/^[0-9a-f]{16}$/.test(declaredKeyId)
    || !envelopeKeyIds.length
    || envelopeKeyIds.some((keyId) => keyId !== declaredKeyId)) {
    throw new Error("Les métadonnées de chiffrement du message ne correspondent pas à ses enveloppes.");
  }
  return {
    body: bodyCiphertext === null
      ? null
      : cipher.decryptText(bodyCiphertext, context, contentEncryptionFields.body, encryptedOptions),
    mediaName: mediaNameCiphertext === null
      ? null
      : cipher.decryptText(mediaNameCiphertext, context, contentEncryptionFields.mediaName, encryptedOptions),
    mediaType: mediaTypeCiphertext === null
      ? null
      : cipher.decryptText(mediaTypeCiphertext, context, contentEncryptionFields.mediaType, encryptedOptions),
    mediaData: mediaCiphertext === null
      ? null
      : cipher.decryptBinary(mediaCiphertext, context, contentEncryptionFields.media, encryptedOptions),
    encryptionVersion: contentEncryptionVersion,
    encryptionKeyId: declaredKeyId,
  };
}

export function serializeDecryptedMessage(row, cipher = getContentCipher()) {
  const content = decryptMessageContent(row, cipher);
  return {
    ...row,
    text: content.body,
    mediaName: content.mediaName,
    mediaType: content.mediaType,
  };
}
