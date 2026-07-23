import test from "node:test";
import assert from "node:assert/strict";
import {
  binaryEncryptionOverheadBytes,
  contentEncryptionFields,
  contentEncryptionVersion,
  createContentCipher,
  getContentCipher,
} from "./content-encryption.js";

const activeSecret = "active-content-secret-for-tests-2026-07-23-A";
const previousSecret = "previous-content-secret-for-tests-2026-07-23-B";
const nextSecret = "next-content-secret-for-tests-2026-07-23-C";

const context = Object.freeze({
  messageId: "11111111-1111-4111-8111-111111111111",
  conversationId: "22222222-2222-4222-8222-222222222222",
  senderId: "33333333-3333-4333-8333-333333333333",
});

const encryptedOptions = Object.freeze({ version: contentEncryptionVersion });
const legacyOptions = Object.freeze({ version: 0, allowLegacy: true });

function envWithKey(secret, previous = []) {
  return {
    NODE_ENV: "test",
    CONTENT_ENCRYPTION_KEY: secret,
    CONTENT_ENCRYPTION_PREVIOUS_KEYS: JSON.stringify(previous),
  };
}

function tamperTextPart(envelope, partIndex) {
  const parts = envelope.split(".");
  const bytes = Buffer.from(parts[partIndex], "base64url");
  if (!bytes.length) throw new Error("La partie à altérer est vide.");
  bytes[0] ^= 0x01;
  parts[partIndex] = bytes.toString("base64url");
  bytes.fill(0);
  return parts.join(".");
}

test("exige une clé dédiée explicite dans tous les environnements", () => {
  assert.throws(
    () => createContentCipher({
      NODE_ENV: "development",
      JWT_SECRET: "jwt-secret-that-must-never-be-used-for-content-encryption",
    }),
    /CONTENT_ENCRYPTION_KEY est requis/,
  );
  assert.throws(
    () => createContentCipher(envWithKey("beaucoup-trop-court")),
    /au moins 32 octets/,
  );
  assert.throws(
    () => createContentCipher({
      ...envWithKey(activeSecret),
      CONTENT_ENCRYPTION_PREVIOUS_KEYS: "pas du JSON",
    }),
    /tableau JSON/,
  );
  assert.throws(
    () => createContentCipher({
      ...envWithKey(activeSecret),
      CONTENT_ENCRYPTION_PREVIOUS_KEYS: JSON.stringify(["court"]),
    }),
    /au moins 32 octets/,
  );
});

test("chiffre et déchiffre body, nom, MIME et bytea avec des champs distincts", () => {
  const cipher = createContentCipher(envWithKey(activeSecret));
  const body = "Bonjour Cyrielle 👋 — message privé.";
  const mediaName = "été à la mer.png";
  const mediaType = "image/png";
  const media = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xfe, 0xff, 0x53, 0x43]);

  const encryptedBody = cipher.encryptText(body, context, contentEncryptionFields.body);
  const encryptedName = cipher.encryptText(mediaName, context, contentEncryptionFields.mediaName);
  const encryptedType = cipher.encryptText(mediaType, context, contentEncryptionFields.mediaType);
  const encryptedMedia = cipher.encryptBinary(media, context, contentEncryptionFields.media);

  assert.equal(contentEncryptionVersion, 1);
  assert.deepEqual(contentEncryptionFields, {
    body: "body",
    mediaName: "mediaName",
    mediaType: "mediaType",
    media: "media",
  });
  assert.match(encryptedBody, /^sc1\.[0-9a-f]{16}\./);
  assert.doesNotMatch(encryptedBody, /Bonjour|Cyrielle/);
  assert.notEqual(encryptedName, mediaName);
  assert.notEqual(encryptedType, mediaType);
  assert.equal(encryptedMedia.length, media.length + binaryEncryptionOverheadBytes);
  assert.equal(binaryEncryptionOverheadBytes, 40);
  assert.notDeepEqual(encryptedMedia.subarray(binaryEncryptionOverheadBytes), media);

  assert.equal(
    cipher.decryptText(encryptedBody, context, contentEncryptionFields.body, encryptedOptions),
    body,
  );
  assert.equal(
    cipher.decryptText(encryptedName, context, contentEncryptionFields.mediaName, encryptedOptions),
    mediaName,
  );
  assert.equal(
    cipher.decryptText(encryptedType, context, contentEncryptionFields.mediaType, encryptedOptions),
    mediaType,
  );
  assert.deepEqual(
    cipher.decryptBinary(encryptedMedia, context, contentEncryptionFields.media, encryptedOptions),
    media,
  );
  assert.equal(cipher.textKeyId(encryptedBody, encryptedOptions), cipher.activeKeyId);
  assert.equal(cipher.binaryKeyId(encryptedMedia, encryptedOptions), cipher.activeKeyId);
  assert.equal(cipher.encryptText(null, context), null);
  assert.equal(cipher.decryptText(null, context), null);
  assert.equal(cipher.encryptBinary(null, context), null);
  assert.equal(cipher.decryptBinary(null, context), null);
});

test("authentifie messageId, conversationId, senderId et le nom du champ", () => {
  const cipher = createContentCipher(envWithKey(activeSecret));
  const encrypted = cipher.encryptText(
    "contenu lié à son contexte",
    context,
    contentEncryptionFields.body,
  );

  for (const property of ["messageId", "conversationId", "senderId"]) {
    assert.throws(() => cipher.decryptText(
      encrypted,
      { ...context, [property]: `${context[property]}-altéré` },
      contentEncryptionFields.body,
      encryptedOptions,
    ));
  }
  assert.throws(() => cipher.decryptText(
    encrypted,
    context,
    contentEncryptionFields.mediaName,
    encryptedOptions,
  ));
  assert.throws(() => cipher.encryptText("x", { messageId: context.messageId }));
  assert.throws(() => cipher.encryptText("x", context, "champ invalide !"));
});

