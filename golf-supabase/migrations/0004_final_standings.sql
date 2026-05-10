-- 0004_final_standings.sql — per-season ranked totals, computed from
-- rounds + results so the homepage and SPA can read champions directly
-- without re-deriving the math client-side.
--
-- Apply AFTER 0003_grants.sql.
--
-- After applying, backfill existing seasons:
--   select recompute_season_standings(id) from seasons where sport = 'golf';

create table final_standings (
  season_id     text not null references seasons(id) on delete cascade,
  player_id     text not null references players(id),
  name          text not null,
  total_points  numeric not null default 0,
  rank          int not null,
  rounds_played int not null default 0,
  primary key (season_id, player_id)
);

alter table final_standings enable row level security;

create policy "final_standings read" on final_standings
  for select to anon using (true);

grant select on public.final_standings to anon;

alter publication supabase_realtime add table final_standings;

-- ── recompute_season_standings(season_id) ──────────────────────────
-- Wipes the season's rows and re-derives them from rounds + results
-- using the canonical scoring matrix:
--   attendance:  5 pts (per played round attended)
--   par:         1 pt × pars
--   birdie:      3 pts × birdies
--   eagle:      10 pts × eagles
--   albatross:  20 pts × albatrosses
--   hole_in_one:25 pts × hole_in_ones
--   low_round:   3 pts to every player tied for the lowest 18-hole
--                gross in each played round (full points, ties not split)
--
-- SECURITY DEFINER so the enter_round() RPC (also SECURITY DEFINER,
-- callable by anon) can invoke it without granting anon write access
-- to final_standings.

create or replace function recompute_season_standings(p_season_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from final_standings where season_id = p_season_id;

  with season_rounds as (
    select id from rounds where season_id = p_season_id and played = true
  ),
  -- Per-round low-round winners: every player tied for the lowest
  -- 18-hole gross in the round earns 3 pts each.
  low_round_bonuses as (
    select r.round_id, r.player_id, 3 as pts
    from results r
    join season_rounds sr on sr.id = r.round_id
    where r.holes_played = 18
      and r.gross is not null
      and r.gross = (
        select min(gross) from results
        where round_id = r.round_id
          and holes_played = 18
          and gross is not null
      )
  ),
  per_player_per_round as (
    select
      r.player_id,
      r.name,
      r.round_id,
      (case when r.attended then 5 else 0 end)
        + coalesce(r.pars, 0) * 1
        + coalesce(r.birdies, 0) * 3
        + coalesce(r.eagles, 0) * 10
        + coalesce(r.albatrosses, 0) * 20
        + coalesce(r.hole_in_ones, 0) * 25
        + coalesce((select pts from low_round_bonuses lb
                    where lb.round_id = r.round_id
                      and lb.player_id = r.player_id), 0)
        as pts
    from results r
    join season_rounds sr on sr.id = r.round_id
  ),
  totals as (
    select
      p.player_id,
      max(p.name) as name,
      sum(p.pts)::numeric as total_points,
      count(*) filter (where p.pts > 0 or p.player_id is not null) as rounds_played
    from per_player_per_round p
    group by p.player_id
  )
  insert into final_standings (season_id, player_id, name, total_points, rank, rounds_played)
  select
    p_season_id,
    t.player_id,
    coalesce(t.name, pl.name),
    t.total_points,
    dense_rank() over (order by t.total_points desc),
    t.rounds_played
  from totals t
  left join players pl on pl.id = t.player_id;
end;
$$;

grant execute on function recompute_season_standings(text) to anon;
