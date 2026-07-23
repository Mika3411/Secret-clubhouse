import crypto from "node:crypto";

const TEXT_ENVELOPE_PREFIX = "sc1";
const BINARY_ENVELOPE_MAGIC = Buffer.from("SCB1", "ascii");
const KEY_ID_BYTES = 8;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const BINARY_HEADER_BYTES = BINARY_ENVELOPE_MAGIC.length + KEY_ID_BYTES + IV_BYTES + AUTH_TAG_BYTES;
const KEY_DERIVATION_SALT = Buffer.from("secret-clubhouse-content-encryption-v1", "utf8");
const KEY_DERIVATION_INFO = Buffer.from("aes-256-gcm", "utf8");
const CONTEXT_VALUE_MAX_LENGTH = 200;
const FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/;

export const contentEncryptionVersion = 1;
export const contentEncryptionFields = Object.freeze({
  body: "body",
  mediaName: "mediaName",
  mediaType: "mediaType",
  media: "media",
});

/**
 * Binary envelope layout:
 *   magic (4) + key id (8) + IV (12) + authentication tag (16) + ciphertext.
 * AES-GCM ciphertext has the same length as its plaintext, so every encrypted
 * binary stored in bytea has exactly this fixed 40-byte overhead.
 */
export const binaryEncryptionOverheadBytes = BINARY_HEADER_BYTES;

function parsePreviousSecrets(value) {
  if (!value) return [];
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("CONTENT_ENCRYPTION_PREVIOUS_KEYS doit être un tableau JSON.");
  }
  if (!Array.isArray(parsed) || parsed.some((secret) => typeof secret !== "string")) {
    throw new Error("CONTENT_ENCRYPTION_PREVIOUS_KEYS doit contenir uniquement des chaînes.");
  }
  return parsed;
}

function resolveActiveSecret(env) {
  const configured = String(env.CONTENT_ENCRYPTION_KEY ?? "").trim();
  if (!configured) {
    throw new Error("CONTENT_ENCRYPTION_KEY est requis pour chiffrer les communications.");
  }
  return configured;
}

function deriveKey(secret, label) {
  const secretBytes = Buffer.from(String(secret), "utf8");
  if (secretBytes.length < 32) {
    secretBytes.fill(0);
    throw new Error(`${label} doit contenir au moins 32 octets.`);
  }

  let derivedBytes;
  try {
    derivedBytes = Buffer.from(crypto.hkdfSync(
      "sha256",
      secretBytes,
      KEY_DERIVATION_SALT,
      KEY_DERIVATION_INFO,
      32,
    ));
    const fingerprint = crypto.createHash("sha256").update(derivedBytes).digest("hex");
    return {
      id: fingerprint.slice(0, KEY_ID_BYTES * 2),
      fingerprint,
      key: crypto.createSecretKey(derivedBytes),
    };
  } finally {
    secretBytes.fill(0);
    derivedBytes?.fill(0);
  }
}

function validateContextValue(context, property) {
  const value = context?.[property];
  if (typeof value !== "string" || value.length === 0 || value.length > CONTEXT_VALUE_MAX_LENGTH) {
    throw new Error(`Le contexte de chiffrement requiert ${property}.`);
  }
  return value;
}

function normalizeContext(context, field) {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    throw new Error("Le contexte de chiffrement du message est requis.");
  }
  if (typeof field !== "string" || !FIELD_PATTERN.test(field)) {
    throw new Error("Le champ de chiffrement est invalide.");
  }
  return {
    messageId: validateContextValue(context, "messageId"),
    conversationId: validateContextValue(context, "conversationId"),
    senderId: validateContextValue(context, "senderId"),
    field,
  };
}

function appendLengthPrefixed(value, chunks) {
  const bytes = Buffer.from(value, "utf8");
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(bytes.length);
  chunks.push(length, bytes);
}

function aadFor(context, field) {
  const normalized = normalizeContext(context, field);
  const chunks = [];
  for (const value of [
    "secret-clubhouse",
    "message",
    `v${contentEncryptionVersion}`,
    normalized.messageId,
    normalized.conversationId,
    normalized.senderId,
    normalized.field,
  ]) {
    appendLengthPrefixed(value, chunks);
  }
  return Buffer.concat(chunks);
}

