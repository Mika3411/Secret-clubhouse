export const ADMIN_ANALYTICS_SQL = `
  with admin_families as (
    select distinct membership.family_id
    from family_memberships membership
    join platform_administrators administrator
      on administrator.account_id=membership.parent_id
  ),
  product_families as (
    select family.id,family.created_at
    from families family
    where not exists(
      select 1 from admin_families excluded where excluded.family_id=family.id
    )
  ),
  product_accounts as (
    select account.id,account.role,account.created_at,account.last_activity_at
    from accounts account
    where not exists(
      select 1
      from platform_administrators administrator
      where administrator.account_id=account.id
    )
    and not exists(
      select 1
      from family_memberships membership
      join admin_families excluded on excluded.family_id=membership.family_id
      where membership.parent_id=account.id
    )
    and not exists(
      select 1
      from family_children family_child
      join admin_families excluded on excluded.family_id=family_child.family_id
      where family_child.child_id=account.id
    )
  ),
  product_family_accounts as (
    select membership.family_id,membership.parent_id as account_id
    from family_memberships membership
    join product_families family on family.id=membership.family_id
    join product_accounts account on account.id=membership.parent_id
    union all
    select family_child.family_id,family_child.child_id as account_id
    from family_children family_child
    join product_families family on family.id=family_child.family_id
    join product_accounts account on account.id=family_child.child_id
  ),
  family_activity as (
    select
      family.id,
      family.created_at,
      max(account.last_activity_at) as last_activity_at,
      count(*) filter (where account.role='child')::integer as child_count
    from product_families family
    left join product_family_accounts relation on relation.family_id=family.id
    left join product_accounts account on account.id=relation.account_id
    group by family.id,family.created_at
  ),
  family_metrics as (
    select
      count(*)::integer as families_total,
      count(*) filter (where child_count>0)::integer as families_with_children,
      count(*) filter (where created_at>=now()-interval '7 days')::integer as families_new_7,
      count(*) filter (where created_at>=now()-interval '30 days')::integer as families_new_30,
      count(*) filter (where last_activity_at>=now()-interval '7 days')::integer as families_active_7,
      count(*) filter (where last_activity_at>=now()-interval '30 days')::integer as families_active_30
    from family_activity
  ),
  user_metrics as (
    select
      count(*)::integer as users_total,
      count(*) filter (where role='parent')::integer as parents_total,
      count(*) filter (where role='child')::integer as children_total,
      count(*) filter (where last_activity_at>=now()-interval '7 days')::integer as users_active_7,
      count(*) filter (where last_activity_at>=now()-interval '30 days')::integer as users_active_30
    from product_accounts
  ),
  retention_metrics as (
    select
      count(*) filter (where created_at<=now()-interval '30 days')::integer as retention_eligible,
      count(*) filter (
        where created_at<=now()-interval '30 days'
          and last_activity_at>=created_at+interval '30 days'
      )::integer as retention_returned,
      min(created_at+interval '30 days') filter (
        where created_at>now()-interval '30 days'
      ) as retention_next_maturity_at
    from family_activity
  ),
  session_metrics as (
    select
      count(*) filter (where session.created_at>=now()-interval '7 days')::integer as sessions_7,
      count(*) filter (where session.created_at>=now()-interval '30 days')::integer as sessions_30
    from auth_sessions session
    join product_accounts account on account.id=session.account_id
  ),
  message_metrics as (
    select
      count(*) filter (where message.created_at>=now()-interval '7 days')::integer as messages_7,
      count(*) filter (where message.created_at>=now()-interval '30 days')::integer as messages_30
    from messages message
    join product_accounts account on account.id=message.sender_id
    where message.message_kind='user'
  ),
  clubhouse_metrics as (
    select
      count(*) filter (where activity.activity_date>=current_date-6)::integer as clubhouse_days_7,
      count(*) filter (where activity.activity_date>=current_date-29)::integer as clubhouse_days_30
    from clubhouse_daily_activity activity
    join product_accounts account on account.id=activity.child_id
  ),
  game_metrics as (
    select
      count(*) filter (where game.created_at>=now()-interval '7 days')::integer as games_7,
      count(*) filter (where game.created_at>=now()-interval '30 days')::integer as games_30
    from game_sessions game
    join product_accounts account on account.id=game.invited_by
  ),
  call_metrics as (
    select
      count(*) filter (where call.created_at>=now()-interval '7 days')::integer as calls_7,
      count(*) filter (where call.created_at>=now()-interval '30 days')::integer as calls_30
    from call_sessions call
    join product_accounts account on account.id=call.caller_id
  )
  select
    now() as generated_at,
    family_metrics.*,
    user_metrics.*,
    retention_metrics.*,
    session_metrics.*,
    message_metrics.*,
    clubhouse_metrics.*,
    game_metrics.*,
    call_metrics.*
  from family_metrics,user_metrics,retention_metrics,session_metrics,
       message_metrics,clubhouse_metrics,game_metrics,call_metrics
`;

const asNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const roundedRatio = (numerator, denominator) => (
  denominator > 0 ? Math.round((numerator / denominator) * 10) / 10 : 0
);

const usageMetric = (label, last7Days, last30Days, activeFamilies7, activeFamilies30) => ({
  label,
  last7Days,
  last30Days,
  perActiveFamily7: roundedRatio(last7Days, activeFamilies7),
  perActiveFamily30: roundedRatio(last30Days, activeFamilies30),
  perDay30: roundedRatio(last30Days, 30),
});

export function serializeAdminAnalytics(row = {}) {
  const familiesActive7 = asNumber(row.families_active_7);
  const familiesActive30 = asNumber(row.families_active_30);
  const eligible = asNumber(row.retention_eligible);
  const returned = asNumber(row.retention_returned);
  const sessions7 = asNumber(row.sessions_7);
  const sessions30 = asNumber(row.sessions_30);
  const messages7 = asNumber(row.messages_7);
  const messages30 = asNumber(row.messages_30);
  const clubhouseDays7 = asNumber(row.clubhouse_days_7);
  const clubhouseDays30 = asNumber(row.clubhouse_days_30);
  const games7 = asNumber(row.games_7);
  const games30 = asNumber(row.games_30);
  const calls7 = asNumber(row.calls_7);
  const calls30 = asNumber(row.calls_30);

  return {
    generatedAt: row.generated_at ?? new Date().toISOString(),
    scope: {
      aggregateOnly: true,
      administratorsExcluded: true,
      contentIncluded: false,
    },
    families: {
      total: asNumber(row.families_total),
      withChildren: asNumber(row.families_with_children),
      new7Days: asNumber(row.families_new_7),
      new30Days: asNumber(row.families_new_30),
      active7Days: familiesActive7,
      active30Days: familiesActive30,
    },
    users: {
      total: asNumber(row.users_total),
      parents: asNumber(row.parents_total),
      children: asNumber(row.children_total),
      active7Days: asNumber(row.users_active_7),
      active30Days: asNumber(row.users_active_30),
    },
    retention30Days: {
      eligibleFamilies: eligible,
      returnedFamilies: returned,
      rate: eligible > 0 ? Math.round((returned / eligible) * 1000) / 10 : null,
      nextCohortMaturesAt: row.retention_next_maturity_at ?? null,
    },
    usage: [
      usageMetric("Sessions ouvertes", sessions7, sessions30, familiesActive7, familiesActive30),
      usageMetric("Messages envoyés", messages7, messages30, familiesActive7, familiesActive30),
      usageMetric("Journées Clubhouse actives", clubhouseDays7, clubhouseDays30, familiesActive7, familiesActive30),
      usageMetric("Parties multijoueurs lancées", games7, games30, familiesActive7, familiesActive30),
      usageMetric("Appels lancés", calls7, calls30, familiesActive7, familiesActive30),
    ],
  };
}

export async function getAdminAnalytics(executor) {
  if (!executor || typeof executor.query !== "function") {
    throw new TypeError("Un exécuteur PostgreSQL est requis.");
  }
  const result = await executor.query(ADMIN_ANALYTICS_SQL);
  return serializeAdminAnalytics(result.rows?.[0] ?? {});
}
