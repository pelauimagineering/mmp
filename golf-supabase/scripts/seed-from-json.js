#!/usr/bin/env node
/**
 * Seed the Supabase project from the legacy golf/data/*.json files.
 * Run once after applying both migrations.
 *
 *   cd golf-supabase
 *   cp .env.example .env && edit .env  # SUPABASE_URL + SUPABASE_SERVICE_ROLE
 *   node scripts/seed-from-json.js
 *
 * Idempotent: every insert is an upsert keyed on the natural id.
 * Re-running picks up whatever's currently in golf/data/*.json.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ENV_PATH = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(ENV_PATH)) {
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE. See .env.example.');
  process.exit(1);
}

const playersJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'golf', 'data', 'players.json'), 'utf8'));
const golfJson    = JSON.parse(fs.readFileSync(path.join(ROOT, 'golf', 'data', 'golf.json'), 'utf8'));
const pokerJson   = JSON.parse(fs.readFileSync(path.join(ROOT, 'golf', 'data', 'poker.json'), 'utf8'));

const playerById = new Map(playersJson.players.map((p) => [p.id, p]));
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const players = playersJson.players.map((p) => ({
  id: p.id,
  name: p.name,
  current_handicap: p.currentHandicap ?? null,
  sports: p.sports ?? [],
}));

const seasons = [
  ...golfJson.seasons.map((s) => ({ id: `golf-${s.id}`, sport: 'golf', label: s.label })),
  ...pokerJson.seasons.map((s) => ({ id: `poker-${s.id}`, sport: 'poker', label: s.label })),
];

const rounds = [];
const results = [];
for (const s of golfJson.seasons) {
  for (const r of s.rounds || []) {
    rounds.push({
      id: r.id,
      season_id: `golf-${s.id}`,
      date: r.date,
      course: r.course ?? null,
      organizer: r.organizer ?? null,
      tee_times: r.teeTimes ?? [],
      played: !!r.played,
    });
    for (const x of r.results || []) {
      const player_id = x.playerId || slugify(x.name);
      if (!playerById.has(player_id)) {
        console.warn(`  ! skipping result for unknown player ${player_id} in round ${r.id}`);
        continue;
      }
      results.push({
        round_id: r.id,
        player_id,
        name: x.name ?? playerById.get(player_id)?.name ?? null,
        attended: !!x.attended,
        holes_played: x.holesPlayed ?? null,
        gross: x.gross ?? null,
        handicap: x.handicap ?? null,
        pars: x.pars ?? 0,
        birdies: x.birdies ?? 0,
        eagles: x.eagles ?? 0,
        albatrosses: x.albatrosses ?? 0,
        hole_in_ones: x.holeInOnes ?? 0,
      });
    }
  }
}

async function rest(method, table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method,
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${table} → ${res.status}: ${text}`);
  }
  return res;
}

(async () => {
  console.log(`Seeding ${players.length} players, ${seasons.length} seasons, ${rounds.length} rounds, ${results.length} results.`);
  if (players.length) await rest('POST', 'players', players);
  if (seasons.length) await rest('POST', 'seasons', seasons);
  if (rounds.length)  await rest('POST', 'rounds',  rounds);
  if (results.length) await rest('POST', 'results', results);
  console.log('Done.');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
