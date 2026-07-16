#!/usr/bin/env node
/**
 * Read-only parity check: recompute every player's running handicap
 * from the live Supabase data with golf/lib/golf-calc.js and print the
 * player × event grid next to the spreadsheet's Running_Handicap
 * values, plus the engine's season standings next to the DB's
 * final_standings.
 *
 *   node golf-supabase/scripts/verify-handicaps.js
 *
 * Uses the public anon key (read-only). Before migration 0008 is
 * applied/seeded, the courses + season_players tables don't exist —
 * the script falls back to golf/data/courses.json and
 * golf/data/players.json so it can still validate the math.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

// Public anon credentials, same values as golf/supabase-config.js
// (an ES module, so re-declared here for plain-Node use).
const SUPABASE_URL = 'https://jgzgyodxvounnirgmggl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MFxQU33CYCPWPa0j9VbVJA_bqIDS-sN';

// Expected Running Handicap after the 5 played 2026 events, from the
// sheet's Running_Handicap_2026!AF column. Wayne is 55 on the sheet
// only because of its synthetic-score rounding; the app's rule holds
// him at exactly his starting 56 (see docs/CALCULATIONS.md appendix).
const SHEET_AFTER_5 = {
  junior: 22, tony: 30, seymour: 24, harish: 22, kerwin: 24, jas: 21,
  gary: 43, lorenzo: 33, neave: 34, chris: 38, wayne: 56,
};

async function get(pathAndQuery) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) return null;
  return res.json();
}

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

(async () => {
  const calc = await import(path.join(ROOT, 'golf', 'lib', 'golf-calc.js'));

  const [rounds, results] = await Promise.all([
    get('rounds?select=*&order=date.asc'),
    get('results?select=*'),
  ]);
  if (!rounds || !results) {
    console.error('Could not read rounds/results from Supabase.');
    process.exit(1);
  }

  let courses = await get('courses?select=*');
  if (!courses) {
    console.log('(courses table not found — using golf/data/courses.json)');
    courses = JSON.parse(fs.readFileSync(path.join(ROOT, 'golf', 'data', 'courses.json'), 'utf8')).courses;
  }
  const courseById = new Map(courses.map((c) => [c.id, { ...c, slope: Number(c.slope), rating: Number(c.rating) }]));
  // Same fuzzy name matching as seed-courses.js — round names are
  // free text and often the full club name.
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const matchCourse = (roundName) => {
    const n = norm(roundName);
    if (!n) return null;
    const hits = courses.filter((c) => {
      const cn = norm(c.name);
      return n === cn || n.includes(cn) || cn.includes(n);
    });
    hits.sort((a, b) => norm(b.name).length - norm(a.name).length);
    return hits[0] ? courseById.get(hits[0].id) : null;
  };

  let starting = {};
  const seasonPlayers = await get('season_players?select=*&season_id=eq.golf-2026');
  if (seasonPlayers && seasonPlayers.length) {
    for (const sp of seasonPlayers) starting[sp.player_id] = sp.starting_handicap;
  } else {
    console.log('(season_players not found/empty — using players.json currentHandicap)');
    const pj = JSON.parse(fs.readFileSync(path.join(ROOT, 'golf', 'data', 'players.json'), 'utf8'));
    for (const p of pj.players) {
      if ((p.sports || []).includes('golf') && Number.isFinite(p.currentHandicap)) {
        starting[p.id] = p.currentHandicap;
      }
    }
  }

  const resultsByRound = new Map();
  for (const r of results) {
    if (!resultsByRound.has(r.round_id)) resultsByRound.set(r.round_id, []);
    resultsByRound.get(r.round_id).push({
      playerId: r.player_id,
      attended: !!r.attended,
      holesPlayed: r.holes_played,
      gross: r.gross,
      handicap: r.handicap,
      pars: r.pars, birdies: r.birdies, eagles: r.eagles,
      albatrosses: r.albatrosses, holeInOnes: r.hole_in_ones,
      name: r.name,
    });
  }

  const playedRounds = rounds
    .filter((r) => r.played && String(r.season_id) === 'golf-2026')
    .map((r) => ({
      id: r.id,
      date: r.date,
      label: r.course,
      courseInfo: (r.course_id && courseById.get(r.course_id)) || matchCourse(r.course),
      results: resultsByRound.get(r.id) || [],
    }));

  for (const r of playedRounds) {
    if (!r.courseInfo) console.warn(`! no slope/rating for round ${r.id} ("${r.label}") — players held at starting handicap`);
  }

  const running = calc.runningHandicaps({ rounds: playedRounds, startingHandicaps: starting });

  console.log(`\nRunning handicaps — ${playedRounds.length} played 2026 rounds`);
  console.log(['player'.padEnd(9), 'start', ...playedRounds.map((_, i) => `e${i + 1}`), 'now', 'sheet', ''].join('  '));
  let mismatches = 0;
  for (const [pid, info] of running) {
    const expected = SHEET_AFTER_5[pid];
    const ok = expected == null || playedRounds.length !== 5 ? '' : (info.current === expected ? '✓' : '✗ MISMATCH');
    if (ok.startsWith('✗')) mismatches++;
    console.log([
      pid.padEnd(9),
      String(info.starting).padStart(5),
      ...info.events.map((e) => String(e.handicapAfter).padStart(2)),
      String(info.current).padStart(3),
      String(expected ?? '—').padStart(5),
      ok,
    ].join('  '));
  }

  // Standings parity: engine vs stored final_standings.
  const season = { rounds: playedRounds.map((r) => ({ ...r, played: true })) };
  const computed = calc.buildSeasonStandings(season, {
    courseParFor: (r) => r.courseInfo?.par ?? 72,
  });
  const stored = await get('final_standings?select=*&season_id=eq.golf-2026&order=rank.asc');
  console.log('\nSeason standings — engine vs DB final_standings');
  console.log(['player'.padEnd(9), 'engine', 'db', ''].join('  '));
  for (const p of computed) {
    const s = (stored || []).find((x) => x.player_id === p.playerId);
    const db = s ? Number(s.total_points) : null;
    const flag = db == null ? '(no db row)' : (Math.abs(db - p.totalPoints) < 1e-9 ? '✓' : '✗ differs (expected until 0009 is replayed)');
    console.log([ (p.name || p.playerId).padEnd(9), String(p.totalPoints).padStart(6), String(db ?? '—').padStart(5), flag ].join('  '));
  }

  if (mismatches) {
    console.error(`\n${mismatches} running-handicap mismatch(es) vs the sheet.`);
    process.exit(1);
  }
  console.log('\nRunning handicaps match the spreadsheet.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
