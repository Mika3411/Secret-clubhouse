import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const conversationsSource = await readFile(
  new URL("../src/features/conversations/thread/useConversationBottom.js", import.meta.url),
  "utf8",
);

test("les conversations s’ancrent au dernier message avant le premier affichage", () => {
  assert.match(conversationsSource, /useLayoutEffect\(\(\) => \{/u);
  assert.match(conversationsSource, /scrollContainer\.scrollTop = scrollContainer\.scrollHeight/u);
  assert.match(conversationsSource, /\}, \[conversationId, latestItemKey\]\);/u);
});

test("l’ancrage suit le chargement tardif des médias sans bloquer la lecture de l’historique", () => {
  assert.match(conversationsSource, /new ResizeObserver\(scrollToLatest\)/u);
  assert.match(conversationsSource, /addEventListener\("load", scrollToLatest, true\)/u);
  assert.match(conversationsSource, /addEventListener\("wheel", releasePinnedPosition/u);
  assert.match(conversationsSource, /addEventListener\("touchstart", releasePinnedPosition/u);
  assert.match(conversationsSource, /addEventListener\("pointerdown", releasePinnedPosition/u);
});
