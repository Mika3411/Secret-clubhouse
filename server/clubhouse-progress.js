function previousIsoDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function calculateClubhouseStreak(activityDates, today) {
  const activeDates = new Set(activityDates);
  let cursor = activeDates.has(today) ? today : previousIsoDate(today);
  let streak = 0;
  while (activeDates.has(cursor)) {
    streak += 1;
    cursor = previousIsoDate(cursor);
  }
  return streak;
}

export function buildClubhouseState({
  catalogRows,
  progressRows,
  activityDates,
  today,
}) {
  const progress = progressRows.map((activity) => ({
    activityId: activity.activity_id,
    firstCompletedAt: activity.first_completed_at,
    lastCompletedAt: activity.last_completed_at,
    completionCount: Number(activity.completion_count),
    awardedStars: Number(activity.awarded_stars),
  }));
  const progressByActivity = new Map(progress.map((activity) => [activity.activityId, activity]));
  const catalog = catalogRows.map((activity) => {
    const activityProgress = progressByActivity.get(activity.id);
    const completionCount = activityProgress?.completionCount ?? 0;
    return {
      activityId: activity.id,
      reward: Number(activity.reward),
      completed: Boolean(activityProgress),
      completionCount,
      replayCount: Math.max(0, completionCount - 1),
      awardedStars: activityProgress?.awardedStars ?? 0,
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
  const currentStreakDays = calculateClubhouseStreak(activityDates, today);
  const catalogProgress = {
    completedCount,
    totalActivities,
    percent: totalActivities === 0 ? 0 : Math.round((completedCount / totalActivities) * 100),
    status: catalogStatus,
  };

  return {
    summary: {
      totalStars,
      currentStreakDays,
      catalog: catalogProgress,
    },
    // Champs conservés pour les clients natifs plus anciens pendant leur mise à jour.
    stars: totalStars,
    streak: currentStreakDays,
    completedCount,
    totalActivities,
    completedActivities,
    catalog,
    progress,
  };
}
