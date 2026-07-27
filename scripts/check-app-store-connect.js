import { readFile } from "node:fs/promises";
import { createPrivateKey, sign } from "node:crypto";

const requiredVariables = [
  "APPLE_BUNDLE_ID",
  "APPSTORE_API_KEY_ID",
  "APPSTORE_ISSUER_ID",
  "APPSTORE_API_KEY_PATH",
];
const missingVariables = requiredVariables.filter(
  (name) => !process.env[name]?.trim(),
);

if (missingVariables.length > 0) {
  throw new Error(
    `Configuration App Store Connect manquante : ${missingVariables.join(", ")}`,
  );
}

const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const unsignedToken = [
  encode({
    alg: "ES256",
    kid: process.env.APPSTORE_API_KEY_ID,
    typ: "JWT",
  }),
  encode({
    iss: process.env.APPSTORE_ISSUER_ID,
    iat: now - 10,
    exp: now + 600,
    aud: "appstoreconnect-v1",
  }),
].join(".");
const privateKey = createPrivateKey(
  await readFile(process.env.APPSTORE_API_KEY_PATH, "utf8"),
);
const signature = sign("sha256", Buffer.from(unsignedToken), {
  key: privateKey,
  dsaEncoding: "ieee-p1363",
}).toString("base64url");
const token = `${unsignedToken}.${signature}`;

const url = new URL("https://api.appstoreconnect.apple.com/v1/apps");
url.searchParams.set("filter[bundleId]", process.env.APPLE_BUNDLE_ID);
url.searchParams.set("limit", "1");

const response = await fetch(url, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
const body = await response.json().catch(() => ({}));

if (!response.ok) {
  const details = Array.isArray(body.errors)
    ? body.errors
        .map(({ status, code, title, detail }) =>
          [status, code, title, detail].filter(Boolean).join(" — "),
        )
        .join("\n")
    : `HTTP ${response.status}`;
  throw new Error(`Accès App Store Connect refusé :\n${details}`);
}

if (!Array.isArray(body.data) || body.data.length === 0) {
  throw new Error(
    `Aucune app App Store Connect n'utilise le Bundle ID ${process.env.APPLE_BUNDLE_ID}. Crée d'abord la fiche dans Apps > + > Nouvelle app.`,
  );
}

console.log(
  `Fiche App Store Connect trouvée : ${body.data[0].attributes?.name ?? process.env.APPLE_BUNDLE_ID}.`,
);
