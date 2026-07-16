-- 0009_scoring_fixes.sql — align the server-side standings recompute
-- with the league rules in golf/docs/CALCULATIONS.md (and the JS
-- engine in golf/lib/golf-calc.js):
--
--   1. Low round = lowest NET (gross − handicap) among attended
--      18-hole players with a handicap — 0007 wrongly used lowest
--      gross and ignored attendance/handicap.
--   2. Low-round ties SPLIT the 3 points evenly (1.5 each for a
--      two-way tie) instead of paying each winner in full.
--   3. Championship cap: only each player's best 10 rounds count
--      toward the season total; extra rounds drop the lowest.
--   4. Penalty uses the round's real course par (courses.par via
--      rounds.course_id) instead of a hard-coded 72/36.
--
-- Apply AFTER 0008_courses_and_season_players.sql.
--
-- After applying, replay the totals so existing rows pick up the rules:
--   select recompute_season_standings(id) from seasons where sport = 'golf';

create or replace function recompute_season_standings(p_season_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from final_standings where season_id = p_season_id;

  with season_rounds as (
    select r.id, coalesce(c.par, 72)::numeric as par
    from rounds r
    left join courses c on c.id = r.course_id
    where r.season_id = p_season_id and r.played = true
  ),
  -- Lowest net per round; the window in the outer query only sees the
  -- rank-1 rows, so count(*) is the number of tied winners.
  low_round_bonuses as (
    select round_id, player_id,
           3.0 / count(*) over (partition by round_id) as pts
    from (
      select r.round_id, r.player_id,
             rank() over (partition by r.round_id
                          order by r.gross - r.handicap) as rk
      from results r
      join season_rounds sr on sr.id = r.round_id
      where r.attended
        and r.holes_played = 18
        and r.gross is not null
        and r.handicap is not null
    ) ranked
    where rk = 1
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
        - case
            when r.attended
                 and r.gross is not null
                 and r.handicap is not null
                 and r.holes_played in (9, 18)
                 and (r.gross::numeric
                      - case when r.holes_played = 18 then sr.par else sr.par / 2 end
                      - case when r.holes_played = 18 then r.handicap
                             else r.handicap::numeric / 2 end) > 5
            then ceil((r.gross::numeric
                      - case when r.holes_played = 18 then sr.par else sr.par / 2 end
                      - case when r.holes_played = 18 then r.handicap
                             else r.handicap::numeric / 2 end - 5) / 5)::int
            else 0
          end
        as pts
    from results r
    join season_rounds sr on sr.id = r.round_id
  ),
  ranked_rounds as (
    select p.*,
           row_number() over (partition by p.player_id order by p.pts desc) as pos
    from per_player_per_round p
  ),
  totals as (
    select
      player_id,
      max(name) as name,
      coalesce(sum(pts) filter (where pos <= 10), 0)::numeric as total_points,
      count(*) as rounds_played
    from ranked_rounds
    group by player_id
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
