import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildFcmMessage,
  sanitizeNativePayload,
} from "./notifications/native-push.js";
import { privacySafeNotificationPayload } from "./notification-privacy.js";

const gameId = "33333333-3333-4333-8333-333333333333";
const privateSentinel = "Lina joue au Morpion contre Noah";

test("la notification de tour reste neutre et conserve le routage opaque", () => {
  const safe = privacySafeNotificationPayload({
    notificationType: "game",
    gameEvent: "turn",
    gameId,
    title: privateSentinel,
    body: privateSentinel,
    url: `/?notification=game&game=${gameId}`,
  });

  assert.equal(safe.title, "Secret Clubhouse");
  assert.equal(safe.body, "C’est à votre tour de jouer.");
  assert.equal(safe.gameId, gameId);
  assert.equal(safe.gameEvent, "turn");
  assert.doesNotMatch(JSON.stringify(safe), new RegExp(privateSentinel));

  const nativePayload = sanitizeNativePayload(safe);
  assert.equal(nativePayload.gameId, gameId);
  assert.equal(nativePayload.gameEvent, "turn");

  const fcm = buildFcmMessage({ token: "fcm-device-token" }, safe);
  assert.equal(fcm.message.data.gameId, gameId);
  assert.equal(fcm.message.data.gameEvent, "turn");
  assert.equal(fcm.message.data.body, "C’est à votre tour de jouer.");
});

test("chaque partie est reliée à la conversation autorisée et le jeu synchronise seulement les nouveautés", async () => {
  const [databaseSource, serverSource, gameSource, clubhouseSource, appSource, serviceWorkerSource] = await Promise.all([
    readFile(new URL("./db.js", import.meta.url), "utf8"),
    readFile(new URL("./index.js", import.meta.url), "utf8"),
    readFile(new URL("../src/ConnectFourGame.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/ClubhouseSpace.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);

  assert.match(databaseSource, /conversation_id uuid references conversations\(id\) on delete set null/u);
  assert.match(serverSource, /ensureGameConversation\(req\.auth\.sub, opponent\.id, client\)/u);
  assert.match(serverSource, /gameEvent: "turn"/u);
  assert.match(serverSource, /notification=game&game=/u);
  assert.match(gameSource, /function GameConversationPanel/u);
  assert.match(gameSource, /api\.syncConversations\(syncCursorRef\.current\)/u);
  assert.match(gameSource, /api\.markConversationRead\(conversationId, receivedIds\)/u);
  assert.match(gameSource, /Retour à la conversation avec \$\{opponentName\}/u);
  assert.match(gameSource, /onExitToConversation\(activeGame\.conversationId\)/u);
  assert.match(clubhouseSource, /onExitToConversation=\{onExitGame\}/u);
  assert.match(clubhouseSource, /onExitToConversation\(activeGameConversationId\)/u);
  assert.match(appSource, /gameId: String\(source\.gameId \?\? source\.game_id \?\? ""\)/u);
  assert.match(appSource, /\.find\(\(game\) => game\.id === payload\.gameId\)/u);
  assert.match(appSource, /setSelectedConversation\(conversation\)/u);
  assert.match(appSource, /setParentView\("messages"\)/u);
  assert.match(serviceWorkerSource, /gameId: data\.gameId/u);
});
