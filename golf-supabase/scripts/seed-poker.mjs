#!/usr/bin/env node
/**
 * Seed the poker history into Supabase from golf/data/poker.json.
 * Run once after applying migrations/0012_poker.sql:
 *
 *   node golf-supabase/scripts/seed-poker.mjs            # write
 *   node golf-supabase/scripts/seed-poker.mjs --dry-run  # just count
 *
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE from golf-supabase/.env
 * (see .env.example), like seed-from-json.js.
 *
 * Idempotent — every row is an upsert on its natural key — but it writes
 * what the JSON says: re-running it AFTER nights have been entered from
 * the phone would overwrite any of those nights the JSON also lists.
 * It is a one-time import, not a sync.
 */

import { existsSync, readFileSync } from 'node:fs';
import { pokerRowsFromJson } from '../../golf/lib/poker-shape.js';

const here = (p) => new URL(p, import.meta.url);
const readJson = (p) => JSON.parse(readFileSync(here(p), 'utf8'));
const dryRun = process.argv.includes('--dry-run');

if (existsSync(here('../.env'))) {
  for (const line of readFileSync(here('../.env'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const roster = readJson('../../golf/data/players.json').players;
const poker = readJson('../../golf/data/poker.json');

// The roster goes up too: poker_results rows reference players, and a
// poker-only player (Dee) may be newer than the last golf seed.
const players = roster.map((p) => ({
  id: p.id,
  name: p.name,
  current_handicap: p.currentHandicap ?? null,
  sports: p.sports ?? [],
}));
const { seasons, events, results } = pokerRowsFromJson(poker, roster);

console.log(`${dryRun ? 'Would seed' : 'Seeding'} ${players.length} players, ${seasons.length} poker seasons, ${events.length} nights, ${results.length} result rows.`);
if (dryRun) process.exit(0);

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE. See .env.example.');
  process.exit(1);
}

async function upsert(table, rows) {
  if (!rows.length) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`POST ${table} → ${res.status}: ${await res.text()}`);
}

try {
  await upsert('players', players);
  await upsert('seasons', seasons);
  await upsert('poker_events', events);
  await upsert('poker_results', results);
  console.log('Done.');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
