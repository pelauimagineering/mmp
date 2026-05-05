-- 0001_init.sql — initial schema for the live golf scoring backend.
--
-- Apply this once in the Supabase SQL editor (or via psql against the
-- project's connection string) before 0002_rpc.sql.

create table players (
  id text primary key,
  name text not null,
  current_handicap int,
  sports text[] not null default '{}'
);

create table seasons (
  id text primary key,
  sport text not null check (sport in ('golf','poker')),
  label text not null
);

create table rounds (
  id text primary key,
  season_id text not null references seasons(id) on delete cascade,
  date date not null,
  course text,
  organizer text,
  tee_times text[] not null default '{}',
  played boolean not null default false
);

create table results (
  round_id text not null references rounds(id) on delete cascade,
  player_id text not null references players(id),
  -- Snapshot of the display name at the time of the round, so the
  -- existing renderers (which expect a `name` field on each result)
  -- keep working without an extra join.
  name text,
  attended boolean not null default false,
  -- 9, 18, or null (DNP)
  holes_played int,
  gross int,
  handicap int,
  pars int default 0,
  birdies int default 0,
  eagles int default 0,
  albatrosses int default 0,
  hole_in_ones int default 0,
  updated_at timestamptz not null default now(),
  primary key (round_id, player_id)
);

-- Single-row table that holds the shared score-entry passphrase.
-- RLS in 0002_rpc.sql will deny all SELECTs from the anon role —
-- the value is only readable from inside the SECURITY DEFINER RPC.
create table _secret (
  key text primary key,
  value text not null
);

-- Realtime publication: enable on rounds + results so subscribers
-- light up when scores are entered AND when a new round is added
-- mid-season.
alter publication supabase_realtime add table results;
alter publication supabase_realtime add table rounds;
