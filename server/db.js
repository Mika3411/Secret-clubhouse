import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

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
      communication_schedule jsonb not null default '{"enabled":true,"messages":{"enabled":true,"start":"07:30","end":"20:30"},"calls":{"enabled":true,"start":"08:00","end":"19:30"},"video":{"enabled":false,"start":"09:00","end":"18:30"},"autoReply":{"enabled":true,"message":"Je suis en mode calme pour le moment. Je te répondrai pendant mes horaires autorisés."}}'::jsonb,
      created_at timestamptz not null default now(),
      check ((role = 'parent' and email is not null and parent_id is null) or (role = 'child' and parent_id is not null))
    );

    alter table accounts add column if not exists age smallint;
    alter table accounts add column if not exists username text;
    alter table accounts add column if not exists avatar_path text;
    alter table accounts add column if not exists avatar_color text;
    alter table accounts add column if not exists avatar_config jsonb;
    alter table accounts add column if not exists status text not null default 'active';
    alter table accounts add column if not exists safety_settings jsonb not null default '{"media":true}'::jsonb;
    alter table accounts add column if not exists communication_schedule jsonb not null default '{"enabled":true,"messages":{"enabled":true,"start":"07:30","end":"20:30"},"calls":{"enabled":true,"start":"08:00","end":"19:30"},"video":{"enabled":false,"start":"09:00","end":"18:30"},"autoReply":{"enabled":true,"message":"Je suis en mode calme pour le moment. Je te répondrai pendant mes horaires autorisés."}}'::jsonb;
    create unique index if not exists accounts_parent_username_unique on accounts(parent_id, lower(username)) where role = 'child';
    create index if not exists accounts_parent_children_idx on accounts(parent_id, created_at) where role = 'child';

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
      target_account_id uuid not null references accounts(id) on delete cascade,
      recipient_parent_id uuid not null references accounts(id) on delete cascade,
      status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (requester_id, target_account_id),
      check (requester_id <> recipient_parent_id)
    );
    create index if not exists contact_requests_recipient_idx on contact_requests(recipient_parent_id, status);

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
      check (player_one_id <> player_two_id)
    );
    alter table game_sessions drop constraint if exists game_sessions_game_type_check;
    alter table game_sessions add constraint game_sessions_game_type_check
      check (game_type in ('connect_four','tic_tac_toe','naval_battle'));
    create index if not exists game_sessions_players_idx on game_sessions(player_one_id, player_two_id, updated_at desc);

    create table if not exists presence (
      account_id uuid primary key references accounts(id) on delete cascade,
      last_seen timestamptz not null default now()
    );

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
      created_at timestamptz not null default now()
    );
    create index if not exists push_subscriptions_account_idx on push_subscriptions(account_id);

    create table if not exists application_settings (
      setting_key text primary key,
      setting_value jsonb not null,
      updated_at timestamptz not null default now()
    );

    create table if not exists native_push_tokens (
      id uuid primary key default gen_random_uuid(),
      account_id uuid not null references accounts(id) on delete cascade,
      platform text not null check (platform in ('ios','android')),
      token text not null unique,
      updated_at timestamptz not null default now()
    );

    create table if not exists messages (
      id uuid primary key default gen_random_uuid(),
      conversation_id uuid not null references conversations(id) on delete cascade,
      sender_id uuid not null references accounts(id) on delete cascade,
      body text,
      media_name text,
      media_type text,
      media_data bytea,
      created_at timestamptz not null default now(),
      check (body is not null or media_data is not null),
      check (octet_length(media_data) is null or octet_length(media_data) <= 26214400)
    );

    create index if not exists messages_conversation_created_idx on messages(conversation_id, created_at);
    create index if not exists conversation_members_account_idx on conversation_members(account_id);
  `);
}
