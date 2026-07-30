-- 0011_course_editing.sql — deliberate course edits, accidental ones blocked.
--
-- 1. update_course(p_passphrase, p_payload) — new passphrase-gated RPC that
--    edits an existing courses row ({ id, name?, par?, slope?, rating? };
--    omitted fields keep their current values) and then replays standings
--    for every season with a played round at that course, because par feeds
--    the over-par penalty bands in recompute_season_standings (0009).
--
-- 2. enter_round()'s new_course upsert becomes insert-or-ignore. The field
--    exists so an organizer can add a brand-new course from the phone; it
--    was never meant to edit one. Previously a typed name that slugified to
--    an existing course id ("Kedron-Dells" → kedron-dells) silently
--    overwrote that course's par/slope/rating for every round ever played
--    there. Now the existing row always wins — including for stale payloads
--    replayed from the offline queue — and edits go through update_course.
--    Trade-off: a typo made while creating a genuinely new course can no
--    longer be corrected by re-saving the round; use the Edit-course screen.
--
-- Apply AFTER 0010_enter_round_course.sql.

create or replace function update_course(p_passphrase text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_id     text;
  v_par    int;
  v_slope  int;
  v_rating numeric;
begin
  select value into v_secret from _secret where key = 'golf_passphrase';
  if v_secret is null or p_passphrase is null or p_passphrase != v_secret then
    raise exception 'invalid passphrase' using errcode = '28000';
  end if;

  v_id := p_payload->>'id';
  if v_id is null then
    raise exception 'payload missing "id"' using errcode = '22023';
  end if;

  v_par    := (p_payload->>'par')::int;
  v_slope  := (p_payload->>'slope')::int;
  v_rating := (p_payload->>'rating')::numeric;

  -- Same ranges the score-entry inputs enforce.
  if v_par is not null and v_par not between 54 and 80 then
    raise exception 'par % out of range 54-80', v_par using errcode = '22023';
  end if;
  if v_slope is not null and v_slope not between 55 and 155 then
    raise exception 'slope % out of range 55-155', v_slope using errcode = '22023';
  end if;
  if v_rating is not null and v_rating not between 55 and 80 then
    raise exception 'rating % out of range 55-80', v_rating using errcode = '22023';
  end if;

  update courses set
    name   = coalesce(p_payload->>'name', name),
    par    = coalesce(v_par, par),
    slope  = coalesce(v_slope, slope),
    rating = coalesce(v_rating, rating)
  where id = v_id;

  if not found then
    raise exception 'unknown course "%"', v_id using errcode = '22023';
  end if;

  perform recompute_season_standings(s.season_id)
  from (
    select distinct season_id from rounds
    where course_id = v_id and played and season_id is not null
  ) s;
end;
$$;

grant execute on function update_course(text, jsonb) to anon;

-- Re-create enter_round with the guarded new_course insert. Body is
-- otherwise identical to 0010.
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
    -- Never clobber an existing course from round entry; use update_course.
    on conflict (id) do nothing;
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
