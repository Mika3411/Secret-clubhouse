import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  isLegalNoticePath,
  legalHost,
  legalNoticeRoute,
  legalPublisher,
} from "../src/legal-notice.js";

test("les mentions légales utilisent les informations réelles disponibles", () => {
  assert.equal(legalPublisher.name, "Mickael Thorez");
  assert.match(legalPublisher.status, /particulier non professionnel/i);
  assert.equal(legalPublisher.servicePrice, "Gratuit");
  assert.match(legalPublisher.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  assert.equal(Object.hasOwn(legalPublisher, "address"), false);
  assert.doesNotMatch(JSON.stringify(legalPublisher), /à compléter|provisoire|exemple/i);

  assert.equal(legalHost.name, "Render Services, Inc.");
  assert.match(legalHost.address, /525 Brannan Street.*San Francisco/i);
  assert.match(legalHost.phoneDisplay, /\+1 415/);
  assert.match(legalHost.termsUrl, /^https:\/\/render\.com\/terms/);
});

test("les mentions légales ont une route publique stable", async () => {
  assert.equal(isLegalNoticePath(legalNoticeRoute), true);
  assert.equal(isLegalNoticePath("/"), false);

  const authSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(authSource, /openLegalNotice/);
  assert.match(authSource, /<LegalNoticeModal/);
  assert.match(authSource, /Mentions légales/);
});
