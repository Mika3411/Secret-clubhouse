import { pool } from "./db.js";

const advisoryLockKey = 1_386_829_042;

const countResult = (result) => Number(result.rowCount ?? 0);

export async function purgeExpiredData(executor = pool, { now = new Date() } = {}) {
  const client = typeof executor.connect === "function" ? await executor.connect() : executor;
  const ownsClient = client !== executor;
  const startedAt = now instanceof Date ? now : new Date(now);
  const counts = {};

  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [advisoryLockKey]);

    counts.expiredFamilyInvitations = countResult(await client.query(
      `/* retention:expire-family-invitations */
       update family_parent_invitations
       set status='expired'
       where status='pending' and expires_at<=$1`,
      [startedAt],
    ));
    counts.expiredContactRequests = countResult(await client.query(
      `/* retention:expire-contact-requests */
       update contact_requests
       set status='expired',resolved_at=coalesce(resolved_at,$1),updated_at=$1
       where status='pending' and expires_at<=$1`,
      [startedAt],
    ));
    counts.expiredCalls = countResult(await client.query(
      `/* retention:expire-calls */
       update call_sessions
       set status=case when status='ringing' then 'missed' else 'ended' end,
           ended_at=coalesce(ended_at,$1),
           updated_at=$1
       where (status='ringing' and expires_at<=$1)
          or (status='accepted' and answered_at<=$1-interval '24 hours')`,
      [startedAt],
    ));

    counts.typingStates = countResult(await client.query(
      "/* retention:typing */ delete from typing_states where expires_at<=$1",
      [startedAt],
    ));
    counts.callSignals = countResult(await client.query(
      "/* retention:call-signals */ delete from call_signals where expires_at<=$1",
      [startedAt],
    ));
    counts.nativeCallActionTokens = countResult(await client.query(
      `/* retention:native-call-action-tokens */
       delete from native_call_action_tokens
       where control_expires_at<=$1::timestamptz-interval '24 hours'`,
      [startedAt],
    ));
    counts.presence = countResult(await client.query(
      "/* retention:presence */ delete from presence where expires_at<=$1",
      [startedAt],
    ));
    counts.pushSubscriptions = countResult(await client.query(
      "/* retention:web-push */ delete from push_subscriptions where expires_at<=$1",
      [startedAt],
    ));
    counts.nativePushTokens = countResult(await client.query(
      "/* retention:native-push */ delete from native_push_tokens where expires_at<=$1",
      [startedAt],
    ));
    counts.authSessions = countResult(await client.query(
      `/* retention:auth-sessions */
       delete from auth_sessions
       where expires_at<=$1
          or (revoked_at is not null and revoked_at<=$1::timestamptz-interval '24 hours')`,
      [startedAt],
    ));
    counts.messages = countResult(await client.query(
      "/* retention:messages */ delete from messages where expires_at<=$1",
      [startedAt],
    ));
    counts.callSessions = countResult(await client.query(
      `/* retention:call-sessions */
       delete from call_sessions
       where status in ('declined','cancelled','ended','missed')
         and retention_until<=$1`,
      [startedAt],
    ));
    counts.familyInvitations = countResult(await client.query(
      `/* retention:family-invitations */
       delete from family_parent_invitations
       where status<>'pending'
         and greatest(created_at,coalesce(accepted_at,created_at),coalesce(revoked_at,created_at))
             <=$1::timestamptz-interval '90 days'`,
      [startedAt],
    ));
    counts.contactRequests = countResult(await client.query(
      `/* retention:contact-requests */
       delete from contact_requests
       where status<>'pending' and retention_until<=$1`,
      [startedAt],
    ));
    counts.games = countResult(await client.query(
      "/* retention:games */ delete from game_sessions where expires_at<=$1",
      [startedAt],
    ));
    counts.loginRateLimits = countResult(await client.query(
      `/* retention:login-rate-limits */
       delete from login_rate_limits where updated_at<=$1::timestamptz-interval '48 hours'`,
      [startedAt],
    ));
    counts.securityEvents = countResult(await client.query(
      "/* retention:security-events */ delete from security_events where expires_at<=$1",
      [startedAt],
    ));
    counts.legalEvents = countResult(await client.query(
      "/* retention:legal-events */ delete from legal_events where retain_until<=$1",
      [startedAt],
    ));
    counts.privacyRequests = countResult(await client.query(
      "/* retention:privacy-requests */ delete from privacy_requests where expires_at<=$1",
      [startedAt],
    ));
    counts.erasureTombstones = countResult(await client.query(
      "/* retention:erasure-tombstones */ delete from erasure_tombstones where expires_at<=$1",
      [startedAt],
    ));
    counts.retentionRuns = countResult(await client.query(
      "/* retention:retention-runs */ delete from retention_runs where expires_at<=$1",
      [startedAt],
    ));

    const inactiveFamilies = await client.query(
      `/* retention:inactive-families */
       select family.id
       from families family
       where exists(
         select 1 from family_memberships membership where membership.family_id=family.id
         union all
         select 1 from family_children child where child.family_id=family.id
       )
       and not exists(
         select 1
         from family_memberships membership
         join accounts account on account.id=membership.parent_id
         where membership.family_id=family.id and account.inactive_after>$1
         union all
         select 1
         from family_children child
         join accounts account on account.id=child.child_id
         where child.family_id=family.id and account.inactive_after>$1
       )
       for update of family`,
      [startedAt],
    );
    const inactiveFamilyIds = inactiveFamilies.rows.map((row) => row.id);
    counts.inactiveAccounts = 0;
    counts.inactiveFamilies = 0;
    if (inactiveFamilyIds.length) {
      counts.inactiveAccounts += countResult(await client.query(
        `/* retention:inactive-family-children */
         delete from accounts
         where id in (
           select child_id from family_children where family_id=any($1::uuid[])
         )`,
        [inactiveFamilyIds],
      ));
      counts.inactiveAccounts += countResult(await client.query(
        `/* retention:inactive-family-parents */
         delete from accounts
         where id in (
           select parent_id from family_memberships where family_id=any($1::uuid[])
         )`,
        [inactiveFamilyIds],
      ));
      counts.inactiveFamilies = countResult(await client.query(
        "/* retention:delete-inactive-families */ delete from families where id=any($1::uuid[])",
        [inactiveFamilyIds],
      ));
    }
    counts.inactiveAccounts += countResult(await client.query(
      `/* retention:orphan-accounts */
       delete from accounts account
       where account.inactive_after<=$1
         and not exists(select 1 from family_memberships where parent_id=account.id)
         and not exists(select 1 from family_children where child_id=account.id)`,
      [startedAt],
    ));
    counts.orphanConversations = countResult(await client.query(
      `/* retention:orphan-conversations */
       delete from conversations conversation
       where not exists(
         select 1 from conversation_members member where member.conversation_id=conversation.id
      )`,
    ));
    const overdueResult = await client.query(
      `/* retention:overdue-privacy-requests */
       select count(*)::integer as count
       from privacy_requests
       where status in ('submitted','in_review') and due_at<$1`,
      [startedAt],
    );
    const overduePrivacyRequests = Number(overdueResult.rows[0]?.count ?? 0);

    await client.query(
      `/* retention:record-run */
       insert into retention_runs(started_at,completed_at,deleted_counts)
       values($1,now(),$2::jsonb)`,
      [startedAt, JSON.stringify(counts)],
    );
    await client.query("commit");
    return { startedAt: startedAt.toISOString(), counts, overduePrivacyRequests };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    if (ownsClient) client.release();
  }
}
