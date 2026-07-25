import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  describeMessageContent,
  getMessageReactionOption,
  messageReactionOptions,
  normalizeMessageReactionCode,
} from "../shared/message-interactions.js";

test("les réactions utilisent une liste courte et stable de codes sans HTML", () => {
  assert.deepEqual(
    messageReactionOptions.map(({ code }) => code),
    ["heart", "thumbs_up", "laugh", "wow", "sad", "clap"],
  );
  assert.equal(normalizeMessageReactionCode(" thumbs_up "), "thumbs_up");
  assert.equal(normalizeMessageReactionCode("<img>"), null);
  assert.equal(getMessageReactionOption("heart")?.emoji, "❤️");
});

test("l’aperçu d’une réponse reste court et décrit aussi les médias", () => {
  assert.equal(describeMessageContent({ text: "Bonjour" }), "Bonjour");
  assert.equal(describeMessageContent({ type: "image" }), "Photo");
  assert.equal(describeMessageContent({ type: "video" }), "Vidéo");
  assert.equal(describeMessageContent({ type: "audio" }), "Message vocal");
  assert.equal(describeMessageContent({ text: "a".repeat(120) }).length, 96);
});

test("le schéma et les routes gardent les interactions dans les conversations autorisées", async () => {
  const [databaseSource, serverSource] = await Promise.all([
    readFile(new URL("./db.js", import.meta.url), "utf8"),
    readFile(new URL("./index.js", import.meta.url), "utf8"),
  ]);
  assert.match(databaseSource, /create table if not exists message_reactions/);
  assert.match(databaseSource, /primary key\(message_id,account_id\)/);
  assert.match(databaseSource, /reply_to_message_id uuid references messages\(id\) on delete set null/);
  assert.match(serverSource, /messages\/:messageId\/reaction", requireAuth, requireActiveChild, requireConversationMessagingAccess/);
  assert.match(serverSource, /messages\/:messageId\/forward", requireAuth, requireActiveChild, requireConversationMessagingAccess/);
  assert.match(serverSource, /isConversationMember\(req\.auth\.sub, targetConversationId, client\)/);
  assert.match(serverSource, /replyToMessageId.*conversation_id=\$2/s);
});
