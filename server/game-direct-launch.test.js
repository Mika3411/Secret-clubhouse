import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("une invitation acceptée s’ouvre directement et une partie arrêtée perd sa carte", async () => {
  const [appSource, conversationSource, clubhouseSource, gameSource] = await Promise.all([
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/ConversationsSpace.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/ClubhouseSpace.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/ConnectFourGame.jsx", import.meta.url), "utf8"),
  ]);

  assert.match(conversationSource, /onOpenGames\?\.\(game\)/u);
  assert.match(conversationSource, /action === "stop"\s*\?\s*current\.filter\(\(item\) => item\.id !== updated\.id\)/u);
  assert.match(conversationSource, /\.filter\(\(game\) => game\.status !== "cancelled"\)/u);
  assert.match(appSource, /onOpenGames=\{\(game\) => \{[^}]*setRequestedGame\(game \?\? null\);[^}]*setActiveTab\("clubhouse"\);/u);
  assert.match(appSource, /<ParentGamesScreen parent=\{familyOwner\} initialGame=\{requestedGame\}/u);
  assert.match(clubhouseSource, /<ConnectFourGame child=\{child\} initialGame=\{initialGame\}/u);
  assert.match(gameSource, /setActiveGameId\]\s*=\s*useState\(\(\) => launchGame\?\.status === "active" \? launchGame\.id : null\)/u);
});
