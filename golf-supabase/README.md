# golf-supabase

Schema, RPC, and one-time seed for the live golf scoring backend.

## One-time setup

1. Create a free-tier Supabase project at supabase.com.
2. From the project's **Settings → API** page, note the **Project URL** and the **anon key**. Both go into `golf/supabase-config.js` (and ship to the browser; that's safe — RLS gates writes).
3. From the same page, note the **service role key**. This stays local in `.env` for the seed script. **Never commit it.**
4. In the Supabase **SQL editor**, run, in order:
   - `migrations/0001_init.sql`
   - `migrations/0002_rpc.sql`
   - `migrations/0003_grants.sql`
   - `migrations/0004_final_standings.sql`
   - `migrations/0005_enter_round_recompute.sql`
   - `migrations/0006_penalty_rule.sql`
   - `migrations/0007_limitless_penalty.sql`
   - `migrations/0008_courses_and_season_players.sql`
   - `migrations/0009_scoring_fixes.sql`
   - `migrations/0010_enter_round_course.sql`
   - `migrations/0011_course_editing.sql`
5. Set the score-entry passphrase:
   ```sql
   insert into _secret (key, value) values ('golf_passphrase', 'YOUR-PHRASE')
   on conflict (key) do update set value = excluded.value;
   ```
6. Confirm Realtime is enabled on `rounds` and `results` (**Database → Replication**).
7. Seed the existing JSON data:
   ```bash
   cd golf-supabase
   cp .env.example .env   # then edit .env with SUPABASE_URL + SUPABASE_SERVICE_ROLE
   node scripts/seed-from-json.js
   ```
8. Backfill `final_standings` for the seeded seasons:
   ```sql
   select recompute_season_standings(id) from seasons where sport = 'golf';
   ```

## Rotating the passphrase

```sql
update _secret set value = '<new phrase>' where key = 'golf_passphrase';
```

The score-entry form will hit "Wrong passphrase. Tap to retry" on the
next sync attempt; entering the new phrase clears localStorage and
drains the queue.

## Troubleshooting

**`42501: permission denied for table …` when running the seed script.**
The role grants in `0003_grants.sql` haven't been applied. Run that
migration in the SQL editor and re-run the seed.

**"Wrong passphrase" on every attempt.** The RPC answers `28000 invalid
passphrase` both when the phrase doesn't match and when the
`golf_passphrase` row is missing. Check the row exists, and that it has no
stray leading/trailing whitespace or unexpected capitals (the form trims
what's typed, but compares case-sensitively):
```sql
select '[' || value || ']' from _secret where key = 'golf_passphrase';
```
To (re)set it:
```sql
insert into _secret (key, value) values ('golf_passphrase', '<phrase>')
on conflict (key) do update set value = excluded.value;
```

**`Could not find the function public.update_course(…)` when saving a
course edit.** Migration `0011_course_editing.sql` hasn't been applied.
Run it in the SQL editor.

## Re-seeding

`seed-from-json.js` is idempotent — it upserts on natural keys
(player.id, season.id, round.id, (round_id, player_id)). Safe to
re-run if you've edited `golf/data/*.json` and want to overwrite.
