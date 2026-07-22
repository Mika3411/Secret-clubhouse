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
      created_at timestamptz not null default now(),
      check ((role = 'parent' and email is not null and parent_id is null) or (role = 'child' and parent_id is not null))
    );

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

    create table if not exists presence (
      account_id uuid primary key references accounts(id) on delete cascade,
      last_seen timestamptz not null default now()
    );

    create table if not exists push_subscriptions (
      id uuid primary key default gen_random_uuid(),
      account_id uuid not null references accounts(id) on delete cascade,
      endpoint text not null unique,
      subscription jsonb not null,
      created_at timestamptz not null default now()
    );
    create index if not exists push_subscriptions_account_idx on push_subscriptions(account_id);

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
