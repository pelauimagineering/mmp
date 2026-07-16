-- 0008_courses_and_season_players.sql — course table (par / slope /
-- rating) and per-season starting handicaps, the two inputs the
-- running-handicap engine needs (golf/lib/golf-calc.js, documented in
-- golf/docs/CALCULATIONS.md).
--
-- Apply AFTER 0007_limitless_penalty.sql, then seed with:
--   node golf-supabase/scripts/seed-courses.js

create table courses (
  id     text primary key,            -- slug, e.g. 'kedron-dells'
  name   text not null,
  par    int  not null default 72,    -- 18-hole par for the course
  slope  int  not null,               -- course slope from the tees played
  rating numeric(4,1) not null        -- course rating from the tees played
);

-- course_id is additive: rounds.course (free text) stays the display
-- name and the fallback for rounds entered before this migration.
alter table rounds add column course_id text references courses(id);

-- Handicap at the start of each season. players.current_handicap
-- remains as a legacy/display scalar; golf reads THIS table plus the
-- season's results to derive the running handicap on the fly.
create table season_players (
  season_id         text not null references seasons(id) on delete cascade,
  player_id         text not null references players(id),
  starting_handicap int  not null,
  primary key (season_id, player_id)
);

-- Same access pattern as the other public tables (0002/0003): anon
-- may read, all writes go through SECURITY DEFINER RPCs or the
-- service role.
alter table courses        enable row level security;
alter table season_players enable row level security;
create policy "courses read"        on courses        for select to anon using (true);
create policy "season_players read" on season_players for select to anon using (true);
grant select on public.courses, public.season_players to anon;
