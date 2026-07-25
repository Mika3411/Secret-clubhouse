import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("la messagerie parent garde le compositeur au-dessus de la navigation mobile", async () => {
  const css = await readFile(new URL("../src/styles/conversations.css", import.meta.url), "utf8");

  assert.match(css, /\.parent-messages-workspace\s*\{[^}]*--parent-navigation-clearance:[^;}]+;[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/su);
  assert.match(css, /\.parent-inbox-layout\s*\{[^}]*display:\s*grid;[^}]*height:\s*100%;[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\);[^}]*padding-bottom:\s*var\(--parent-navigation-clearance\);[^}]*overflow:\s*hidden;/su);
  assert.match(css, /\.parent-thread-detail\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/su);
  assert.match(css, /\.parent-thread-detail \.parent-thread-messages\s*\{[^}]*min-width:\s*0;[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;/su);
  assert.match(css, /\.parent-thread-detail \.parent-message-composer\s*\{[^}]*padding-bottom:\s*10px;/su);
  assert.match(css, /\.chat-body\s*>\s*\*,\s*\.parent-thread-messages\s*>\s*\*\s*\{[^}]*flex-shrink:\s*0;/su);
});
