import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createContactQrUrl } from "../src/public-app-url.js";

test("le QR natif utilise uniquement l’URL publique configurée", () => {
  const contactUrl = createContactQrUrl({
    contactId: "sc-123-456-789",
    publicAppUrl: "https://secret-clubhouse.onrender.com/",
    browserOrigin: "http://localhost",
    native: true,
  });

  assert.equal(
    contactUrl,
    "https://secret-clubhouse.onrender.com/?contact=SC-123-456-789",
  );
});

test("le QR natif refuse les origines locales ou Capacitor de repli", () => {
  assert.equal(createContactQrUrl({
    contactId: "SC-123-456-789",
    publicAppUrl: "http://localhost",
    native: true,
  }), "");

  assert.equal(createContactQrUrl({
    contactId: "SC-123-456-789",
    browserOrigin: "http://localhost",
    native: true,
  }), "");

  assert.equal(createContactQrUrl({
    contactId: "SC-123-456-789",
    publicAppUrl: "capacitor://localhost",
    native: true,
  }), "");
});

test("le build de production configure l’URL publique du QR", async () => {
  const blueprint = await readFile(new URL("../render.yaml", import.meta.url), "utf8");
  assert.match(
    blueprint,
    /key:\s*VITE_PUBLIC_APP_URL\s*\r?\n\s*value:\s*https:\/\/secret-clubhouse\.onrender\.com/u,
  );
});
