#!/usr/bin/env node
// test-poker.mjs — plain-Node asserts for golf/lib/poker-calc.js and the
// row/payload shaping in golf/lib/poker-shape.js, checked against the
// real data/poker.json (every night since 2022).
// Run: node golf/scripts/test-poker.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  seasonForDate, monthYearOf, eventIdFor, eventSortKey, scoreNight, gameIssue,
  describeGame, deriveSeason, eventTotalOf,
} from '../lib/poker-calc.js';
import { shapePokerForSpa, pokerRowsFromJson, buildEventPayload } from '../lib/poker-shape.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const poker = load('poker.json');
const roster = load('players.json').players;

let passed = 0;
function check(label, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${label}`);
}
const n = (v) => v || 0;   // the spreadsheet mixes blank cells and zeros

console.log('seasons, months, ids');
check('Nov/Dec open a season, Jan–Apr close it', () => {
  assert.deepEqual(seasonForDate('2026-11-15'), { id: '2026-27', label: '2026–27' });
  assert.deepEqual(seasonForDate('2026-12-31'), { id: '2026-27', label: '2026–27' });
  assert.deepEqual(seasonForDate('2027-01-09'), { id: '2026-27', label: '2026–27' });
  assert.deepEqual(seasonForDate('2027-04-30'), { id: '2026-27', label: '2026–27' });
  assert.deepEqual(seasonForDate('1999-12-01'), { id: '1999-00', label: '1999–00' });
  assert.equal(seasonForDate(''), null);
});
check('month/year and event ids match the spreadsheet-era ids', () => {
  assert.deepEqual(monthYearOf('2027-03-14'), { month: 'Mar', year: 2027 });
  assert.equal(eventIdFor('2026-11-15'), '2026-27-nov');
  assert.equal(eventIdFor('2027-01-09'), '2026-27-jan');
  assert.equal(eventIdFor('2026-11-29', ['2026-27-nov']), '2026-27-nov-2');
  assert.equal(eventIdFor('2026-11-29', ['2026-27-nov', '2026-27-nov-2']), '2026-27-nov-3');
});
check('dated and month-only nights sort together', () => {
  const keys = [{ month: 'Jan', year: 2027 }, { date: '2026-11-15', month: 'Nov', year: 2026 }, { month: 'Dec', year: 2026 }]
    .map(eventSortKey).sort();
  assert.deepEqual(keys, ['2026-11-15', '2026-12-15', '2027-01-15']);
});

console.log('scoring a night');
const A = ['a', 'b', 'c', 'd'];
check('win 10, runner-up 5, 2 for showing up', () => {
  const rows = scoreNight({ attendees: A, games: [{ winners: ['a'], runnersUp: ['b'] }] });
  assert.deepEqual(rows.get('a'), { appearance: 2, win: 10, tie: null, runnerUp: null });
  assert.deepEqual(rows.get('b'), { appearance: 2, win: null, tie: null, runnerUp: 5 });
  assert.deepEqual(rows.get('c'), { appearance: 2, win: null, tie: null, runnerUp: null });
});
check('a tied win splits win + runner-up: 7.5 each, 5 each three ways', () => {
  const two = scoreNight({ attendees: A, games: [{ winners: ['a', 'b'], runnersUp: [] }] });
  assert.equal(two.get('a').tie, 7.5);
  assert.equal(two.get('b').tie, 7.5);
  assert.equal(two.get('a').win, null);
  const three = scoreNight({ attendees: A, games: [{ winners: ['a', 'b', 'c'], runnersUp: ['d'] }] });
  assert.equal(three.get('c').tie, 5);
  assert.equal(three.get('d').runnerUp, null);   // no runner-up behind a tie
});
check('a tied runner-up splits the 5', () => {
  const rows = scoreNight({ attendees: A, games: [{ winners: ['a'], runnersUp: ['b', 'c'] }] });
  assert.equal(rows.get('a').win, 10);
  assert.equal(rows.get('b').tie, 2.5);
  assert.equal(rows.get('c').tie, 2.5);
});
check('March 2023 reproduces from its three games', () => {
  // Kerwin won one (Neave & Harish tied behind him), Neave & Harish tied
  // one, and Neave, Harish & Seymour tied the last.
  const rows = scoreNight({
    attendees: ['neave', 'kerwin', 'chris', 'tony', 'seymour', 'harish', 'dee'],
    games: [
      { winners: ['kerwin'], runnersUp: ['neave', 'harish'] },
      { winners: ['neave', 'harish'], runnersUp: [] },
      { winners: ['neave', 'harish', 'seymour'], runnersUp: [] },
    ],
  });
  const mar = poker.seasons.find((s) => s.id === '2022-23').events.find((e) => e.id === '2022-23-mar');
  const idOf = (name) => (name === 'Darren' ? 'dee' : name.toLowerCase());
  for (const r of mar.results.filter((x) => n(x.appearance))) {
    const got = rows.get(idOf(r.name));
    assert.equal(eventTotalOf(got), r.eventTotal, r.name);
    assert.equal(n(got.tie), n(r.tie), `${r.name} tie`);
  }
});
check('every recorded night is whole games: 15 pts each, on top of appearances', () => {
  for (const s of poker.seasons) for (const e of s.events.filter((x) => x.played)) {
    const games = e.results.reduce((t, r) => t + n(r.win) + n(r.tie) + n(r.runnerUp), 0);
    assert.equal(games % 15, 0, e.id);
  }
});
check('incomplete games are flagged', () => {
  assert.equal(gameIssue({ winners: [], runnersUp: [] }), 'Pick who won.');
  assert.equal(gameIssue({ winners: ['a'], runnersUp: [] }), 'Pick the runner-up.');
  assert.equal(gameIssue({ winners: ['a'], runnersUp: ['b'] }), null);
  assert.equal(gameIssue({ winners: ['a', 'b'], runnersUp: [] }), null);
});
check('games read back in plain words', () => {
  const name = (id) => id.toUpperCase();
  assert.equal(describeGame({ winners: ['a'], runnersUp: ['b'] }, name), 'A won · B runner-up');
  assert.equal(describeGame({ winners: ['a', 'b'], runnersUp: [] }, name), 'A & B tied');
  assert.equal(describeGame({ winners: ['a'], runnersUp: ['b', 'c'] }, name), 'A won · B & C tied for runner-up');
  assert.equal(describeGame({ winners: [], runnersUp: [] }, name), 'Not entered yet');
});

console.log('deriving a season (vs. the spreadsheet\'s own sums)');
// The first two spreadsheets ranked each night by hand, unevenly (three
// players level on zero ranked 9, 10, 11; a 6, 6, 7 run). Derived ranks
// are always "1, 1, 3", so those nights' typed ranks aren't compared —
// their totals and the season's final standings still are.
const HAND_RANKED = new Set(['2022-23', '2023-24']);
for (const season of poker.seasons.filter((s) => s.events.some((e) => e.played))) {
  check(`${season.id}: event totals, running totals, ranks, standings`, () => {
    const raw = season.events.map((e) => ({
      ...e,
      results: e.results.map(({ name, appearance, win, tie, runnerUp }) => ({ name, appearance, win, tie, runnerUp })),
    }));
    const derived = deriveSeason(raw);
    for (const want of season.events.filter((e) => e.played)) {
      const got = derived.events.find((e) => e.id === want.id);
      assert.equal(got.results.length, want.results.length, `${want.id} row count`);
      for (const w of want.results) {
        const g = got.results.find((r) => r.name === w.name);
        assert.ok(g, `${want.id} ${w.name}`);
        assert.equal(g.eventTotal, w.eventTotal, `${want.id} ${w.name} eventTotal`);
        assert.equal(g.ytdTotal, w.ytdTotal, `${want.id} ${w.name} ytdTotal`);
        if (w.rank != null && !HAND_RANKED.has(season.id)) assert.equal(g.rank, w.rank, `${want.id} ${w.name} rank`);
      }
      for (const k of ['appearance', 'win', 'tie', 'runnerUp', 'eventTotal', 'ytdTotal']) {
        assert.equal(got.totals[k], n(want.totals?.[k]), `${want.id} totals.${k}`);
      }
    }
    assert.deepEqual(derived.finalStandings, season.finalStandings);
  });
}

console.log('Supabase rows ⇄ leaderboard shape');
check('poker.json → rows → shape is the same leaderboard', () => {
  const { seasons, events, results } = pokerRowsFromJson(poker, roster);
  const nested = seasons.map((s) => ({
    ...s,
    events: events.filter((e) => e.season_id === s.id)
      .map((e) => ({ ...e, results: results.filter((r) => r.event_id === e.id) })),
  }));
  const shaped = shapePokerForSpa(nested);
  assert.deepEqual(shaped.seasons.map((s) => s.id), poker.seasons.map((s) => s.id));   // newest first
  for (const want of poker.seasons) {
    const got = shaped.seasons.find((s) => s.id === want.id);
    assert.equal(got.label, want.label);
    assert.deepEqual(got.skippedMonths, want.skippedMonths);
    assert.deepEqual(got.finalStandings, want.finalStandings);
    assert.deepEqual(got.events.map((e) => e.id), want.events.map((e) => e.id));
    for (const we of want.events) {
      const ge = got.events.find((e) => e.id === we.id);
      assert.equal(ge.host, we.host);
      assert.equal(ge.played, we.played);
      assert.equal(ge.month, we.month);
      assert.equal(ge.year, we.year);
      assert.equal(ge.date ?? null, we.date ?? null);
      assert.equal(ge.time ?? null, we.time ?? null);
      for (const w of we.results) {
        const g = ge.results.find((r) => r.name === w.name);
        assert.equal(g.ytdTotal, w.ytdTotal, `${we.id} ${w.name}`);
      }
    }
  }
});
check('Darren\'s old rows land on Dee\'s player id, name kept as recorded', () => {
  const { results } = pokerRowsFromJson(poker, roster);
  const row = results.find((r) => r.event_id === '2025-26-dec' && r.name === 'Darren');
  assert.equal(row.player_id, 'dee');
});
check('an unknown name stops the seed', () => {
  const bad = { seasons: [{ id: '2030-31', label: 'x', events: [{ id: 'e', month: 'Nov', year: 2030, played: true, results: [{ name: 'Nobody' }] }] }] };
  assert.throws(() => pokerRowsFromJson(bad, roster), /Nobody/);
});

console.log('entry payload');
const pokerPlayers = roster.filter((p) => p.sports.includes('poker'));
check('planning a night sends no results', () => {
  const p = buildEventPayload({
    eventId: null, takenIds: ['2026-27-nov'], date: '2026-12-12', time: '19:00', host: 'Neave',
    played: false, attendees: [], games: [], players: pokerPlayers,
  });
  assert.equal(p.event.id, '2026-27-dec');
  assert.equal(p.event.season_id, 'poker-2026-27');
  assert.deepEqual(p.season, { id: 'poker-2026-27', label: '2026–27' });
  assert.equal(p.event.month, 'Dec');
  assert.equal(p.event.year, 2026);
  assert.equal(p.event.played, false);
  assert.equal(p.event.games, null);
  assert.deepEqual(p.results, []);
});
check('a played night sends a row for the whole crew, absentees on zero', () => {
  const p = buildEventPayload({
    eventId: '2026-27-nov', takenIds: ['2026-27-nov'], date: '2026-11-15', time: '16:00', host: 'Dee',
    played: true, attendees: ['dee', 'neave', 'harish'],
    games: [
      { winners: ['neave'], runnersUp: ['dee'] },
      { winners: ['neave', 'harish'], runnersUp: [] },
      { winners: ['harish'], runnersUp: ['dee', 'neave'] },
    ],
    players: pokerPlayers,
  });
  assert.equal(p.event.id, '2026-27-nov');   // editing keeps the id
  assert.equal(p.results.length, pokerPlayers.length);
  const row = (id) => p.results.find((r) => r.player_id === id);
  assert.deepEqual(row('neave'), { player_id: 'neave', name: 'Neave', appearance: 2, win: 10, tie: 10, runner_up: null });
  assert.deepEqual(row('dee'), { player_id: 'dee', name: 'Dee', appearance: 2, win: null, tie: 2.5, runner_up: 5 });
  assert.deepEqual(row('tony'), { player_id: 'tony', name: 'Tony', appearance: 0, win: null, tie: null, runner_up: null });
  assert.equal(p.event.games.length, 3);
});

console.log(`\n${passed} checks passed.`);
