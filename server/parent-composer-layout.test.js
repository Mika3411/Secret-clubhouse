import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("la messagerie parent garde le compositeur au-dessus de la navigation mobile", async () => {
  const css = await readFile(new URL("../src/styles/conversations.css", import.meta.url), "utf8");

  assert.match(css, /\.parent-messages-workspace\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/su);
  assert.match(css, /\.parent-inbox-layout\s*\{[^}]*height:\s*100%;[^}]*padding-bottom:\s*calc\(78px \+ env\(safe-area-inset-bottom\)\);[^}]*overflow:\s*hidden;/su);
  assert.match(css, /\.parent-thread-detail\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/su);
  assert.match(css, /\.parent-thread-detail \.parent-thread-messages\s*\{[^}]*overflow-y:\s*auto;/su);
});