function normalizeDecryptionMode(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new Error("Les options de déchiffrement sont invalides.");
  }
  const version = Object.hasOwn(options, "version")
    ? options.version
    : contentEncryptionVersion;
  const legacy = version === null || version === 0;

  if (legacy) {
    if (options.allowLegacy !== true) {
      throw new Error("Le contenu legacy exige allowLegacy=true.");
    }
    return { legacy: true };
  }
  if (version !== contentEncryptionVersion) {
    throw new Error(`Version de chiffrement non prise en charge : ${String(version)}.`);
  }
  return { legacy: false };
}

function decodeBase64Url(value, expectedBytes = null) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]*$/.test(value)) {
    throw new Error("Enveloppe chiffrée invalide.");
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value || (expectedBytes !== null && decoded.length !== expectedBytes)) {
    decoded.fill(0);
    throw new Error("Enveloppe chiffrée invalide.");
  }
  return decoded;
}

function parseTextEnvelope(value) {
  if (typeof value !== "string" || !value.startsWith(`${TEXT_ENVELOPE_PREFIX}.`)) {
    throw new Error("Une enveloppe de texte chiffré est attendue.");
  }
  const parts = value.split(".");
  if (parts.length !== 5 || parts[0] !== TEXT_ENVELOPE_PREFIX || !/^[0-9a-f]{16}$/.test(parts[1])) {
    throw new Error("Enveloppe de texte chiffré invalide.");
  }
  return {
    keyId: parts[1],
    iv: decodeBase64Url(parts[2], IV_BYTES),
    authTag: decodeBase64Url(parts[3], AUTH_TAG_BYTES),
    ciphertext: decodeBase64Url(parts[4]),
  };
}

function asBinaryBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  throw new Error("Le contenu média doit être binaire.");
}

function parseBinaryEnvelope(value) {
  const bytes = asBinaryBuffer(value);
  if (bytes.length < BINARY_ENVELOPE_MAGIC.length
    || !bytes.subarray(0, BINARY_ENVELOPE_MAGIC.length).equals(BINARY_ENVELOPE_MAGIC)) {
    throw new Error("Une enveloppe de média chiffré est attendue.");
  }
  if (bytes.length < BINARY_HEADER_BYTES) {
    throw new Error("Enveloppe de média chiffré invalide.");
  }
  let offset = BINARY_ENVELOPE_MAGIC.length;
  const keyId = bytes.subarray(offset, offset + KEY_ID_BYTES).toString("hex");
  offset += KEY_ID_BYTES;
  const iv = bytes.subarray(offset, offset + IV_BYTES);
  offset += IV_BYTES;
  const authTag = bytes.subarray(offset, offset + AUTH_TAG_BYTES);
  offset += AUTH_TAG_BYTES;
  return { keyId, iv, authTag, ciphertext: bytes.subarray(offset) };
}

function legacyText(value, options) {
  const mode = normalizeDecryptionMode(options);
  return mode.legacy ? String(value) : null;
}

function legacyBinary(value, options) {
  const mode = normalizeDecryptionMode(options);
  return mode.legacy ? Buffer.from(asBinaryBuffer(value)) : null;
}

