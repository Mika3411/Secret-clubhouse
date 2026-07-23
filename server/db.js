import pg from "pg";
import { createDatabasePoolConfig } from "./database-config.js";
import { initializeAuthSessionStore } from "./auth-sessions.js";

const { Pool } = pg;

export const pool = new Pool(createDatabasePoolConfig(process.env));

export async function initializeDatabase() {
  await pool.query(`
    create extension if not exists pgcrypto;

    create table if not exists accounts (
      id uuid primary key default gen_random_uuid(),
      role text not null check (role in ('parent', 'child')),
      email text unique,
      contact_id text not null unique,
      password_hash text not null,
      display_name text not null,
      parent_id uuid references accounts(id) on delete cascade,
      age smallint,
      username text,
      avatar_path text,
      avatar_color text,
      avatar_config jsonb,
      status text not null default 'active',
      safety_settings jsonb not null default '{"media":true}'::jsonb,
      communication_schedule jsonb not null default '{"enabled":true,"messages":{"enabled":true,"start":"07:30","end":"20:30"},"calls":{"enabled":true,"start":"08:00","end":"19:30"},"video":{"enabled":false,"start":"09:00","end":"18:30"},"autoReply":{"enabled":true,"message":"Je ne peux pas répondre pour le moment."}}'::jsonb,
      created_at timestamptz not null default now(),
      last_activity_at timestamptz not null default now(),
      inactive_after timestamptz not null default now() + interval '730 days',
      processing_restricted_at timestamptz,
      processing_restriction_reason text,
      check ((role = 'parent' and email is not null and parent_id is null) or (role = 'child' and parent_id is not null))
    );

    alter table accounts add column if not exists age smallint;
    alter table accounts add column if not exists username text;
    alter table accounts add column if not exists avatar_path text;
    alter table accounts add column if not exists avatar_color text;
    alter table accounts add column if not exists avatar_config jsonb;
    alter table accounts add column if not exists status text not null default 'active';
    alter table accounts add column if not exists safety_settings jsonb not null default '{"media":true}'::jsonb;
    alter table accounts add column if not exists communication_schedule jsonb not null default '{"enabled":true,"messages":{"enabled":true,"start":"07:30","end":"20:30"},"calls":{"enabled":true,"start":"08:00","end":"19:30"},"video":{"enabled":false,"start":"09:00","end":"18:30"},"autoReply":{"enabled":true,"message":"Je ne peux pas répondre pour le moment."}}'::jsonb;
    alter table accounts add column if not exists last_activity_at timestamptz;
    alter table accounts add column if not exists inactive_after timestamptz;
    alter table accounts add column if not exists processing_restricted_at timestamptz;
    alter table accounts add column if not exists processing_restriction_reason text;
    update accounts
      set last_activity_at=coalesce(last_activity_at,now()),
          inactive_after=coalesce(inactive_after,now()+interval '730 days')
      where last_activity_at is null or inactive_after is null;
    alter table accounts alter column last_activity_at set default now();
    alter table accounts alter column last_activity_at set not null;
    alter table accounts alter column inactive_after set default now() + interval '730 days';
    alter table accounts alter column inactive_after set not null;
    create or replace function set_account_inactivity_deadline()
    returns trigger language plpgsql as $$
    begin
      new.inactive_after=new.last_activity_at+interval '730 days';
      return new;
    end;
    $$;
    drop trigger if exists accounts_set_inactivity_deadline on accounts;
    create trigger accounts_set_inactivity_deadline
      before insert or update of last_activity_at on accounts
      for each row execute function set_account_inactivity_deadline();
    create unique index if not exists accounts_parent_username_unique on accounts(parent_id, lower(username)) where role = 'child';
    create index if not exists accounts_parent_children_idx on accounts(parent_id, created_at) where role = 'child';
    create index if not exists accounts_inactive_after_idx on accounts(inactive_after);

    create table if not exists account_consent_preferences (
      subject_account_id uuid not null references accounts(id) on delete cascade,
      purpose text not null check (purpose in ('notifications')),
      subject_agreed_at timestamptz,
      subject_document_version text,
      guardian_agreed_at timestamptz,
      guardian_document_version text,
      guardian_account_id uuid references accounts(id) on delete set null,
      updated_at timestamptz not null default now(),
      primary key (subject_account_id, purpose)
    );
    create index if not exists account_consent_preferences_guardian_idx
      on account_consent_preferences(guardian_account_id)
      where guardian_account_id is not null;

    create table if not exists legal_events (
      id uuid primary key default gen_random_uuid(),
      subject_account_id uuid not null,
      actor_account_id uuid,
      event_type text not null check (event_type in (
        'contract_accepted',
        'parental_authority_declared',
        'privacy_notice_provided',
        'consent_granted',
        'consent_withdrawn',
        'guardian_consent_granted',
        'guardian_consent_withdrawn'
      )),
      purpose text not null,
      legal_basis text not null check (legal_basis in (
        'contract',
        'consent',
        'legitimate_interest',
        'legal_obligation'
      )),
      document_version text not null,
      evidence jsonb not null default '{}'::jsonb,
      occurred_at timestamptz not null default now(),
      retain_until timestamptz not null default now() + interval '5 years'
    );
    create index if not exists legal_events_subject_idx
      on legal_events(subject_account_id,occurred_at desc);
    create index if not exists legal_events_retention_idx on legal_events(retain_until);

    create table if not exists login_rate_limits (
      scope text not null check (scope in ('identity', 'ip')),
      key_hash text not null,
      failure_count integer not null default 0 check (failure_count >= 0),
      window_started_at timestamptz not null default now(),
      blocked_until timestamptz,
      updated_at timestamptz not null default now(),
      primary key (scope, key_hash)
    );
    create index if not exists login_rate_limits_updated_idx on login_rate_limits(updated_at);
    delete from login_rate_limits where updated_at < now() - interval '48 hours';

    create table if not exists families (
      id uuid primary key default gen_random_uuid(),
      name text not null default 'Ma famille',
      legacy_owner_id uuid unique references accounts(id) on delete set null,
      created_at timestamptz not null default now()
    );

    create table if not exists family_memberships (
      family_id uuid not null references families(id) on delete cascade,
      parent_id uuid not null unique references accounts(id) on delete cascade,
      role text not null check (role in ('primary', 'coparent')),
      joined_at timestamptz not null default now(),
      primary key (family_id, parent_id)
    );
    create unique index if not exists family_memberships_one_primary_idx
      on family_memberships(family_id) where role = 'primary';

    create table if not exists family_children (
      family_id uuid not null references families(id) on delete cascade,
      child_id uuid not null unique references accounts(id) on delete cascade,
      added_at timestamptz not null default now(),
      primary key (family_id, child_id)
    );
    create index if not exists family_children_family_idx on family_children(family_id, added_at);

    create table if not exists family_parent_invitations (
      id uuid primary key default gen_random_uuid(),
      family_id uuid not null references families(id) on delete cascade,
      email text not null,
      token_hash text not null unique,
      invited_by uuid references accounts(id) on delete set null,
      accepted_by uuid references accounts(id) on delete set null,
      status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
      expires_at timestamptz not null,
      created_at timestamptz not null default now(),
      accepted_at timestamptz,
      revoked_at timestamptz
    );
    create unique index if not exists family_parent_invitations_pending_email_idx
      on family_parent_invitations(family_id, lower(email)) where status = 'pending';
    create index if not exists family_parent_invitations_family_idx
      on family_parent_invitations(family_id, status, created_at desc);

    -- Existing installations used accounts.parent_id as both ownership and family
    -- membership. Give every legacy parent a family, then attach their children.
    -- The NOT EXISTS guards keep this safe when a co-parent restarts the service.
    insert into families(name, legacy_owner_id)
    select concat('Famille de ', a.display_name), a.id
    from accounts a
    where a.role = 'parent'
      and not exists (select 1 from family_memberships fm where fm.parent_id = a.id)
      and not exists (select 1 from families f where f.legacy_owner_id = a.id)
    on conflict (legacy_owner_id) do nothing;

    insert into family_memberships(family_id, parent_id, role)
    select f.id, f.legacy_owner_id, 'primary'
    from families f
    join accounts a on a.id = f.legacy_owner_id and a.role = 'parent'
    where not exists (select 1 from family_memberships fm where fm.parent_id = f.legacy_owner_id)
    on conflict (parent_id) do nothing;

    insert into family_children(family_id, child_id, added_at)
    select fm.family_id, child.id, child.created_at
    from accounts child
    join family_memberships fm on fm.parent_id = child.parent_id
    where child.role = 'child'
    on conflict (child_id) do nothing;

    -- During a rolling deploy an older service can still create a child without
    -- inserting family_children. Attach that account to its owner's current
    -- family immediately, whether the owner is primary or co-parent.
    create or replace function attach_new_child_to_current_family()
    returns trigger language plpgsql as $$
    begin
      insert into family_children(family_id, child_id, added_at)
      select membership.family_id, new.id, new.created_at
      from family_memberships membership
      where membership.parent_id = new.parent_id
      on conflict (child_id) do nothing;
      return new;
    end;
    $$;
    drop trigger if exists accounts_attach_new_child_to_family on accounts;
    create trigger accounts_attach_new_child_to_family
    after insert on accounts
    for each row when (new.role = 'child')
    execute function attach_new_child_to_current_family();

    create table if not exists conversations (
      id uuid primary key default gen_random_uuid(),
      kind text not null check (kind in ('child', 'parent')),
      created_at timestamptz not null default now()
    );

    create table if not exists conversation_members (
      conversation_id uuid not null references conversations(id) on delete cascade,
      account_id uuid not null references accounts(id) on delete cascade,
      primary key (conversation_id, account_id)
    );

    create table if not exists family_conversations (
      parent_id uuid not null references accounts(id) on delete cascade,
      child_id uuid not null unique references accounts(id) on delete cascade,
      conversation_id uuid not null unique references conversations(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (parent_id, child_id)
    );
    alter table family_conversations drop constraint if exists family_conversations_child_id_key;

    create table if not exists family_parent_conversations (
      family_id uuid not null references families(id) on delete cascade,
      parent_one_id uuid not null references accounts(id) on delete cascade,
      parent_two_id uuid not null references accounts(id) on delete cascade,
      conversation_id uuid not null unique references conversations(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (family_id, parent_one_id, parent_two_id),
      foreign key (family_id, parent_one_id) references family_memberships(family_id, parent_id) on delete cascade,
      foreign key (family_id, parent_two_id) references family_memberships(family_id, parent_id) on delete cascade,
      check (parent_one_id < parent_two_id)
    );
    create index if not exists family_parent_conversations_parent_one_idx on family_parent_conversations(parent_one_id);
    create index if not exists family_parent_conversations_parent_two_idx on family_parent_conversations(parent_two_id);
    create or replace function delete_orphaned_family_parent_conversation()
    returns trigger language plpgsql as $$
    begin
      delete from conversations where id=old.conversation_id;
      return old;
    end;
    $$;
    drop trigger if exists family_parent_conversations_cleanup on family_parent_conversations;
    create trigger family_parent_conversations_cleanup
      after delete on family_parent_conversations
      for each row execute function delete_orphaned_family_parent_conversation();

    create table if not exists contact_requests (
      id uuid primary key default gen_random_uuid(),
      requester_id uuid not null references accounts(id) on delete cascade,
      requested_by_parent_id uuid references accounts(id) on delete cascade,
      target_account_id uuid not null references accounts(id) on delete cascade,
      recipient_parent_id uuid not null references accounts(id) on delete cascade,
      status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
      conversation_id uuid references conversations(id) on delete set null,
      resolved_by uuid references accounts(id) on delete set null,
      resolved_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      expires_at timestamptz not null default now() + interval '30 days',
      retention_until timestamptz not null default now() + interval '210 days',
      check (requester_id <> recipient_parent_id)
    );
    alter table contact_requests add column if not exists requested_by_parent_id uuid references accounts(id) on delete cascade;
    alter table contact_requests add column if not exists conversation_id uuid references conversations(id) on delete set null;
    alter table contact_requests add column if not exists resolved_by uuid references accounts(id) on delete set null;
    alter table contact_requests add column if not exists resolved_at timestamptz;
    alter table contact_requests add column if not exists expires_at timestamptz;
    alter table contact_requests add column if not exists retention_until timestamptz;
    update contact_requests set expires_at=created_at+interval '30 days' where expires_at is null;
    update contact_requests
      set retention_until=case
        when status='pending' then created_at+interval '210 days'
        else updated_at+interval '180 days'
      end
      where retention_until is null;
    alter table contact_requests alter column expires_at set default now() + interval '30 days';
    alter table contact_requests alter column expires_at set not null;
    alter table contact_requests alter column retention_until set default now() + interval '210 days';
    alter table contact_requests alter column retention_until set not null;
    alter table contact_requests drop constraint if exists contact_requests_status_check;
    alter table contact_requests add constraint contact_requests_status_check
      check (status in ('pending', 'approved', 'declined', 'expired'));
    create or replace function set_contact_request_retention()
    returns trigger language plpgsql as $$
    begin
      if new.status='pending' then
        new.expires_at=coalesce(new.expires_at,new.created_at+interval '30 days');
        new.retention_until=new.expires_at+interval '180 days';
      else
        new.retention_until=new.updated_at+interval '180 days';
      end if;
      return new;
    end;
    $$;
    drop trigger if exists contact_requests_set_retention on contact_requests;
    create trigger contact_requests_set_retention
      before insert or update of status,updated_at on contact_requests
      for each row execute function set_contact_request_retention();
    update contact_requests set requested_by_parent_id=requester_id where requested_by_parent_id is null;
    alter table contact_requests alter column requested_by_parent_id set not null;
    alter table contact_requests drop constraint if exists contact_requests_requester_id_target_account_id_key;
    update contact_requests request
      set status='declined',resolved_at=coalesce(resolved_at,now()),updated_at=now()
      from accounts requester,accounts target
      where request.requester_id=requester.id
        and request.target_account_id=target.id
        and request.status='pending'
        and requester.role='parent'
        and target.role='child';
    with duplicate_pending as (
      select id,row_number() over (
        partition by least(requester_id,target_account_id),greatest(requester_id,target_account_id)
        order by created_at,id
      ) as position
      from contact_requests
      where status='pending'
    )
    update contact_requests request
      set status='declined',resolved_at=coalesce(resolved_at,now()),updated_at=now()
      from duplicate_pending duplicate
      where request.id=duplicate.id and duplicate.position>1;
    create index if not exists contact_requests_recipient_idx on contact_requests(recipient_parent_id, status);
    create index if not exists contact_requests_requested_by_idx on contact_requests(requested_by_parent_id, status);
    create index if not exists contact_requests_expiry_idx on contact_requests(status, expires_at, retention_until);
    create unique index if not exists contact_requests_pending_pair_idx
      on contact_requests(least(requester_id,target_account_id),greatest(requester_id,target_account_id))
      where status='pending';

    create table if not exists contact_relationships (
      account_one_id uuid not null references accounts(id) on delete cascade,
      account_two_id uuid not null references accounts(id) on delete cascade,
      conversation_id uuid not null unique references conversations(id) on delete cascade,
      approved_request_id uuid unique references contact_requests(id) on delete set null,
      created_at timestamptz not null default now(),
      primary key (account_one_id, account_two_id),
      check (account_one_id < account_two_id)
    );
    create index if not exists contact_relationships_account_two_idx on contact_relationships(account_two_id);

    create table if not exists game_sessions (
      id uuid primary key default gen_random_uuid(),
      game_type text not null check (game_type in ('connect_four','tic_tac_toe','naval_battle')),
      player_one_id uuid not null references accounts(id) on delete cascade,
      player_two_id uuid not null references accounts(id) on delete cascade,
      invited_by uuid not null references accounts(id) on delete cascade,
      status text not null default 'pending' check (status in ('pending','active','declined','completed')),
      board jsonb not null default '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]'::jsonb,
      current_player_id uuid references accounts(id) on delete set null,
      winner_id uuid references accounts(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      expires_at timestamptz not null default now() + interval '30 days',
      check (player_one_id <> player_two_id)
    );
    alter table game_sessions add column if not exists expires_at timestamptz;
    update game_sessions
      set expires_at=case
        when status='pending' then created_at+interval '30 days'
        else updated_at+interval '180 days'
      end
      where expires_at is null;
    alter table game_sessions alter column expires_at set default now() + interval '30 days';
    alter table game_sessions alter column expires_at set not null;
    create or replace function set_game_session_expiry()
    returns trigger language plpgsql as $$
    begin
      new.expires_at=case
        when new.status='pending' then new.created_at+interval '30 days'
        else new.updated_at+interval '180 days'
      end;
      return new;
    end;
    $$;
    drop trigger if exists game_sessions_set_expiry on game_sessions;
    create trigger game_sessions_set_expiry
      before insert or update of status,updated_at on game_sessions
      for each row execute function set_game_session_expiry();
    alter table game_sessions drop constraint if exists game_sessions_game_type_check;
    alter table game_sessions add constraint game_sessions_game_type_check
      check (game_type in ('connect_four','tic_tac_toe','naval_battle'));
    create index if not exists game_sessions_players_idx on game_sessions(player_one_id, player_two_id, updated_at desc);
    create index if not exists game_sessions_expiry_idx on game_sessions(status, expires_at);

    create table if not exists call_sessions (
      id uuid primary key default gen_random_uuid(),
      conversation_id uuid not null references conversations(id) on delete cascade,
      caller_id uuid not null references accounts(id) on delete cascade,
      callee_id uuid not null references accounts(id) on delete cascade,
      call_type text not null check (call_type in ('audio','video')),
      status text not null default 'ringing'
        check (status in ('ringing','accepted','declined','cancelled','ended','missed')),
      expires_at timestamptz not null default now() + interval '45 seconds',
      answered_at timestamptz,
      ended_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      retention_until timestamptz not null default now() + interval '90 days',
      check (caller_id <> callee_id)
    );
    alter table call_sessions add column if not exists retention_until timestamptz;
    update call_sessions set retention_until=updated_at+interval '90 days' where retention_until is null;
    alter table call_sessions alter column retention_until set default now() + interval '90 days';
    alter table call_sessions alter column retention_until set not null;
    create or replace function set_call_session_retention()
    returns trigger language plpgsql as $$
    begin
      new.retention_until=new.updated_at+interval '90 days';
      return new;
    end;
    $$;
    drop trigger if exists call_sessions_set_retention on call_sessions;
    create trigger call_sessions_set_retention
      before insert or update of updated_at on call_sessions
      for each row execute function set_call_session_retention();
    create index if not exists call_sessions_participants_idx
      on call_sessions(caller_id, callee_id, updated_at desc);
    create index if not exists call_sessions_conversation_idx
      on call_sessions(conversation_id, updated_at desc);
    create index if not exists call_sessions_open_idx
      on call_sessions(status, expires_at)
      where status in ('ringing','accepted');
    create index if not exists call_sessions_retention_idx on call_sessions(status,retention_until);

    create table if not exists call_signals (
      id bigserial primary key,
      call_id uuid not null references call_sessions(id) on delete cascade,
      sender_id uuid not null references accounts(id) on delete cascade,
      recipient_id uuid not null references accounts(id) on delete cascade,
      signal_type text not null check (signal_type in ('offer','answer','ice')),
      payload jsonb,
      encryption_context_id uuid not null default gen_random_uuid(),
      payload_ciphertext text,
      content_encryption_version smallint not null default 0,
      content_encryption_key_id text,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null default now() + interval '24 hours',
      check (sender_id <> recipient_id)
    );
    alter table call_signals alter column payload drop not null;
    alter table call_signals add column if not exists encryption_context_id uuid;
    update call_signals
      set encryption_context_id=gen_random_uuid()
      where encryption_context_id is null;
    alter table call_signals alter column encryption_context_id set default gen_random_uuid();
    alter table call_signals alter column encryption_context_id set not null;
    alter table call_signals add column if not exists payload_ciphertext text;
    alter table call_signals add column if not exists content_encryption_version smallint;
    alter table call_signals add column if not exists content_encryption_key_id text;
    update call_signals
      set content_encryption_version=0
      where content_encryption_version is null;
    alter table call_signals alter column content_encryption_version set default 0;
    alter table call_signals alter column content_encryption_version set not null;
    alter table call_signals drop constraint if exists call_signals_content_encryption_check;
    alter table call_signals add constraint call_signals_content_encryption_check check (
      (
        content_encryption_version=0
        and content_encryption_key_id is null
        and payload is not null
        and payload_ciphertext is null
      )
      or
      (
        content_encryption_version=1
        and content_encryption_key_id ~ '^[0-9a-f]{16}$'
        and payload is null
        and payload_ciphertext is not null
      )
    );
    alter table call_signals drop constraint if exists call_signals_encrypted_payload_size_check;
    alter table call_signals add constraint call_signals_encrypted_payload_size_check
      check (octet_length(payload_ciphertext) is null or octet_length(payload_ciphertext)<=1500000);
    alter table call_signals add column if not exists expires_at timestamptz;
    update call_signals set expires_at=created_at+interval '24 hours' where expires_at is null;
    alter table call_signals alter column expires_at set default now() + interval '24 hours';
    alter table call_signals alter column expires_at set not null;
    create index if not exists call_signals_recipient_idx
      on call_signals(call_id, recipient_id, id);
    create index if not exists call_signals_expiry_idx on call_signals(expires_at);

    create table if not exists presence (
      account_id uuid primary key references accounts(id) on delete cascade,
      last_seen timestamptz not null default now(),
      expires_at timestamptz not null default now() + interval '24 hours'
    );
    alter table presence add column if not exists expires_at timestamptz;
    update presence set expires_at=last_seen+interval '24 hours' where expires_at is null;
    alter table presence alter column expires_at set default now() + interval '24 hours';
    alter table presence alter column expires_at set not null;
    create index if not exists presence_expiry_idx on presence(expires_at);

    create table if not exists typing_states (
      conversation_id uuid not null references conversations(id) on delete cascade,
      account_id uuid not null references accounts(id) on delete cascade,
      expires_at timestamptz not null,
      primary key (conversation_id, account_id)
    );
    create index if not exists typing_states_expiry_idx on typing_states(expires_at);

    create table if not exists push_subscriptions (
      id uuid primary key default gen_random_uuid(),
      account_id uuid not null references accounts(id) on delete cascade,
      endpoint text not null unique,
      subscription jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      expires_at timestamptz not null default now() + interval '180 days'
    );
    alter table push_subscriptions add column if not exists updated_at timestamptz;
    alter table push_subscriptions add column if not exists expires_at timestamptz;
    update push_subscriptions
      set updated_at=coalesce(updated_at,created_at),
          expires_at=coalesce(expires_at,created_at+interval '180 days')
      where updated_at is null or expires_at is null;
    alter table push_subscriptions alter column updated_at set default now();
    alter table push_subscriptions alter column updated_at set not null;
    alter table push_subscriptions alter column expires_at set default now() + interval '180 days';
    alter table push_subscriptions alter column expires_at set not null;
    create index if not exists push_subscriptions_account_idx on push_subscriptions(account_id);
    create index if not exists push_subscriptions_expiry_idx on push_subscriptions(expires_at);

    create table if not exists application_settings (
      setting_key text primary key,
      setting_value jsonb not null,
      updated_at timestamptz not null default now()
    );

    create table if not exists native_push_tokens (
      id uuid primary key default gen_random_uuid(),
      account_id uuid not null references accounts(id) on delete cascade,
      platform text not null check (platform in ('ios','android')),
      device_id text not null,
      token_kind text not null check (token_kind in ('fcm','apns_alert','apns_voip')),
      token text not null unique,
      environment text check (environment in ('sandbox','production')),
      topic text,
      enabled boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      expires_at timestamptz not null default now() + interval '180 days',
      last_success_at timestamptz,
      last_failure_at timestamptz,
      last_error_code text
    );
    alter table native_push_tokens add column if not exists device_id text;
    alter table native_push_tokens add column if not exists token_kind text;
    alter table native_push_tokens add column if not exists environment text;
    alter table native_push_tokens add column if not exists topic text;
    alter table native_push_tokens add column if not exists enabled boolean not null default true;
    alter table native_push_tokens add column if not exists created_at timestamptz;
    alter table native_push_tokens add column if not exists expires_at timestamptz;
    alter table native_push_tokens add column if not exists last_success_at timestamptz;
    alter table native_push_tokens add column if not exists last_failure_at timestamptz;
    alter table native_push_tokens add column if not exists last_error_code text;
    update native_push_tokens
      set device_id=coalesce(device_id,'legacy-'||id::text),
          token_kind=coalesce(token_kind,case when platform='android' then 'fcm' else 'apns_alert' end),
          environment=case
            when platform='android' then null
            else coalesce(environment,'production')
          end,
          created_at=coalesce(created_at,updated_at,now()),
          expires_at=coalesce(expires_at,updated_at+interval '180 days')
      where device_id is null
         or token_kind is null
         or (platform='ios' and environment is null)
         or (platform='android' and environment is not null)
         or created_at is null
         or expires_at is null;
    alter table native_push_tokens alter column device_id set not null;
    alter table native_push_tokens alter column token_kind set not null;
    alter table native_push_tokens alter column created_at set default now();
    alter table native_push_tokens alter column created_at set not null;
    alter table native_push_tokens alter column expires_at set default now() + interval '180 days';
    alter table native_push_tokens alter column expires_at set not null;
    alter table native_push_tokens drop constraint if exists native_push_tokens_token_kind_check;
    alter table native_push_tokens add constraint native_push_tokens_token_kind_check
      check (token_kind in ('fcm','apns_alert','apns_voip'));
    alter table native_push_tokens drop constraint if exists native_push_tokens_environment_check;
    alter table native_push_tokens add constraint native_push_tokens_environment_check
      check (environment in ('sandbox','production'));
    alter table native_push_tokens drop constraint if exists native_push_tokens_platform_kind_check;
    alter table native_push_tokens add constraint native_push_tokens_platform_kind_check
      check (
        (platform='android' and token_kind='fcm' and environment is null)
        or
        (platform='ios' and token_kind in ('apns_alert','apns_voip') and environment is not null)
      );
    create unique index if not exists native_push_tokens_installation_kind_idx
      on native_push_tokens(account_id,device_id,token_kind);
    create index if not exists native_push_tokens_account_idx on native_push_tokens(account_id,enabled);
    create index if not exists native_push_tokens_expiry_idx on native_push_tokens(expires_at);

    create table if not exists native_call_action_tokens (
      call_id uuid primary key references call_sessions(id) on delete cascade,
      account_id uuid not null references accounts(id) on delete cascade,
      token_hash text not null unique,
      expires_at timestamptz not null,
      control_expires_at timestamptz not null,
      accepted_at timestamptz,
      consumed_action text check (consumed_action in ('decline','hangup')),
      consumed_at timestamptz,
      created_at timestamptz not null default now()
    );
    alter table native_call_action_tokens add column if not exists control_expires_at timestamptz;
    alter table native_call_action_tokens add column if not exists accepted_at timestamptz;
    alter table native_call_action_tokens add column if not exists consumed_action text;
    alter table native_call_action_tokens add column if not exists consumed_at timestamptz;
    update native_call_action_tokens
      set control_expires_at=coalesce(control_expires_at,expires_at+interval '2 hours')
      where control_expires_at is null;
    alter table native_call_action_tokens alter column control_expires_at set not null;
    alter table native_call_action_tokens drop constraint if exists native_call_action_tokens_consumed_action_check;
    alter table native_call_action_tokens add constraint native_call_action_tokens_consumed_action_check
      check (consumed_action in ('decline','hangup'));
    alter table native_call_action_tokens drop constraint if exists native_call_action_tokens_hash_length_check;
    alter table native_call_action_tokens add constraint native_call_action_tokens_hash_length_check
      check (char_length(token_hash)=64);
    create index if not exists native_call_action_tokens_expiry_idx
      on native_call_action_tokens(expires_at);

    create table if not exists messages (
      id uuid primary key default gen_random_uuid(),
      conversation_id uuid not null references conversations(id) on delete cascade,
      sender_id uuid not null references accounts(id) on delete cascade,
      body text,
      media_name text,
      media_type text,
      media_data bytea,
      body_ciphertext text,
      media_name_ciphertext text,
      media_type_ciphertext text,
      media_ciphertext bytea,
      content_encryption_version smallint not null default 0,
      content_encryption_key_id text,
      message_kind text not null default 'user',
      created_at timestamptz not null default now(),
      expires_at timestamptz not null default now() + interval '365 days'
    );
    alter table messages add column if not exists body_ciphertext text;
    alter table messages add column if not exists media_name_ciphertext text;
    alter table messages add column if not exists media_type_ciphertext text;
    alter table messages add column if not exists media_ciphertext bytea;
    alter table messages add column if not exists content_encryption_version smallint;
    alter table messages add column if not exists content_encryption_key_id text;
    update messages set content_encryption_version=0 where content_encryption_version is null;
    alter table messages alter column content_encryption_version set default 0;
    alter table messages alter column content_encryption_version set not null;
    do $$
    declare existing_constraint record;
    begin
      for existing_constraint in
        select constraint_row.conname
        from pg_constraint constraint_row
        where constraint_row.conrelid='messages'::regclass
          and constraint_row.contype='c'
          and (
            lower(pg_get_constraintdef(constraint_row.oid)) like '%body is not null%media_data is not null%'
            or lower(pg_get_constraintdef(constraint_row.oid)) like '%octet_length(media_data)%'
          )
      loop
        execute format('alter table messages drop constraint %I',existing_constraint.conname);
      end loop;
    end;
    $$;
    alter table messages drop constraint if exists messages_encrypted_content_check;
    alter table messages add constraint messages_encrypted_content_check check (
      (
        content_encryption_version=0
        and content_encryption_key_id is null
        and body_ciphertext is null
        and media_name_ciphertext is null
        and media_type_ciphertext is null
        and media_ciphertext is null
        and (body is not null or media_data is not null)
      )
      or
      (
        content_encryption_version=1
        and content_encryption_key_id ~ '^[0-9a-f]{16}$'
        and body is null
        and media_name is null
        and media_type is null
        and media_data is null
        and (body_ciphertext is not null or media_ciphertext is not null)
        and (
          (
            media_ciphertext is null
            and media_name_ciphertext is null
            and media_type_ciphertext is null
          )
          or
          (
            media_ciphertext is not null
            and media_name_ciphertext is not null
            and media_type_ciphertext is not null
          )
        )
      )
    );
    alter table messages drop constraint if exists messages_legacy_media_size_check;
    alter table messages add constraint messages_legacy_media_size_check
      check (octet_length(media_data) is null or octet_length(media_data) <= 26214400);
    alter table messages drop constraint if exists messages_encrypted_media_size_check;
    alter table messages add constraint messages_encrypted_media_size_check
      check (octet_length(media_ciphertext) is null or octet_length(media_ciphertext) <= 26214440);
    alter table messages add column if not exists message_kind text not null default 'user';
    alter table messages add column if not exists expires_at timestamptz;
    update messages
      set expires_at=created_at+case
        when media_data is not null or media_ciphertext is not null or message_kind='call_event' then interval '90 days'
        else interval '365 days'
      end
      where expires_at is null;
    alter table messages alter column expires_at set default now() + interval '365 days';
    alter table messages alter column expires_at set not null;
    alter table messages drop constraint if exists messages_message_kind_check;
    alter table messages add constraint messages_message_kind_check
      check (message_kind in ('user','automatic','call_event'));
    create or replace function set_message_expiry()
    returns trigger language plpgsql as $$
    begin
      new.expires_at=new.created_at+case
        when new.media_data is not null or new.media_ciphertext is not null or new.message_kind='call_event' then interval '90 days'
        else interval '365 days'
      end;
      return new;
    end;
    $$;
    drop trigger if exists messages_set_expiry on messages;
    create trigger messages_set_expiry
      before insert or update of media_data,media_ciphertext,message_kind on messages
      for each row execute function set_message_expiry();

    create table if not exists message_receipts (
      message_id uuid not null references messages(id) on delete cascade,
      recipient_id uuid not null references accounts(id) on delete cascade,
      received_at timestamptz,
      seen_at timestamptz,
      primary key(message_id,recipient_id),
      check (seen_at is null or received_at is not null)
    );

    create table if not exists security_events (
      id bigserial primary key,
      account_id uuid references accounts(id) on delete set null,
      event_type text not null,
      outcome text not null check (outcome in ('success','failure','blocked')),
      identity_hash text,
      ip_hash text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null default now() + interval '365 days'
    );
    create index if not exists security_events_expiry_idx on security_events(expires_at);
    create index if not exists security_events_account_created_idx on security_events(account_id,created_at desc);

    create table if not exists retention_runs (
      id bigserial primary key,
      started_at timestamptz not null,
      completed_at timestamptz not null default now(),
      deleted_counts jsonb not null default '{}'::jsonb,
      expires_at timestamptz not null default now() + interval '365 days'
    );
    create index if not exists retention_runs_expiry_idx on retention_runs(expires_at);

    create table if not exists privacy_requests (
      id uuid primary key default gen_random_uuid(),
      requester_account_id uuid references accounts(id) on delete set null,
      subject_account_id uuid references accounts(id) on delete set null,
      family_id uuid references families(id) on delete set null,
      requester_email text,
      requester_contact_id text,
      subject_display_name text not null,
      subject_role text not null check (subject_role in ('parent','child')),
      request_type text not null
        check (request_type in ('access','rectification','erasure','restriction','objection')),
      status text not null default 'submitted'
        check (status in ('submitted','in_review','completed','rejected','cancelled')),
      details text not null,
      response_text text,
      response_actor text,
      created_at timestamptz not null default now(),
      acknowledged_at timestamptz not null default now(),
      due_at timestamptz not null default now() + interval '1 month',
      responded_at timestamptz,
      completed_at timestamptz,
      restriction_applied_at timestamptz,
      restriction_lifted_at timestamptz,
      backup_expires_at timestamptz,
      expires_at timestamptz not null default now() + interval '5 years'
    );
    create index if not exists privacy_requests_requester_idx
      on privacy_requests(requester_account_id,created_at desc);
    create index if not exists privacy_requests_subject_idx
      on privacy_requests(subject_account_id,created_at desc);
    create index if not exists privacy_requests_due_idx
      on privacy_requests(status,due_at);
    create index if not exists privacy_requests_expiry_idx
      on privacy_requests(expires_at);

    create table if not exists privacy_request_events (
      id bigserial primary key,
      request_id uuid not null references privacy_requests(id) on delete cascade,
      actor_type text not null check (actor_type in ('requester','controller','system')),
      event_type text not null
        check (event_type in ('submitted','acknowledged','in_review','completed','rejected','cancelled','restriction_applied','restriction_lifted')),
      note text,
      created_at timestamptz not null default now()
    );
    create index if not exists privacy_request_events_request_idx
      on privacy_request_events(request_id,created_at);

    create table if not exists erasure_tombstones (
      id uuid primary key default gen_random_uuid(),
      privacy_request_id uuid references privacy_requests(id) on delete set null,
      family_id uuid,
      account_ids uuid[] not null,
      created_at timestamptz not null default now(),
      backup_expires_at timestamptz not null default now() + interval '7 days',
      expires_at timestamptz not null default now() + interval '30 days',
      check (cardinality(account_ids) > 0)
    );
    create index if not exists erasure_tombstones_expiry_idx
      on erasure_tombstones(expires_at);

    insert into message_receipts(message_id,recipient_id)
    select message.id,member.account_id
    from messages message
    join conversation_members member
      on member.conversation_id=message.conversation_id
     and member.account_id<>message.sender_id
    on conflict(message_id,recipient_id) do nothing;

    create or replace function provision_message_receipts()
    returns trigger
    language plpgsql
    as $$
    begin
      insert into message_receipts(message_id,recipient_id)
      select new.id,member.account_id
      from conversation_members member
      where member.conversation_id=new.conversation_id
        and member.account_id<>new.sender_id
      on conflict(message_id,recipient_id) do nothing;
      return new;
    end;
    $$;

    drop trigger if exists messages_provision_receipts on messages;
    create trigger messages_provision_receipts
      after insert on messages
      for each row execute function provision_message_receipts();

    create table if not exists clubhouse_activities (
      id text primary key,
      reward smallint not null check (reward > 0 and reward <= 500),
      active boolean not null default true
    );

    insert into clubhouse_activities(id,reward,active) values
      ('color-hunt',25,true),
      ('one-line-drawing',20,true),
      ('mystery-mime',30,true),
      ('multiplayer-games',40,true),
      ('memory-pairs',30,true),
      ('nature-quiz',20,true),
      ('odd-one-out',20,true)
    on conflict(id) do update
      set reward=excluded.reward,active=excluded.active;

    create table if not exists clubhouse_activity_progress (
      child_id uuid not null references accounts(id) on delete cascade,
      activity_id text not null references clubhouse_activities(id),
      first_completed_at timestamptz not null default now(),
      last_completed_at timestamptz not null default now(),
      completion_count integer not null default 1 check (completion_count > 0),
      awarded_stars integer not null check (awarded_stars >= 0),
      primary key(child_id,activity_id)
    );

    create table if not exists clubhouse_daily_activity (
      child_id uuid not null references accounts(id) on delete cascade,
      activity_date date not null,
      first_completed_at timestamptz not null default now(),
      primary key(child_id,activity_date)
    );

    create index if not exists messages_conversation_created_idx on messages(conversation_id, created_at);
    create index if not exists messages_expiry_idx on messages(expires_at);
    create index if not exists message_receipts_recipient_idx on message_receipts(recipient_id,seen_at,received_at);
    create index if not exists clubhouse_progress_child_idx on clubhouse_activity_progress(child_id,last_completed_at desc);
    create index if not exists clubhouse_daily_child_idx on clubhouse_daily_activity(child_id,activity_date desc);
    create index if not exists conversation_members_account_idx on conversation_members(account_id);
  `);
  await initializeAuthSessionStore(pool);
}
