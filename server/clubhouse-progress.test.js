import test from "node:test";
import assert from "node:assert/strict";
import {
  buildClubhouseState,
  calculateProtectedClubhouseStreak,
  selectClubhouseCatalog,
} from "./clubhouse-progress.js";

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

  assert.equal(state.summary.totalStars, 0);
  assert.equal(state.summary.currentStreakDays, 0);
  assert.deepEqual(state.summary.streak, {
    personalDays: 0,
    protectedDaysUsed: 0,
    protectedDaysRemaining: 2,
  });
  assert.deepEqual(state.summary.catalog, {
    completedCount: 0,
    totalActivities: 7,
    percent: 0,
    status: "new",
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

test("la rotation conserve huit défis et les activités fixes", () => {
  const rotating = Array.from({ length: 12 }, (_, index) => ({
    id: `challenge-${index + 1}`,
    reward: 20,
    kind: "challenge",
    rotation_rank: index + 1,
    fixed_catalog: false,
  }));
  const fixed = [
    { id: "memory", reward: 20, kind: "game", fixed_catalog: true },
    { id: "multiplayer", reward: 40, kind: "multiplayer", fixed_catalog: true },
  ];
  const firstWeek = selectClubhouseCatalog([...rotating, ...fixed], "2026-07-20");
  const nextWeek = selectClubhouseCatalog([...rotating, ...fixed], "2026-07-27");

  assert.equal(firstWeek.filter((activity) => activity.kind === "challenge").length, 8);
  assert.equal(firstWeek.length, 10);
  assert.equal(firstWeek.some((activity) => activity.id === "memory"), true);
  assert.notDeepEqual(
    firstWeek.filter((activity) => activity.kind === "challenge").map((activity) => activity.id),
    nextWeek.filter((activity) => activity.kind === "challenge").map((activity) => activity.id),
  );
});

test("deux jours protégés gardent une série personnelle sans punition brutale", () => {
  const protectedStreak = calculateProtectedClubhouseStreak(
    ["2026-07-24", "2026-07-22", "2026-07-20"],
    "2026-07-24",
  );
  const resetAfterLongGap = calculateProtectedClubhouseStreak(
    ["2026-07-24", "2026-07-20"],
    "2026-07-24",
  );

  assert.deepEqual(protectedStreak, {
    activeDays: 3,
    protectedDaysUsed: 2,
    protectedDaysRemaining: 0,
  });
  assert.deepEqual(resetAfterLongGap, {
    activeDays: 1,
    protectedDaysUsed: 2,
    protectedDaysRemaining: 0,
  });
});

test("le défi du jour et la collection proviennent du serveur", () => {
  const serverCatalog = [
    {
      id: "color-hunt",
      reward: 25,
      kind: "challenge",
      fixed_catalog: true,
      daily_eligible: true,
      unlock_id: "mint-comet",
      unlock_kind: "decor",
      unlock_label: "Comète menthe",
      unlock_accent: "#65efc5",
    },
  ];
  const state = buildClubhouseState({
    catalogRows: serverCatalog,
    progressRows: [progressRow("color-hunt", 25)],
    activityDates: ["2026-07-24"],
    dailyChallengeRows: [{ challenge_date: "2026-07-24", activity_id: "color-hunt" }],
    appearanceRow: { unlock_id: "mint-comet" },
    today: "2026-07-24",
  });

  assert.deepEqual(state.dailyChallenge, {
    activityId: "color-hunt",
    completedToday: true,
  });
  assert.equal(state.unlockedRewards.length, 1);
  assert.equal(state.unlockedRewards[0].label, "Comète menthe");
  assert.equal(state.equippedReward.id, "mint-comet");
});
