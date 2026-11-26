// poker-calc.js — the MMP poker points engine.
//
// A game night is a handful of games (three, as a rule). For each game:
//   - one winner            → 10 pts (Win)
//   - one runner-up         →  5 pts (Runner-up)
//   - a tie for the win     → the 15 pts (win + runner-up) split evenly
//                             between the tied players (Tie); no runner-up
//   - a tie for runner-up   → the 5 pts split evenly (Tie)
// Everyone who shows up gets 2 pts (Appearance).
//
// These rules reproduce every night in data/poker.json back to 2022 —
// scripts/test-poker.mjs checks that. Pure functions, no DOM: shared by
// the entry wizard (poker-entry.html), the Supabase adapter
// (poker-data.js) and the tests.

import { cupYearFromStart } from './champions.js';

export const POINTS = { appearance: 2, win: 10, runnerUp: 5 };
export const DEFAULT_GAMES = 3;

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The poker season runs Nov–Apr and is named for both years it spans —
// the same id as the cup year it decides (champions.js).
// A date from July on opens a season; one before July closes it.
// "2026-11-15" → { id: "2026-27", label: "2026–27" }
export function seasonForDate(iso) {
  const [y, m] = String(iso || '').split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return cupYearFromStart(m >= 7 ? y : y - 1);
}

// "2026-11-15" → { month: "Nov", year: 2026 }
export function monthYearOf(iso) {
  const [y, m] = String(iso || '').split('-').map(Number);
  if (!Number.isFinite(y) || !MONTHS[m - 1]) return null;
  return { month: MONTHS[m - 1], year: y };
}

// Event ids follow the spreadsheet era: "<season>-<mon>" ("2026-27-nov").
// A second night in the same month gets "-2", "-3", …
export function eventIdFor(iso, takenIds = []) {
  const season = seasonForDate(iso);
  const my = monthYearOf(iso);
  if (!season || !my) return null;
  const base = `${season.id}-${my.month.toLowerCase()}`;
  const taken = new Set(takenIds);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// Chronological sort key. Nights from the spreadsheet era only know their
// month, so they sort as mid-month.
export function eventSortKey(e) {
  if (e?.date) return String(e.date);
  const m = MONTHS.indexOf(e?.month) + 1;
  return `${e?.year ?? 0}-${String(m).padStart(2, '0')}-15`;
}

export const blankGame = () => ({ winners: [], runnersUp: [] });

// What's missing from one game, or null when it can be scored.
export function gameIssue(game) {
  const w = game?.winners?.length || 0;
  const r = game?.runnersUp?.length || 0;
  if (!w) return 'Pick who won.';
  if (w === 1 && !r) return 'Pick the runner-up.';
  return null;
}

// "Neave won · Harish runner-up", "Neave & Harish tied", …
export function describeGame(game, nameOf = (id) => id) {
  const w = (game?.winners || []).map(nameOf);
  const r = (game?.runnersUp || []).map(nameOf);
  if (!w.length) return 'Not entered yet';
  if (w.length > 1) return `${w.join(' & ')} tied`;
  if (!r.length) return `${w[0]} won`;
  return `${w[0]} won · ${r.join(' & ')} ${r.length > 1 ? 'tied for runner-up' : 'runner-up'}`;
}

// A night's raw facts → one row of point columns per attendee.
// Zero columns stay null, like the blank cells of the old spreadsheet.
// → Map(playerId → { appearance, win, tie, runnerUp })
export function scoreNight({ attendees = [], games = [] }) {
  const rows = new Map(attendees.map((id) => [id, { appearance: POINTS.appearance, win: 0, tie: 0, runnerUp: 0 }]));
  const add = (id, key, pts) => { const row = rows.get(id); if (row) row[key] += pts; };
  for (const g of games) {
    const winners = g?.winners || [];
    const runnersUp = g?.runnersUp || [];
    if (winners.length === 1) {
      add(winners[0], 'win', POINTS.win);
      if (runnersUp.length === 1) add(runnersUp[0], 'runnerUp', POINTS.runnerUp);
      else for (const id of runnersUp) add(id, 'tie', POINTS.runnerUp / runnersUp.length);
    } else {
      for (const id of winners) add(id, 'tie', (POINTS.win + POINTS.runnerUp) / winners.length);
    }
  }
  for (const row of rows.values()) {
    for (const key of ['win', 'tie', 'runnerUp']) if (!row[key]) row[key] = null;
  }
  return rows;
}

export const eventTotalOf = (r) =>
  (r.appearance || 0) + (r.win || 0) + (r.tie || 0) + (r.runnerUp || 0);

// Competition ranking ("1, 1, 3"): mutates rows already sorted best-first.
function rankInPlace(sorted, valueOf) {
  let rank = 0;
  let prev = null;
  sorted.forEach((row, i) => {
    const v = valueOf(row);
    if (v !== prev) { rank = i + 1; prev = v; }
    row.rank = rank;
  });
}

// Derive everything the leaderboard reads but nobody types: event totals,
// running season totals, the rank after each night, the totals row and
// the final standings.
//
// `events`: one season's events, each { played, results: [{ playerId?,
// name, appearance, win, tie, runnerUp }], … }. Like the spreadsheet,
// every played night lists every player seen that season — absentees
// carry their running total on a zero row.
// → { events (chronological, results/totals filled in), finalStandings }
export function deriveSeason(events) {
  const ordered = [...(events || [])].sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)));
  const keyOf = (r) => r.playerId || r.name;

  const roster = new Map();   // key → { playerId, name }, first-seen order
  for (const e of ordered) {
    if (!e.played) continue;
    for (const r of e.results || []) {
      if (!roster.has(keyOf(r))) roster.set(keyOf(r), { playerId: r.playerId ?? null, name: r.name });
    }
  }

  const ytd = new Map();
  let lastPlayed = null;
  const out = ordered.map((e) => {
    if (!e.played) return { ...e, results: [], totals: e.totals ?? null };
    const byKey = new Map((e.results || []).map((r) => [keyOf(r), r]));
    const results = [...roster.entries()].map(([key, who]) => {
      const r = byKey.get(key) || {};
      const row = {
        playerId: who.playerId,
        name: r.name || who.name,
        appearance: r.appearance ?? 0,
        win: r.win ?? null,
        tie: r.tie ?? null,
        runnerUp: r.runnerUp ?? null,
      };
      row.eventTotal = eventTotalOf(row);
      row.ytdTotal = (ytd.get(key) || 0) + row.eventTotal;
      ytd.set(key, row.ytdTotal);
      return row;
    });
    rankInPlace([...results].sort((a, b) => b.ytdTotal - a.ytdTotal), (r) => r.ytdTotal);
    const sum = (k) => results.reduce((s, r) => s + (r[k] || 0), 0);
    const totals = {
      appearance: sum('appearance'), win: sum('win'), tie: sum('tie'), runnerUp: sum('runnerUp'),
      eventTotal: sum('eventTotal'), ytdTotal: sum('ytdTotal'),
    };
    lastPlayed = { ...e, results, totals };
    return lastPlayed;
  });

  const finalStandings = lastPlayed
    ? [...lastPlayed.results]
        .sort((a, b) => b.ytdTotal - a.ytdTotal)
        .map((r) => ({ rank: r.rank, name: r.name, total: r.ytdTotal }))
    : [];

  return { events: out, finalStandings };
}
