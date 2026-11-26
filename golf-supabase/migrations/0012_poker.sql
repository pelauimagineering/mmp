-- 0012_poker.sql — poker game nights move onto the live backend.
--
-- Until now poker lived in golf/data/poker.json, rebuilt from the season
-- spreadsheet by hand. This adds the tables and passphrase-gated RPCs
-- behind golf/poker-entry.html, so a night can be planned ahead and its
-- results entered from a phone, the way golf rounds are.
--
-- What's stored is only what someone types: who showed up and, per game,
-- who won and who was runner-up — plus the point columns those produce
-- (appearance / win / tie / runner-up, the spreadsheet's columns). Event
-- totals, running season totals, ranks and final standings are derived
-- on read by golf/lib/poker-calc.js.
--
-- Apply AFTER 0011_course_editing.sql, then seed the history with:
--   node golf-supabase/scripts/seed-poker.mjs
--
-- The passphrase is the same one golf score entry uses (_secret
-- 'golf_passphrase') — one phrase for the crew.

-- "No games" months ("Nov 2024"), shown as ghost cards in the schedule.
alter table seasons add column if not exists skipped_months text[] not null default '{}';

create table poker_events (
  id        text primary key,            -- '2026-27-nov'
  season_id text not null references seasons(id) on delete cascade,
  month     text not null,               -- 'Nov' — spreadsheet-era nights know only this
  year      int  not null,
  date      date,                        -- the night itself, when known
  time      text,                        -- 24h 'HH:MM' start
  host      text,                        -- free text: a player, or 'On-Line => LiPoker'
  played    boolean not null default false,
  -- [{ "winners": [player_id…], "runnersUp": [player_id…] }] — null for
  -- nights imported from the spreadsheet, which kept only the points.
  games     jsonb,
  updated_at timestamptz not null default now()
);

create table poker_results (
  event_id  text not null references poker_events(id) on delete cascade,
  player_id text not null references players(id),
  -- Name as recorded on the night; the apps rewrite it to the player's
  -- current name at load (players.json aliases).
  name       text,
  appearance numeric not null default 0,
  win        numeric,
  tie        numeric,
  runner_up  numeric,
  primary key (event_id, player_id)
);

-- Same access pattern as every other public table (0002/0003): anon may
-- read; all writes go through SECURITY DEFINER RPCs or the service role.
alter table poker_events  enable row level security;
alter table poker_results enable row level security;
create policy "poker_events read"  on poker_events  for select to anon using (true);
create policy "poker_results read" on poker_results for select to anon using (true);
grant select on public.poker_events, public.poker_results to anon;
grant select, insert, update, delete on public.poker_events, public.poker_results to service_role;

alter publication supabase_realtime add table poker_events;
alter publication supabase_realtime add table poker_results;

-- ── enter_poker_event(passphrase, payload) ─────────────────────────
-- Plans a night (played = false, no results) or records one. Payload:
--   { "season":  { "id": "poker-2026-27", "label": "2026–27" },
--     "event":   { "id", "season_id", "date", "month", "year", "time",
--                  "host", "played", "games" },
--     "results": [{ "player_id", "name", "appearance", "win", "tie",
--                   "runner_up" }] }
-- Upserts by event id, and REPLACES the night's results with the
-- payload's, so re-sending from the offline queue is harmless and a
-- correction can't leave a stale row behind.
create or replace function enter_poker_event(p_passphrase text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_season jsonb;
  v_event  jsonb;
  v_result jsonb;
  v_id     text;
begin
  select value into v_secret from _secret where key = 'golf_passphrase';
  if v_secret is null or p_passphrase is null or p_passphrase != v_secret then
    raise exception 'invalid passphrase' using errcode = '28000';
  end if;

  v_event := p_payload->'event';
  v_id := v_event->>'id';
  if v_id is null or v_event->>'season_id' is null then
    raise exception 'payload missing event id or season_id' using errcode = '22023';
  end if;

  -- The first night planned in a new season creates the season.
  v_season := p_payload->'season';
  insert into seasons (id, sport, label)
  values (
    v_event->>'season_id',
    'poker',
    coalesce(v_season->>'label', replace(v_event->>'season_id', 'poker-', ''))
  )
  on conflict (id) do nothing;

  insert into poker_events (id, season_id, month, year, date, time, host, played, games)
  values (
    v_id,
    v_event->>'season_id',
    v_event->>'month',
    (v_event->>'year')::int,
    nullif(v_event->>'date', '')::date,
    nullif(v_event->>'time', ''),
    nullif(v_event->>'host', ''),
    coalesce((v_event->>'played')::boolean, false),
    nullif(v_event->'games', 'null'::jsonb)
  )
  on conflict (id) do update set
    season_id  = excluded.season_id,
    month      = excluded.month,
    year       = excluded.year,
    date       = excluded.date,
    time       = excluded.time,
    host       = excluded.host,
    played     = excluded.played,
    games      = excluded.games,
    updated_at = now();

  delete from poker_results where event_id = v_id;

  for v_result in select * from jsonb_array_elements(coalesce(p_payload->'results', '[]'::jsonb)) loop
    insert into poker_results (event_id, player_id, name, appearance, win, tie, runner_up)
    values (
      v_id,
      v_result->>'player_id',
      v_result->>'name',
      coalesce((v_result->>'appearance')::numeric, 0),
      (v_result->>'win')::numeric,
      (v_result->>'tie')::numeric,
      (v_result->>'runner_up')::numeric
    );
  end loop;
end;
$$;

grant execute on function enter_poker_event(text, jsonb) to anon;

-- ── cancel_poker_event(passphrase, event_id) ───────────────────────
-- Takes a planned night off the schedule. Refuses a night that has been
-- played: results are corrected, never deleted, from the phone.
create or replace function cancel_poker_event(p_passphrase text, p_event_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_played boolean;
begin
  select value into v_secret from _secret where key = 'golf_passphrase';
  if v_secret is null or p_passphrase is null or p_passphrase != v_secret then
    raise exception 'invalid passphrase' using errcode = '28000';
  end if;

  select played into v_played from poker_events where id = p_event_id;
  if not found then
    return;   -- already gone
  end if;
  if v_played then
    raise exception 'night "%" has been played and cannot be cancelled', p_event_id using errcode = '22023';
  end if;

  delete from poker_events where id = p_event_id;
end;
$$;

grant execute on function cancel_poker_event(text, text) to anon;
