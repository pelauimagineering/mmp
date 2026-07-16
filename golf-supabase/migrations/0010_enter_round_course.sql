-- 0010_enter_round_course.sql — teach enter_round() about courses.
--
-- The payload may now carry:
--   round.course_id  — slug of an existing courses row (optional)
--   new_course       — { id, name, par, slope, rating } upserted before
--                      the round insert, so an organizer can add a
--                      course the league has never played right from
--                      the phone (still passphrase-gated).
--
-- Both fields are optional: payloads queued by an older score-entry
-- build (no course_id) keep working unchanged.
--
-- Apply AFTER 0009_scoring_fixes.sql.

create or replace function enter_round(p_passphrase text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret     text;
  v_round      jsonb;
  v_result     jsonb;
  v_new_course jsonb;
  v_season_id  text;
begin
  select value into v_secret from _secret where key = 'golf_passphrase';
  if v_secret is null or p_passphrase is null or p_passphrase != v_secret then
    raise exception 'invalid passphrase' using errcode = '28000';
  end if;

  v_round := p_payload->'round';
  if v_round is null then
    raise exception 'payload missing "round"' using errcode = '22023';
  end if;

  v_season_id := v_round->>'season_id';

  v_new_course := p_payload->'new_course';
  if v_new_course is not null and v_new_course->>'id' is not null then
    insert into courses (id, name, par, slope, rating)
    values (
      v_new_course->>'id',
      coalesce(v_new_course->>'name', v_new_course->>'id'),
      coalesce((v_new_course->>'par')::int, 72),
      (v_new_course->>'slope')::int,
      (v_new_course->>'rating')::numeric
    )
    on conflict (id) do update set
      name   = excluded.name,
      par    = excluded.par,
      slope  = excluded.slope,
      rating = excluded.rating;
  end if;

  insert into rounds (id, season_id, date, course, organizer, tee_times, played, course_id)
  values (
    v_round->>'id',
    v_season_id,
    (v_round->>'date')::date,
    v_round->>'course',
    v_round->>'organizer',
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(v_round->'tee_times') as value),
      '{}'
    ),
    coalesce((v_round->>'played')::boolean, true),
    nullif(v_round->>'course_id', '')
  )
  on conflict (id) do update set
    date       = excluded.date,
    course     = excluded.course,
    organizer  = excluded.organizer,
    tee_times  = excluded.tee_times,
    played     = excluded.played,
    -- Keep the stored link when an old-format payload omits course_id.
    course_id  = coalesce(excluded.course_id, rounds.course_id);

  for v_result in select * from jsonb_array_elements(coalesce(p_payload->'results', '[]'::jsonb)) loop
    insert into results (round_id, player_id, name, attended, holes_played,
                         gross, handicap, pars, birdies, eagles, albatrosses, hole_in_ones)
    values (
      v_round->>'id',
      v_result->>'player_id',
      v_result->>'name',
      coalesce((v_result->>'attended')::boolean, false),
      nullif(v_result->>'holes_played', '')::int,
      nullif(v_result->>'gross', '')::int,
      nullif(v_result->>'handicap', '')::int,
      coalesce((v_result->>'pars')::int, 0),
      coalesce((v_result->>'birdies')::int, 0),
      coalesce((v_result->>'eagles')::int, 0),
      coalesce((v_result->>'albatrosses')::int, 0),
      coalesce((v_result->>'hole_in_ones')::int, 0)
    )
    on conflict (round_id, player_id) do update set
      name         = excluded.name,
      attended     = excluded.attended,
      holes_played = excluded.holes_played,
      gross        = excluded.gross,
      handicap     = excluded.handicap,
      pars         = excluded.pars,
      birdies      = excluded.birdies,
      eagles       = excluded.eagles,
      albatrosses  = excluded.albatrosses,
      hole_in_ones = excluded.hole_in_ones,
      updated_at   = now();
  end loop;

  perform recompute_season_standings(v_season_id);
end;
$$;

grant execute on function enter_round(text, jsonb) to anon;
