import {
  contentEncryptionVersion,
  getContentCipher,
} from "./content-encryption.js";

function valueFrom(row, snakeName, camelName) {
  return row?.[snakeName] ?? row?.[camelName] ?? null;
}

function callSignalField(row) {
  const signalType = String(valueFrom(row, "signal_type", "signalType") ?? "");
  if (!["offer", "answer", "ice"].includes(signalType)) {
    throw new Error("Le type du signal WebRTC est invalide.");
  }
  return `callSignalPayload:${signalType}`;
}

export function callSignalEncryptionContext(row) {
  const callId = String(valueFrom(row, "call_id", "callId") ?? "");
  const recipientId = String(valueFrom(row, "recipient_id", "recipientId") ?? "");
  return {
    messageId: String(
      valueFrom(row, "encryption_context_id", "encryptionContextId") ?? "",
    ),
    conversationId: `${callId}:${recipientId}`,
    senderId: String(valueFrom(row, "sender_id", "senderId") ?? ""),
  };
}

export function encryptCallSignal({
  contextId,
  callId,
  senderId,
  recipientId,
  signalType,
  payload,
}, cipher = getContentCipher()) {
  const serialized = JSON.stringify(payload);
  if (typeof serialized !== "string") {
    throw new Error("Le signal WebRTC ne peut pas être sérialisé.");
  }
  const encryptionRow = {
    encryption_context_id: contextId,
    call_id: callId,
    sender_id: senderId,
    recipient_id: recipientId,
    signal_type: signalType,
  };
  const payloadCiphertext = cipher.encryptText(
    serialized,
    callSignalEncryptionContext(encryptionRow),
    callSignalField(encryptionRow),
  );
  return {
    payloadCiphertext,
    encryptionVersion: contentEncryptionVersion,
    encryptionKeyId: cipher.activeKeyId,
  };
}

export function decryptCallSignal(row, cipher = getContentCipher()) {
  const version = Number(
    valueFrom(row, "content_encryption_version", "contentEncryptionVersion") ?? 0,
  );
  if (version === 0) {
    const payload = valueFrom(row, "payload", "payload");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Le signal WebRTC legacy est invalide.");
    }
    return {
      payload,
      encryptionVersion: 0,
      encryptionKeyId: null,
    };
  }
  if (version !== contentEncryptionVersion) {
    throw new Error(`Version de chiffrement du signal WebRTC non prise en charge : ${version}.`);
  }

  const payloadCiphertext = valueFrom(row, "payload_ciphertext", "payloadCiphertext");
  const declaredKeyId = String(
    valueFrom(row, "content_encryption_key_id", "contentEncryptionKeyId") ?? "",
  );
  const envelopeKeyId = cipher.textKeyId(payloadCiphertext, {
    version: contentEncryptionVersion,
  });
  if (!/^[0-9a-f]{16}$/.test(declaredKeyId) || envelopeKeyId !== declaredKeyId) {
    throw new Error(
      "Les métadonnées de chiffrement du signal WebRTC ne correspondent pas à son enveloppe.",
    );
  }

  const plaintext = cipher.decryptText(
    payloadCiphertext,
    callSignalEncryptionContext(row),
    callSignalField(row),
    { version: contentEncryptionVersion },
  );
  let payload;
  try {
    payload = JSON.parse(plaintext);
  } catch {
    throw new Error("Le signal WebRTC déchiffré est invalide.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Le signal WebRTC déchiffré est invalide.");
  }
  return {
    payload,
    encryptionVersion: contentEncryptionVersion,
    encryptionKeyId: declaredKeyId,
  };
}
