import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_ANALYTICS_SQL,
  getAdminAnalytics,
  serializeAdminAnalytics,
} from "./services/admin-analytics-service.js";

const analyticsRow = {
  generated_at: "2026-07-24T10:00:00.000Z",
  families_total: 64,
  families_with_children: 42,
  families_new_7: 11,
  families_new_30: 64,
  families_active_7: 31,
  families_active_30: 49,
  users_total: 110,
  parents_total: 68,
  children_total: 42,
  users_active_7: 48,
  users_active_30: 81,
  retention_eligible: 20,
  retention_returned: 13,
  sessions_7: 92,
  sessions_30: 247,
  messages_7: 186,
  messages_30: 528,
  clubhouse_days_7: 44,
  clubhouse_days_30: 131,
  games_7: 18,
  games_30: 47,
  calls_7: 9,
  calls_30: 22,
};

test("sérialise les métriques sans exposer de ligne individuelle", () => {
  const analytics = serializeAdminAnalytics(analyticsRow);
  assert.deepEqual(analytics.families, {
    total: 64,
    withChildren: 42,
    new7Days: 11,
    new30Days: 64,
    active7Days: 31,
    active30Days: 49,
  });
  assert.deepEqual(analytics.users, {
    total: 110,
    parents: 68,
    children: 42,
    active7Days: 48,
    active30Days: 81,
  });
  assert.deepEqual(analytics.retention30Days, {
    eligibleFamilies: 20,
    returnedFamilies: 13,
    rate: 65,
    nextCohortMaturesAt: null,
  });
  assert.equal(analytics.usage[0].label, "Sessions ouvertes");
  assert.equal(analytics.usage[0].perActiveFamily30, 5);
  assert.equal(analytics.scope.contentIncluded, false);
});

test("la rétention D30 reste non mesurable sans cohorte arrivée à maturité", () => {
  const analytics = serializeAdminAnalytics({
    ...analyticsRow,
    retention_eligible: 0,
    retention_returned: 0,
    retention_next_maturity_at: "2026-08-20T09:00:00.000Z",
  });
  assert.equal(analytics.retention30Days.rate, null);
  assert.equal(analytics.retention30Days.nextCohortMaturesAt, "2026-08-20T09:00:00.000Z");
});

test("l’agrégation exclut les administrateurs et ne lit aucun contenu privé", async () => {
  assert.match(ADMIN_ANALYTICS_SQL, /platform_administrators/u);
  assert.match(ADMIN_ANALYTICS_SQL, /message\.message_kind='user'/u);
  for (const forbidden of [
    "message.body",
    "message.media_name",
    "account.display_name",
    "account.contact_id",
    "conversation_id",
  ]) {
    assert.doesNotMatch(ADMIN_ANALYTICS_SQL, new RegExp(forbidden.replace(".", "\\."), "u"));
  }

  let receivedSql = "";
  const executor = {
    async query(sql) {
      receivedSql = sql;
      return { rows: [analyticsRow] };
    },
  };
  const analytics = await getAdminAnalytics(executor);
  assert.equal(receivedSql, ADMIN_ANALYTICS_SQL);
  assert.equal(analytics.families.total, 64);
});
