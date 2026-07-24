import test from "node:test";
import assert from "node:assert/strict";
import { buildClubhouseState } from "./clubhouse-progress.js";

const catalogRows = [
  ["color-hunt", 25],
  ["one-line-drawing", 20],
  ["mystery-mime", 30],
  ["multiplayer-games", 40],
  ["memory-pairs", 30],
  ["nature-quiz", 20],
  ["odd-one-out", 20],
].map(([id, reward]) => ({ id, reward }));

function progressRow(activityId, awardedStars, completionCount = 1) {
  return {
    activity_id: activityId,
    first_completed_at: "2026-07-20T10:00:00.000Z",
    last_completed_at: "2026-07-22T10:00:00.000Z",
    completion_count: completionCount,
    awarded_stars: awardedStars,
  };
}

test("un nouveau profil reçoit uniquement les zéros fournis par l’état serveur", () => {
  const state = buildClubhouseState({
    catalogRows,
    progressRows: [],
    activityDates: [],
    today: "2026-07-23",
  });

  assert.deepEqual(state.summary, {
    totalStars: 0,
    currentStreakDays: 0,
    catalog: {
      completedCount: 0,
      totalActivities: 7,
      percent: 0,
      status: "new",
    },
  });
  assert.equal(state.catalog.every((activity) => !activity.completed), true);
});

test("les étoiles historiques restent distinctes de la progression du catalogue actif", () => {
  const state = buildClubhouseState({
    catalogRows,
    progressRows: [
      progressRow("color-hunt", 25),
      progressRow("one-line-drawing", 20),
      progressRow("ancienne-mission", 75),
    ],
    activityDates: ["2026-07-23", "2026-07-22", "2026-07-21"],
    today: "2026-07-23",
  });

  assert.equal(state.summary.totalStars, 120);
  assert.equal(state.summary.currentStreakDays, 3);
  assert.deepEqual(state.summary.catalog, {
    completedCount: 2,
    totalActivities: 7,
    percent: 29,
    status: "in_progress",
  });
  assert.deepEqual(state.completedActivities, ["color-hunt", "one-line-drawing"]);
});

test("une activité rejouée conserve une seule récompense par enfant", () => {
  const state = buildClubhouseState({
    catalogRows,
    progressRows: [progressRow("color-hunt", 25, 4)],
    activityDates: ["2026-07-22"],
    today: "2026-07-23",
  });
  const activity = state.catalog.find((entry) => entry.activityId === "color-hunt");

  assert.equal(state.summary.totalStars, 25);
  assert.equal(activity.completed, true);
  assert.equal(activity.awardedStars, 25);
  assert.equal(activity.completionCount, 4);
  assert.equal(activity.replayCount, 3);
});

test("un catalogue terminé est identifié par le serveur", () => {
  const state = buildClubhouseState({
    catalogRows,
    progressRows: catalogRows.map((activity) => progressRow(activity.id, activity.reward)),
    activityDates: ["2026-07-23", "2026-07-22"],
    today: "2026-07-23",
  });

  assert.equal(state.summary.totalStars, 185);
  assert.deepEqual(state.summary.catalog, {
    completedCount: 7,
    totalActivities: 7,
    percent: 100,
    status: "complete",
  });
  assert.equal(state.catalog.every((activity) => activity.completed), true);
});