test("rejette toute altération de l'IV, du tag ou du ciphertext", () => {
  const cipher = createContentCipher(envWithKey(activeSecret));
  const encryptedText = cipher.encryptText(
    "texte authentifié",
    context,
    contentEncryptionFields.body,
  );

  for (const partIndex of [2, 3, 4]) {
    const altered = tamperTextPart(encryptedText, partIndex);
    assert.throws(() => cipher.decryptText(
      altered,
      context,
      contentEncryptionFields.body,
      encryptedOptions,
    ));
  }

  const encryptedMedia = cipher.encryptBinary(
    Buffer.from("média authentifié"),
    context,
    contentEncryptionFields.media,
  );
  for (const offset of [4 + 8, 4 + 8 + 12, encryptedMedia.length - 1]) {
    const altered = Buffer.from(encryptedMedia);
    altered[offset] ^= 0x01;
    assert.throws(() => cipher.decryptBinary(
      altered,
      context,
      contentEncryptionFields.media,
      encryptedOptions,
    ));
  }
});

test("reste strict par défaut et n'autorise le legacy que par version explicite", () => {
  const cipher = createContentCipher(envWithKey(activeSecret));
  const legacyText = "sc1.ceci.reste.un.ancien.message";
  const legacyBinary = Buffer.from("SCB1ancien-media-non-chiffre", "utf8");

  assert.throws(() => cipher.decryptText(
    "ancien message",
    context,
    contentEncryptionFields.body,
    encryptedOptions,
  ));
  assert.throws(() => cipher.decryptBinary(
    Buffer.from("ancien média"),
    context,
    contentEncryptionFields.media,
    encryptedOptions,
  ));
  assert.throws(() => cipher.decryptText(
    legacyText,
    context,
    contentEncryptionFields.body,
    { version: 0 },
  ));
  assert.throws(() => cipher.decryptText(
    "ancien message",
    context,
    contentEncryptionFields.body,
    { version: 1, allowLegacy: true },
  ));
  assert.throws(() => cipher.decryptText(
    "ancien message",
    context,
    contentEncryptionFields.body,
    { version: 2, allowLegacy: true },
  ));

  assert.equal(
    cipher.decryptText(legacyText, context, contentEncryptionFields.body, legacyOptions),
    legacyText,
  );
  assert.deepEqual(
    cipher.decryptBinary(legacyBinary, context, contentEncryptionFields.media, legacyOptions),
    legacyBinary,
  );
  assert.equal(cipher.textKeyId(legacyText, legacyOptions), null);
  assert.equal(cipher.binaryKeyId(legacyBinary, legacyOptions), null);
});

test("permet une rotation avec les anciennes clés sans les utiliser pour les nouvelles écritures", () => {
  const oldCipher = createContentCipher(envWithKey(previousSecret));
  const oldText = oldCipher.encryptText(
    "message créé avant rotation",
    context,
    contentEncryptionFields.body,
  );
  const oldMedia = oldCipher.encryptBinary(
    Buffer.from("media-before-rotation"),
    context,
    contentEncryptionFields.media,
  );

  const rotatedCipher = createContentCipher(envWithKey(nextSecret, [previousSecret]));
  assert.notEqual(rotatedCipher.activeKeyId, oldCipher.activeKeyId);
  assert.equal(
    rotatedCipher.decryptText(oldText, context, contentEncryptionFields.body, encryptedOptions),
    "message créé avant rotation",
  );
  assert.deepEqual(
    rotatedCipher.decryptBinary(oldMedia, context, contentEncryptionFields.media, encryptedOptions),
    Buffer.from("media-before-rotation"),
  );

  const newText = rotatedCipher.encryptText(
    "message créé après rotation",
    context,
    contentEncryptionFields.body,
  );
  assert.equal(rotatedCipher.textKeyId(newText, encryptedOptions), rotatedCipher.activeKeyId);
  assert.throws(() => oldCipher.decryptText(
    newText,
    context,
    contentEncryptionFields.body,
    encryptedOptions,
  ));

  const withoutPreviousKey = createContentCipher(envWithKey(nextSecret));
  assert.throws(() => withoutPreviousKey.decryptText(
    oldText,
    context,
    contentEncryptionFields.body,
    encryptedOptions,
  ));
});

test("une autre clé active ne peut pas déchiffrer l'enveloppe", () => {
  const firstCipher = createContentCipher(envWithKey(activeSecret));
  const secondCipher = createContentCipher(envWithKey(nextSecret));
  const encrypted = firstCipher.encryptText(
    "secret",
    context,
    contentEncryptionFields.body,
  );
  assert.throws(() => secondCipher.decryptText(
    encrypted,
    context,
    contentEncryptionFields.body,
    encryptedOptions,
  ));
});

test("le cache ne conserve ni n'expose les secrets de configuration bruts", () => {
  const env = envWithKey(activeSecret, [previousSecret]);
  const first = getContentCipher(env);
  const same = getContentCipher({ ...env });
  assert.equal(first, same);
  assert.doesNotMatch(JSON.stringify(first), new RegExp(activeSecret));
  assert.doesNotMatch(JSON.stringify(first), new RegExp(previousSecret));

  const rotated = getContentCipher(envWithKey(nextSecret, [activeSecret]));
  assert.notEqual(rotated, first);
  assert.notEqual(rotated.activeKeyId, first.activeKeyId);
});
