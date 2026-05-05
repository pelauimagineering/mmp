# golf-supabase

Schema, RPC, and one-time seed for the live golf scoring backend.

## One-time setup

1. Create a free-tier Supabase project at supabase.com.
2. From the project's **Settings → API** page, note the **Project URL** and the **anon key**. Both go into `golf/supabase-config.js` (and ship to the browser; that's safe — RLS gates writes).
3. From the same page, note the **service role key**. This stays local in `.env` for the seed script. **Never commit it.**
4. In the Supabase **SQL editor**, run, in order:
   - `migrations/0001_init.sql`
   - `migrations/0002_rpc.sql`
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

## Rotating the passphrase

```sql
update _secret set value = '<new phrase>' where key = 'golf_passphrase';
```

The score-entry form will hit "Wrong passphrase. Tap to retry" on the
next sync attempt; entering the new phrase clears localStorage and
drains the queue.

## Re-seeding

`seed-from-json.js` is idempotent — it upserts on natural keys
(player.id, season.id, round.id, (round_id, player_id)). Safe to
re-run if you've edited `golf/data/*.json` and want to overwrite.