export function createContentCipher(env = process.env) {
  const active = deriveKey(resolveActiveSecret(env), "CONTENT_ENCRYPTION_KEY");
  const previous = parsePreviousSecrets(env.CONTENT_ENCRYPTION_PREVIOUS_KEYS)
    .map((secret, index) => deriveKey(secret, `CONTENT_ENCRYPTION_PREVIOUS_KEYS[${index}]`));
  const keys = new Map();
  for (const entry of [active, ...previous]) {
    const existing = keys.get(entry.id);
    if (existing && existing.fingerprint !== entry.fingerprint) {
      throw new Error("Collision d’identifiant de clé de chiffrement.");
    }
    keys.set(entry.id, entry);
  }

  const keyFor = (keyId) => {
    const entry = keys.get(keyId);
    if (!entry) throw new Error(`Clé de déchiffrement ${keyId} indisponible.`);
    return entry.key;
  };

  const encryptBytes = (plaintext, context, field) => {
    const iv = crypto.randomBytes(IV_BYTES);
    const aad = aadFor(context, field);
    try {
      const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        active.key,
        iv,
        { authTagLength: AUTH_TAG_BYTES },
      );
      cipher.setAAD(aad);
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const authTag = cipher.getAuthTag();
      return { iv, authTag, ciphertext };
    } finally {
      aad.fill(0);
    }
  };

  const decryptBytes = ({ keyId, iv, authTag, ciphertext }, context, field) => {
    const aad = aadFor(context, field);
    try {
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        keyFor(keyId),
        iv,
        { authTagLength: AUTH_TAG_BYTES },
      );
      decipher.setAAD(aad);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } finally {
      aad.fill(0);
    }
  };

  return Object.freeze({
    version: contentEncryptionVersion,
    activeKeyId: active.id,

    textKeyId(value, options = {}) {
      if (value === null || value === undefined) return null;
      if (normalizeDecryptionMode(options).legacy) return null;
      return parseTextEnvelope(value).keyId;
    },

    binaryKeyId(value, options = {}) {
      if (value === null || value === undefined) return null;
      if (normalizeDecryptionMode(options).legacy) return null;
      return parseBinaryEnvelope(value).keyId;
    },

    encryptText(value, context, field = contentEncryptionFields.body) {
      if (value === null || value === undefined) return null;
      const plaintext = Buffer.from(String(value), "utf8");
      try {
        const encrypted = encryptBytes(plaintext, context, field);
        return [
          TEXT_ENVELOPE_PREFIX,
          active.id,
          encrypted.iv.toString("base64url"),
          encrypted.authTag.toString("base64url"),
          encrypted.ciphertext.toString("base64url"),
        ].join(".");
      } finally {
        plaintext.fill(0);
      }
    },

    decryptText(value, context, field = contentEncryptionFields.body, options = {}) {
      if (value === null || value === undefined) return null;
      const legacy = legacyText(value, options);
      if (legacy !== null) return legacy;
      const plaintext = decryptBytes(parseTextEnvelope(value), context, field);
      try {
        return plaintext.toString("utf8");
      } finally {
        plaintext.fill(0);
      }
    },

    encryptBinary(value, context, field = contentEncryptionFields.media) {
      if (value === null || value === undefined) return null;
      const plaintext = asBinaryBuffer(value);
      const encrypted = encryptBytes(plaintext, context, field);
      return Buffer.concat([
        BINARY_ENVELOPE_MAGIC,
        Buffer.from(active.id, "hex"),
        encrypted.iv,
        encrypted.authTag,
        encrypted.ciphertext,
      ]);
    },

    decryptBinary(value, context, field = contentEncryptionFields.media, options = {}) {
      if (value === null || value === undefined) return null;
      const legacy = legacyBinary(value, options);
      if (legacy !== null) return legacy;
      return decryptBytes(parseBinaryEnvelope(value), context, field);
    },
  });
}

function updateFingerprint(hash, value) {
  const bytes = Buffer.from(String(value ?? ""), "utf8");
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(bytes.length);
  try {
    hash.update(length);
    hash.update(bytes);
  } finally {
    length.fill(0);
    bytes.fill(0);
  }
}

function configurationFingerprint(env) {
  const hash = crypto.createHash("sha256");
  updateFingerprint(hash, env.CONTENT_ENCRYPTION_KEY);
  updateFingerprint(hash, env.CONTENT_ENCRYPTION_PREVIOUS_KEYS);
  return hash.digest("hex");
}

let cachedCipher = null;
let cachedFingerprint = null;

export function getContentCipher(env = process.env) {
  const fingerprint = configurationFingerprint(env);
  if (!cachedCipher || cachedFingerprint !== fingerprint) {
    cachedCipher = createContentCipher(env);
    cachedFingerprint = fingerprint;
  }
  return cachedCipher;
}
