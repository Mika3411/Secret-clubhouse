import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const conversationsSource = await readFile(
  new URL("../src/features/ConversationsSpace.jsx", import.meta.url),
  "utf8",
);
const conversationsStyles = await readFile(
  new URL("../src/styles/conversations.css", import.meta.url),
  "utf8",
);

test("the remote video stays hidden until it has rendered real media", () => {
  assert.match(conversationsSource, /isRemoteVideoReady/);
  assert.match(conversationsSource, /onLoadedData=\{\(\) => setIsRemoteVideoReady\(true\)\}/);
  assert.match(conversationsSource, /remote-video--guarded/);
  assert.match(conversationsStyles, /\.remote-video--guarded\s*\{[^}]*opacity:\s*0;/s);
  assert.match(conversationsStyles, /\.remote-video--guarded\.is-ready\s*\{[^}]*opacity:\s*1;/s);
});

test("the waiting state replaces the browser empty-video placeholder", () => {
  assert.match(conversationsSource, /remote-video-placeholder/);
  assert.match(conversationsSource, /L’image de \{conversation\.name\} apparaîtra ici\./);
  assert.match(conversationsStyles, /\.remote-video-placeholder\s*\{[^}]*align-content:\s*center;/s);
});
