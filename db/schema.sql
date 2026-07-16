-- Zamane App — Neon schema
-- Run once via the Neon SQL editor (or `psql "$DATABASE_URL" -f db/schema.sql`).
-- Safe to re-run: every statement is idempotent.

create extension if not exists pgcrypto;

-- A group is a couple's shared space. A couple is exactly two users, not an
-- open-ended household, so membership is a plain group_id FK on users
-- rather than a group_members join table — every group-scoped query stays
-- a one-hop lookup instead of a join through a membership table. The "at
-- most 2 members" rule is enforced in application code (api/groups/join.ts).
create table if not exists groups (
  id            uuid primary key default gen_random_uuid(),
  invite_code   text not null,
  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create unique index if not exists groups_invite_code_idx on groups (invite_code);

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  password_hash text not null,
  display_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Added after the initial launch — `create table if not exists` above is a
-- no-op against an already-existing table, so the column is added here via
-- an explicit, idempotent alter instead of being folded into the create.
alter table users add column if not exists group_id uuid references groups(id) on delete set null;

-- Case-insensitive uniqueness without requiring the citext extension.
create unique index if not exists users_email_lower_idx on users (lower(email));
create index if not exists users_group_id_idx on users (group_id);

-- Session tokens are stored hashed (sha-256) — never the raw value — so a
-- DB read/leak alone can't be replayed as a live session.
create table if not exists sessions (
  token_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  user_agent text,
  ip         inet
);

create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists sessions_expires_at_idx on sessions (expires_at);

-- Password reset tokens: hashed, single-use (used_at), short-lived (expires_at).
create table if not exists password_reset_tokens (
  token_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);

create index if not exists password_reset_tokens_user_id_idx on password_reset_tokens (user_id);

-- Goals belong to a group (a couple's shared space) — every goal is visible
-- to and contributable by the two members of that group, and no one else.
-- group_id is set once at creation time from the creator's current group,
-- rather than derived transitively through the creator's (possibly later
-- changed) group membership — this keeps every goals query a single-table
-- filter instead of a join back through users. current_amount for
-- financial goals is never stored; it's always derived by summing
-- goal_contributions (see api/goals/*), so it can't drift from the log.
create table if not exists goals (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  description           text,
  goal_type             text not null check (goal_type in ('financial', 'general')),
  target_amount         numeric(12,2),
  current_progress_pct  integer not null default 0 check (current_progress_pct between 0 and 100),
  target_date           date,
  is_completed          boolean not null default false,
  created_by            uuid not null references users(id) on delete cascade,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint goals_financial_target_amount check (
    (goal_type = 'financial' and target_amount is not null and target_amount > 0)
    or (goal_type = 'general' and target_amount is null)
  )
);

-- Nullable at the DB level for the same reason users.group_id is added via
-- alter rather than create (see above) — every goal created through
-- api/goals/create.ts always sets it, so the app layer treats it as
-- required even though Postgres doesn't enforce that here.
alter table goals add column if not exists group_id uuid references groups(id) on delete cascade;

create index if not exists goals_created_by_idx on goals (created_by);
create index if not exists goals_is_completed_idx on goals (is_completed);
create index if not exists goals_group_id_idx on goals (group_id);

-- One row per "who contributed what when". For financial goals `amount` is
-- set; for general goals `progress_delta`/`new_progress_pct` are set —
-- never both.
create table if not exists goal_contributions (
  id                uuid primary key default gen_random_uuid(),
  goal_id           uuid not null references goals(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  amount            numeric(12,2),
  progress_delta    integer,
  new_progress_pct  integer,
  note              text,
  created_at        timestamptz not null default now()
);

create index if not exists goal_contributions_goal_id_idx on goal_contributions (goal_id);
create index if not exists goal_contributions_user_id_idx on goal_contributions (user_id);
create index if not exists goal_contributions_created_at_idx on goal_contributions (created_at);

-- Trips belong to a group, same rationale as goals above. The itinerary is
-- a flat append-only list of dated/undated entries rather than a nested
-- day structure — grouping by item_date happens in the app layer, which
-- keeps this table simple and lets an entry be undated (e.g. "book hotel").
create table if not exists trips (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  destination   text,
  start_date    date,
  end_date      date,
  budget        numeric(12,2),
  notes         text,
  created_by    uuid not null references users(id) on delete cascade,
  group_id      uuid not null references groups(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists trips_group_id_idx on trips (group_id);
create index if not exists trips_start_date_idx on trips (start_date);

create table if not exists trip_itinerary_items (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references trips(id) on delete cascade,
  title         text not null,
  item_date     date,
  item_time     time,
  location      text,
  notes         text,
  created_by    uuid not null references users(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create index if not exists trip_itinerary_items_trip_id_idx on trip_itinerary_items (trip_id);

-- One shared shopping list per group (not per user, not multiple named
-- lists) — mirrors the "a couple is one shared space" model used by goals
-- and trips.
create table if not exists shopping_items (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups(id) on delete cascade,
  name          text not null,
  quantity      integer not null default 1 check (quantity > 0),
  category      text,
  price         numeric(12,2),
  notes         text,
  is_checked    boolean not null default false,
  created_by    uuid not null references users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists shopping_items_group_id_idx on shopping_items (group_id);
create index if not exists shopping_items_is_checked_idx on shopping_items (is_checked);
