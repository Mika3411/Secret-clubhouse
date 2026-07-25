import test from "node:test";
import assert from "node:assert/strict";
import { splitMessageLinks } from "../src/message-links.js";

test("message links expose only HTTP(S) URLs and preserve surrounding text", () => {
  assert.deepEqual(
    splitMessageLinks("Télécharge https://example.com/app.apk, puis http://example.org!"),
    [
      { type: "text", value: "Télécharge " },
      { type: "link", value: "https://example.com/app.apk", href: "https://example.com/app.apk" },
      { type: "text", value: ", puis " },
      { type: "link", value: "http://example.org", href: "http://example.org" },
      { type: "text", value: "!" },
    ],
  );
  assert.deepEqual(
    splitMessageLinks("<b>javascript:alert(1)</b>"),
    [{ type: "text", value: "<b>javascript:alert(1)</b>" }],
  );
});
