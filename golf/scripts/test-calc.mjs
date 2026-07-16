#!/usr/bin/env node
// test-calc.mjs — plain-Node asserts for golf/lib/golf-calc.js.
// Run: node golf/scripts/test-calc.mjs
//
// The 2026 fixture reproduces the league spreadsheet
// (MMP_Touring_Series_v3.xlsx, Running_Handicap_2026 tab) so the
// engine is provably formula-compatible with the sheet it replaces.

import assert from 'node:assert/strict';
import {
  GOLF_POINTS,
  netOf,
  penaltyFor,
  handicapIndex,
  runningHandicaps,
  computeRoundPoints,
  buildSeasonStandings,
} from '../lib/golf-calc.js';

let passed = 0;
function check(label, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${label}`);
}

// ── penaltyFor ──────────────────────────────────────────────────────
console.log('penaltyFor');
const P = (gross, handicap, holesPlayed = 18, coursePar = 72) =>
  penaltyFor({ attended: true, gross, handicap, holesPlayed }, coursePar);

check('no penalty at exactly 5 over handicap par', () => {
  assert.equal(P(99, 22), 0);        // handicap par 94, diff 5
});
check('−1 at 6 over, −2 at 11 over, −4 at 21 over (limitless bands)', () => {
  assert.equal(P(100, 22), 1);
  assert.equal(P(105, 22), 2);
  assert.equal(P(115, 22), 4);
});
check('9-hole rounds use par/2 and handicap/2', () => {
  assert.equal(P(46, 10, 9), 0);     // 36 + 5 = 41 handicap par, diff 5
  assert.equal(P(47, 10, 9), 1);
});
check('non-72 course par shifts the bands', () => {
  assert.equal(P(100, 22, 18, 73), 0);   // handicap par 95, diff 5
  assert.equal(P(101, 22, 18, 73), 1);
});
check('no penalty without gross/handicap or when DNP', () => {
  assert.equal(penaltyFor({ attended: false, gross: 130, handicap: 10, holesPlayed: 18 }), 0);
  assert.equal(P(130, null), 0);
});

// ── handicapIndex ───────────────────────────────────────────────────
console.log('handicapIndex');
const KEDRON = { slope: 128, rating: 72.4 };

check('matches the sheet formula (Junior, 110 at Kedron Dells → 33.19)', () => {
  const idx = handicapIndex({ gross: 110, holesPlayed: 18 }, KEDRON);
  assert.ok(Math.abs(idx - 33.19375) < 1e-9);
});
check('9-hole gross is doubled before the formula', () => {
  const nine = handicapIndex({ gross: 55, holesPlayed: 9 }, KEDRON);
  const full = handicapIndex({ gross: 110, holesPlayed: 18 }, KEDRON);
  assert.equal(nine, full);
});
check('null when course slope/rating or gross is missing', () => {
  assert.equal(handicapIndex({ gross: 100, holesPlayed: 18 }, null), null);
  assert.equal(handicapIndex({ gross: null, holesPlayed: 18 }, KEDRON), null);
});

// ── computeRoundPoints: low round + tie split ──────────────────────
console.log('computeRoundPoints');
const mk = (playerId, gross, handicap, extra = {}) => ({
  playerId, name: playerId, attended: true, holesPlayed: 18,
  gross, handicap, pars: 0, birdies: 0, eagles: 0, albatrosses: 0, holeInOnes: 0,
  ...extra,
});

check('low round goes to lowest NET, not lowest gross', () => {
  const results = computeRoundPoints({ results: [
    mk('a', 90, 10),   // net 80
    mk('b', 95, 20),   // net 75 ← low
  ] });
  assert.equal(results.find((r) => r.playerId === 'b').lowRound, true);
  assert.equal(results.find((r) => r.playerId === 'a').lowRound, false);
});
check('two-way tie splits the 3 points 1.5 / 1.5', () => {
  const results = computeRoundPoints({ results: [
    mk('a', 90, 15),   // net 75
    mk('b', 95, 20),   // net 75
    mk('c', 96, 20),   // net 76
  ] });
  const a = results.find((r) => r.playerId === 'a');
  const b = results.find((r) => r.playerId === 'b');
  assert.equal(a.lowRoundPts, 1.5);
  assert.equal(b.lowRoundPts, 1.5);
  assert.equal(a.points, GOLF_POINTS.attendance + 1.5);
});
check('9-hole players are not eligible for low round', () => {
  const results = computeRoundPoints({ results: [
    mk('a', 40, 10, { holesPlayed: 9 }),   // net 30 but only 9 holes
    mk('b', 95, 20),                        // net 75 ← low
  ] });
  assert.equal(results.find((r) => r.playerId === 'b').lowRound, true);
});
check('points = attendance + counts + low round − penalty', () => {
  const [r] = computeRoundPoints({ results: [
    mk('a', 100, 22, { pars: 4, birdies: 1 }),   // penalty 1 (diff 6)
  ] });
  assert.equal(r.points, 5 + 4 * 1 + 1 * 3 + 3 - 1);   // sole 18-holer → low round
});

// ── buildSeasonStandings: best-10 cap ──────────────────────────────
console.log('buildSeasonStandings');
check('only the best 10 rounds count toward the total', () => {
  // 12 rounds: solo player (always low round), gross 87 hcp 10 → diff 5,
  // no penalty. Points per round: 5 + 3 + i pars.
  const rounds = Array.from({ length: 12 }, (_, i) => ({
    id: `r${i}`, played: true,
    results: [mk('a', 87, 10, { pars: i })],
  }));
  const [row] = buildSeasonStandings({ rounds });
  // per-round points are 8+i for i=0..11 → best 10 are i=2..11 → sum = 10*8 + (2+..+11)
  assert.equal(row.totalPoints, 10 * 8 + 65);
  assert.equal(row.droppedRounds, 2);
});
check('10 or fewer rounds → nothing dropped', () => {
  const rounds = Array.from({ length: 3 }, (_, i) => ({
    id: `r${i}`, played: true, results: [mk('a', 87, 10)],
  }));
  const [row] = buildSeasonStandings({ rounds });
  assert.equal(row.droppedRounds, 0);
  assert.equal(row.totalPoints, 3 * 8);
});

// ── 2026 spreadsheet parity ────────────────────────────────────────
console.log('2026 spreadsheet parity (Running_Handicap_2026)');

const COURSES = {
  'kedron-dells': { slope: 128, rating: 72.4 },
  'silver-lakes': { slope: 129, rating: 71.2 },
  'westview':     { slope: 137, rating: 71.3 },
  'shawneeki':    { slope: 128, rating: 70.5 },
};

// 2026 starting handicaps (players.json / sheet column S).
const STARTING = new Map(Object.entries({
  jas: 18, junior: 19, harish: 20, kerwin: 22, seymour: 23, tony: 26,
  lorenzo: 34, neave: 36, chris: 39, gary: 44, wayne: 56,
}));

// Gross scores per event, straight from the sheet's SCORES block.
// null = did not play (the sheet back-solves a synthetic score; the
// engine holds the player at their starting handicap instead).
const EVENTS = [
  { course: 'kedron-dells', gross: { junior: 110, tony: 107, seymour: 101, harish: 99, kerwin: 102, jas: 97, lorenzo: 113, neave: 112 } },
  { course: 'silver-lakes', gross: { junior: 92, tony: 99, seymour: 97, harish: 93, kerwin: 93, jas: 101, gary: 119, lorenzo: 106, neave: 108 } },
  { course: 'westview',     gross: { junior: 92, tony: 103, seymour: 100, harish: 88, kerwin: 97, jas: 92, lorenzo: 111, neave: 110 } },
  { course: 'shawneeki',    gross: { junior: 96, tony: 125, seymour: 100, harish: 102, kerwin: 108, jas: 95, gary: 118, lorenzo: 110, neave: 110, chris: 112 } },
  { course: 'kedron-dells', gross: { junior: 94, tony: 100, seymour: 102, harish: 103, kerwin: 96, jas: 98, gary: 118, lorenzo: 105, neave: 110, chris: 115 } },
];

const rounds = EVENTS.map((e, i) => ({
  id: `2026-e${i + 1}`,
  played: true,
  course: COURSES[e.course],
  results: [...STARTING.keys()].map((pid) => ({
    playerId: pid,
    attended: e.gross[pid] != null,
    holesPlayed: e.gross[pid] != null ? 18 : null,
    gross: e.gross[pid] ?? null,
  })),
}));

const running = runningHandicaps({ rounds, startingHandicaps: STARTING });

// Sheet column AF (Running Handicap) after the 5th event. Wayne sat out
// every event: the sheet's synthetic integer scores drift him to 55,
// the engine holds him at exactly his starting 56 — intended behavior.
const EXPECTED_RUNNING = {
  junior: 22, tony: 30, seymour: 24, harish: 22, kerwin: 24, jas: 21,
  gary: 43, lorenzo: 33, neave: 34, chris: 38, wayne: 56,
};
check('running handicaps after 5 events match the sheet', () => {
  for (const [pid, expected] of Object.entries(EXPECTED_RUNNING)) {
    assert.equal(running.get(pid).current, expected, `${pid}: got ${running.get(pid).current}, sheet says ${expected}`);
  }
});

// Sheet column AG (2026 HANDICAP = next season's starting, indexes only).
check('season-end handicaps match the sheet (spot checks)', () => {
  assert.equal(running.get('junior').seasonEnd, 22);
  assert.equal(running.get('tony').seasonEnd, 31);
  assert.equal(running.get('jas').seasonEnd, 22);
});

check('handicapBefore chains: event 1 uses the starting handicap', () => {
  const junior = running.get('junior');
  assert.equal(junior.events[0].handicapBefore, 19);
  assert.equal(junior.events[1].handicapBefore, junior.events[0].handicapAfter);
});

check('netOf', () => {
  assert.equal(netOf({ gross: 100, handicap: 22 }), 78);
  assert.equal(netOf({ gross: 100, handicap: null }), null);
});

console.log(`\nAll ${passed} checks passed.`);
