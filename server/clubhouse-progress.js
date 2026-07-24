const DEFAULT_ROTATING_CHALLENGE_COUNT = 8;
const DEFAULT_PROTECTED_DAYS = 2;

function previousIsoDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function addIsoDays(value, days) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isoDayNumber(value) {
  return Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / 86_400_000);
}

function normalizeCatalogRow(activity) {
  return {
    ...activity,
    reward: Number(activity.reward),
    kind: activity.kind || "challenge",
    rotationRank: Number(activity.rotation_rank ?? 0),
    fixedCatalog: activity.fixed_catalog === undefined ? true : Boolean(activity.fixed_catalog),
    dailyEligible: Boolean(activity.daily_eligible),
    unlock: activity.unlock_id
      ? {
          id: activity.unlock_id,
          kind: activity.unlock_kind,
          label: activity.unlock_label,
          accent: activity.unlock_accent,
        }
      : null,
  };
}

export function selectClubhouseCatalog(catalogRows, today, rotatingChallengeCount = DEFAULT_ROTATING_CHALLENGE_COUNT) {
  const normalized = catalogRows.map(normalizeCatalogRow);
  const fixedActivities = normalized.filter((activity) => activity.fixedCatalog);
  const rotatingChallenges = normalized
    .filter((activity) => !activity.fixedCatalog && activity.kind === "challenge")
    .sort((first, second) => first.rotationRank - second.rotationRank || first.id.localeCompare(second.id));

  if (rotatingChallenges.length === 0) return normalized;

  const selectionCount = Math.min(rotatingChallengeCount, rotatingChallenges.length);
  const weekIndex = Math.floor(isoDayNumber(today) / 7);
  const offset = ((weekIndex % rotatingChallenges.length) + rotatingChallenges.length) % rotatingChallenges.length;
  const selectedChallenges = Array.from(
    { length: selectionCount },
    (_, index) => rotatingChallenges[(offset + index) % rotatingChallenges.length],
  );

  return [...selectedChallenges, ...fixedActivities];
}

export function selectDailyClubhouseActivity(catalogRows, today) {
  const eligible = catalogRows.filter((activity) => activity.kind === "challenge" && activity.dailyEligible);
  if (eligible.length === 0) return null;
  return eligible[((isoDayNumber(today) % eligible.length) + eligible.length) % eligible.length];
}

export function calculateProtectedClubhouseStreak(
  activityDates,
  today,
  maximumProtectedDays = DEFAULT_PROTECTED_DAYS,
) {
  const activeDates = new Set(activityDates);
  if (activeDates.size === 0) {
    return {
      activeDays: 0,
      protectedDaysUsed: 0,
      protectedDaysRemaining: maximumProtectedDays,
    };
  }

  const earliestDate = [...activeDates].sort()[0];
  let cursor = activeDates.has(today) ? today : previousIsoDate(today);
  let activeDays = 0;
  let protectedDaysUsed = 0;

  while (cursor >= earliestDate) {
    if (activeDates.has(cursor)) {
      activeDays += 1;
    } else {
      protectedDaysUsed += 1;
      if (protectedDaysUsed > maximumProtectedDays) {
        protectedDaysUsed = maximumProtectedDays;
        break;
      }
    }
    cursor = previousIsoDate(cursor);
  }

  return {
    activeDays,
    protectedDaysUsed,
    protectedDaysRemaining: Math.max(0, maximumProtectedDays - protectedDaysUsed),
  };
}

export function calculateClubhouseStreak(activityDates, today) {
  return calculateProtectedClubhouseStreak(activityDates, today).activeDays;
}

export function buildClubhouseState({
  catalogRows,
  progressRows,
  activityDates,
  dailyChallengeRows = [],
  appearanceRow = null,
  today,
}) {
  const fullCatalog = catalogRows.map(normalizeCatalogRow);
  const activeCatalog = selectClubhouseCatalog(catalogRows, today);
  const activeCatalogIds = new Set(activeCatalog.map((activity) => activity.id));
  const progress = progressRows.map((activity) => ({
    activityId: activity.activity_id,
    firstCompletedAt: activity.first_completed_at,
    lastCompletedAt: activity.last_completed_at,
    completionCount: Number(activity.completion_count),
    awardedStars: Number(activity.awarded_stars),
  }));
  const progressByActivity = new Map(progress.map((activity) => [activity.activityId, activity]));
  const catalog = activeCatalog.map((activity) => {
    const activityProgress = progressByActivity.get(activity.id);
    const completionCount = activityProgress?.completionCount ?? 0;
    return {
      activityId: activity.id,
      kind: activity.kind,
      reward: activity.reward,
      completed: Boolean(activityProgress),
      completionCount,
      replayCount: Math.max(0, completionCount - 1),
      awardedStars: activityProgress?.awardedStars ?? 0,
      unlock: activity.unlock,
    };
  });
  const completedActivities = catalog
    .filter((activity) => activity.completed)
    .map((activity) => activity.activityId);
  const completedCount = completedActivities.length;
  const totalActivities = catalog.length;
  const catalogStatus = totalActivities === 0
    ? "empty"
    : completedCount === 0
      ? "new"
      : completedCount === totalActivities
        ? "complete"
        : "in_progress";
  const totalStars = progress.reduce((total, activity) => total + activity.awardedStars, 0);
  const streak = calculateProtectedClubhouseStreak(activityDates, today);
  const catalogProgress = {
    completedCount,
    totalActivities,
    percent: totalActivities === 0 ? 0 : Math.round((completedCount / totalActivities) * 100),
    status: catalogStatus,
  };
  const dailyActivity = selectDailyClubhouseActivity(activeCatalog, today);
  const dailyCompleted = dailyActivity
    ? dailyChallengeRows.some((entry) => (
        entry.challenge_date === today
        && entry.activity_id === dailyActivity.id
      ))
    : false;
  const unlockedRewards = fullCatalog
    .filter((activity) => activity.unlock && progressByActivity.has(activity.id))
    .map((activity) => ({
      ...activity.unlock,
      activityId: activity.id,
      unlockedAt: progressByActivity.get(activity.id).firstCompletedAt,
      isInActiveCatalog: activeCatalogIds.has(activity.id),
    }))
    .sort((first, second) => String(second.unlockedAt).localeCompare(String(first.unlockedAt)));
  const equippedReward = unlockedRewards.find((reward) => reward.id === appearanceRow?.unlock_id) ?? null;
  const dayOfWeek = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  const daysUntilRotation = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;

  return {
    summary: {
      totalStars,
      currentStreakDays: streak.activeDays,
      streak: {
        personalDays: streak.activeDays,
        protectedDaysUsed: streak.protectedDaysUsed,
        protectedDaysRemaining: streak.protectedDaysRemaining,
      },
      catalog: catalogProgress,
      unlockedRewardCount: unlockedRewards.length,
    },
    dailyChallenge: dailyActivity
      ? {
          activityId: dailyActivity.id,
          completedToday: dailyCompleted,
        }
      : null,
    rotation: {
      refreshesAt: addIsoDays(today, daysUntilRotation),
      refreshesInDays: daysUntilRotation,
    },
    unlockedRewards,
    equippedReward,
    // Champs conservés pour les clients natifs plus anciens pendant leur mise à jour.
    stars: totalStars,
    streak: streak.activeDays,
    completedCount,
    totalActivities,
    completedActivities,
    catalog,
    progress,
  };
}
