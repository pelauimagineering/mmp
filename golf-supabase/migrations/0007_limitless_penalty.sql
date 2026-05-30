-- 0007_limitless_penalty.sql — penalty grows without limit, one extra
-- point per 5 strokes over handicap par.
--
-- Apply AFTER 0006_penalty_rule.sql.
--
-- Penalty (diff = gross − (par + handicap), where par/handicap scale
-- linearly for 9-hole rounds: par=36, handicap/2):
--   penalty = ceil((diff − 5) / 5) when diff > 5, else 0
--   6–10 over → −1; 11–15 → −2; 16–20 → −3; 21–25 → −4; 26–30 → −5; …
-- Penalty applies only when attended, holes_played in (9, 18), and both
-- gross + handicap are recorded.
--
-- After applying, replay the totals so existing rows pick up the rule:
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
    select id from rounds where season_id = p_season_id and played = true
  ),
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
        - case
            when r.attended
                 and r.gross is not null
                 and r.handicap is not null
                 and r.holes_played in (9, 18)
                 and (r.gross::numeric
                      - case when r.holes_played = 18 then 72 else 36 end
                      - case when r.holes_played = 18 then r.handicap
                             else r.handicap::numeric / 2 end) > 5
            then ceil((r.gross::numeric
                      - case when r.holes_played = 18 then 72 else 36 end
                      - case when r.holes_played = 18 then r.handicap
                             else r.handicap::numeric / 2 end - 5) / 5)::int
            else 0
          end
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
