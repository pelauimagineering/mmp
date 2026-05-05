-- 0002_rpc.sql — row-level security + the passphrase-gated write RPC.
--
-- Apply this AFTER 0001_init.sql.

-- ── Reads are wide open to the anon role. Writes are denied entirely
--    on the table; the only path to write is through enter_round(). ──

alter table players enable row level security;
alter table seasons enable row level security;
alter table rounds  enable row level security;
alter table results enable row level security;
alter table _secret enable row level security;

create policy "players read" on players for select to anon using (true);
create policy "seasons read" on seasons for select to anon using (true);
create policy "rounds read"  on rounds  for select to anon using (true);
create policy "results read" on results for select to anon using (true);
-- _secret has no policies — anon cannot SELECT it.

-- ── enter_round(passphrase, payload) ───────────────────────────────
-- Verifies the passphrase against _secret, then upserts the round
-- header + every result row. SECURITY DEFINER means it runs with
-- the function-owner's privileges (which can read _secret) even
-- when called by anon.

create or replace function enter_round(p_passphrase text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_round  jsonb;
  v_result jsonb;
begin
  select value into v_secret from _secret where key = 'golf_passphrase';
  if v_secret is null or p_passphrase is null or p_passphrase != v_secret then
    raise exception 'invalid passphrase' using errcode = '28000';
  end if;

  v_round := p_payload->'round';
  if v_round is null then
    raise exception 'payload missing "round"' using errcode = '22023';
  end if;

  insert into rounds (id, season_id, date, course, organizer, tee_times, played)
  values (
    v_round->>'id',
    v_round->>'season_id',
    (v_round->>'date')::date,
    v_round->>'course',
    v_round->>'organizer',
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(v_round->'tee_times') as value),
      '{}'
    ),
    coalesce((v_round->>'played')::boolean, true)
  )
  on conflict (id) do update set
    date       = excluded.date,
    course     = excluded.course,
    organizer  = excluded.organizer,
    tee_times  = excluded.tee_times,
    played     = excluded.played;

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
end;
$$;

grant execute on function enter_round(text, jsonb) to anon;

-- ── Seed the passphrase row. Edit before applying, or update later:
--    update _secret set value = '<new phrase>' where key = 'golf_passphrase';
-- insert into _secret (key, value) values ('golf_passphrase', 'CHANGE-ME');
