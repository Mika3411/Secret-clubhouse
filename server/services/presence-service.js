const activeSessionPredicate = (accountAlias) => `
  session.account_id=${accountAlias}.id
  and session.revoked_at is null
  and session.expires_at>now()`;

function availabilityProjection({
  accountAlias = "account",
  webPushParameter,
  nativePushParameter,
} = {}) {
  return `
    exists(
      select 1
      from auth_sessions session
      where ${activeSessionPredicate(accountAlias)}
    ) as connected,
    exists(
      select 1
      from presence current_presence
      where current_presence.account_id=${accountAlias}.id
        and current_presence.last_foreground_at>now()-interval '75 seconds'
    ) as recently_online,
    (
      exists(
        select 1
        from account_consent_preferences consent
        where consent.subject_account_id=${accountAlias}.id
          and consent.purpose='notifications'
          and consent.subject_agreed_at is not null
          and (
            ${accountAlias}.role<>'child'
            or ${accountAlias}.age>=15
            or consent.guardian_agreed_at is not null
          )
      )
      and (
        (
          ${webPushParameter}::boolean
          and exists(
            select 1
            from auth_sessions session
            join push_subscriptions subscription
              on subscription.account_id=session.account_id
             and subscription.expires_at>now()
            where ${activeSessionPredicate(accountAlias)}
              and session.client_type='web'
          )
        )
        or
        (
          ${nativePushParameter}::boolean
          and exists(
            select 1
            from auth_sessions session
            join native_push_tokens token
              on token.account_id=session.account_id
             and token.enabled=true
             and token.expires_at>now()
             and (session.device_id is null or token.device_id=session.device_id)
            where ${activeSessionPredicate(accountAlias)}
              and session.client_type='native'
          )
        )
      )
    ) as background_reachable`;
}

export function serializeAccountAvailability(row = {}) {
  const connected = Boolean(row.connected);
  const online = connected && Boolean(row.recently_online);
  const backgroundReachable = connected && !online && Boolean(row.background_reachable);
  const accountAllowsCalls = row.processing_restricted_at == null
    && row.admin_suspended_at == null
    && (row.role !== "child" || row.status === "active");
  const canCall = accountAllowsCalls && (online || backgroundReachable);
  const state = online
    ? "online"
    : backgroundReachable
      ? "background"
      : connected
        ? "unavailable"
        : "offline";

  return {
    state,
    connected,
    online,
    canCall,
  };
}

export async function listAuthorizedContactAvailability(executor, {
  requesterAccountId,
  contactIds,
  webPushEnabled = false,
  nativePushEnabled = false,
} = {}) {
  if (!Array.isArray(contactIds) || !contactIds.length) return {};
  const result = await executor.query(
    `with requester_families as (
       select family_id from family_memberships where parent_id=$2
       union
       select family_id from family_children where child_id=$2
     ),
     authorized_accounts as (
       select $2::uuid as account_id
       union
       select case
         when relationship.account_one_id=$2 then relationship.account_two_id
         else relationship.account_one_id
       end
       from contact_relationships relationship
       where relationship.account_one_id=$2 or relationship.account_two_id=$2
       union
       select membership.parent_id
       from family_memberships membership
       join requester_families using(family_id)
       union
       select child.child_id
       from family_children child
       join requester_families using(family_id)
       union
       select access.child_id
       from family_trusted_adult_children access
       where access.adult_id=$2
       union
       select access.adult_id
       from family_trusted_adult_children access
       where access.child_id=$2
     )
     select
       account.contact_id,
       account.role,
       account.age,
       account.status,
       account.processing_restricted_at,
       account.admin_suspended_at,
       ${availabilityProjection({
         accountAlias: "account",
         webPushParameter: "$3",
         nativePushParameter: "$4",
       })}
     from accounts account
     join authorized_accounts authorized on authorized.account_id=account.id
     where account.contact_id=any($1::text[])`,
    [contactIds, requesterAccountId, webPushEnabled, nativePushEnabled],
  );
  return Object.fromEntries(result.rows.map((row) => [
    row.contact_id,
    serializeAccountAvailability(row),
  ]));
}

export async function getAccountAvailability(executor, accountId, {
  webPushEnabled = false,
  nativePushEnabled = false,
} = {}) {
  const result = await executor.query(
    `select
       account.role,
       account.age,
       account.status,
       account.processing_restricted_at,
       account.admin_suspended_at,
       ${availabilityProjection({
         accountAlias: "account",
         webPushParameter: "$2",
         nativePushParameter: "$3",
       })}
     from accounts account
     where account.id=$1`,
    [accountId, webPushEnabled, nativePushEnabled],
  );
  return serializeAccountAvailability(result.rows[0]);
}
