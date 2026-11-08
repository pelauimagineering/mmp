#!/usr/bin/env node
// test-champions.mjs — plain-Node asserts for golf/lib/champions.js
// against the real data/champions.json and data/poker.json.
// Run: node golf/scripts/test-champions.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCupHistory, titlesBy, championsOf, cupYearOf, isSeasonComplete } from '../lib/champions.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const record = load('champions.json');
const poker = load('poker.json');

let passed = 0;
function check(label, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${label}`);
}

const played = (date) => ({ date, played: true });
const golfSeason = (id, rounds, champ) => ({
  id, label: `${id} Links Cup`, rounds,
  finalStandings: champ ? [{ name: champ, rank: 1 }, { name: 'Other', rank: 2 }] : [],
});
const TODAY = '2026-11-08';

console.log('record');
check('18 cup years, 2008-09 through 2025-26', () => {
  assert.equal(record.cupYears.length, 18);
  assert.equal(record.cupYears[0].id, '2008-09');
  assert.equal(record.cupYears.at(-1).id, '2025-26');
});
check('every champion is on the roster', () => {
  const roster = new Set(load('players.json').players.map((p) => p.name));
  for (const y of record.cupYears) {
    for (const n of [...y.golf, ...y.poker]) assert.ok(roster.has(n), `${y.id}: ${n}`);
  }
});

console.log('cupYearOf / isSeasonComplete');
check('golf "2026" and poker "2026-27" share a cup year', () => {
  assert.deepEqual(cupYearOf('golf', { id: '2026' }), { id: '2026-27', label: '2026–27' });
  assert.deepEqual(cupYearOf('poker', { id: '2026-27' }), { id: '2026-27', label: '2026–27' });
});
check('golf season with a round still ahead is not complete', () => {
  const s = golfSeason('2026', [played('2026-05-03'), { date: '2026-11-20', played: false }]);
  assert.equal(isSeasonComplete('golf', s, TODAY), false);
});
check('a past round that never got played does not hold the season open', () => {
  const s = golfSeason('2026', [played('2026-05-03'), { date: '2026-10-04', played: false }]);
  assert.equal(isSeasonComplete('golf', s, TODAY), true);
});

console.log('buildCupHistory');
const golfDone = { seasons: [golfSeason('2026', [played('2026-05-03'), played('2026-10-04')], 'Kerwin')] };
const history = buildCupHistory({ record, golf: golfDone, poker, todayISO: TODAY });
check('the plates win over poker.json for 2023-24', () => {
  assert.deepEqual(championsOf(history, 'poker', { id: '2023-24' }), ['Kerwin']);
});
check('shared 2022-23 poker cup keeps both names', () => {
  assert.deepEqual(championsOf(history, 'poker', { id: '2022-23' }), ['Neave', 'Harish']);
});
check('a complete 2026 golf season becomes cup year 2026-27; poker still in progress', () => {
  const y = history.at(-1);
  assert.equal(y.id, '2026-27');
  assert.deepEqual(y.golf.names, ['Kerwin']);
  assert.deepEqual(y.poker, { names: [], note: 'In progress' });
});
check('an in-progress golf leader is not a champion', () => {
  const live = { seasons: [golfSeason('2026', [played('2026-05-03'), { date: '2026-11-20', played: false }], 'Kerwin')] };
  const h = buildCupHistory({ record, golf: live, poker, todayISO: TODAY });
  assert.equal(championsOf(h, 'golf', { id: '2026' }), null);
  assert.equal(h.at(-1).golf.note, 'In progress');
});
check('no-cup years carry their note', () => {
  assert.equal(history.find((y) => y.id === '2019-20').poker.note, 'Cancelled — COVID-19');
  assert.equal(history.find((y) => y.id === '2018-19').poker.note, 'Not awarded');
});

console.log('titlesBy');
const base = buildCupHistory({ record, golf: { seasons: [] }, poker, todayISO: TODAY });
check('golf cups from the plates', () => {
  assert.deepEqual(titlesBy(base, 'golf').ranked,
    [['Junior', 7], ['Kerwin', 5], ['Jas', 3], ['Seymour', 1], ['Harish', 1], ['Tony', 1]]);
});
check('poker cups from the plates, shared cup counted for both', () => {
  assert.deepEqual(titlesBy(base, 'poker').ranked,
    [['Harish', 5], ['Junior', 4], ['Chris', 2], ['Tony', 2], ['Kerwin', 1], ['Neave', 1], ['Darren', 1], ['Seymour', 1]]);
});
check('lastWin is the cup-year label', () => {
  assert.equal(titlesBy(base, 'golf').lastWin.get('Junior'), '2025–26');
  assert.equal(titlesBy(base, 'poker').lastWin.get('Tony'), '2010–11');
});

console.log(`\n${passed} checks passed`);
