// poker-shape.js — translations between the three forms poker data takes:
//
//   Supabase rows  →  the { sport, seasons[] } shape of data/poker.json
//                     that the leaderboard renderers read   (shapePokerForSpa)
//   data/poker.json →  Supabase rows, for the one-time seed (pokerRowsFromJson)
//   the wizard      →  the enter_poker_event() RPC payload  (buildEventPayload)
//
// Pure functions with no browser or network dependencies, so the seed
// script and scripts/test-poker.mjs can import them from Node.

import { deriveSeason, eventIdFor, monthYearOf, scoreNight, seasonForDate } from './poker-calc.js';

const num = (v) => (v == null ? null : Number(v));

// `seasonRows`: seasons (sport = 'poker') with their poker_events nested
// as `events`, each with its poker_results nested as `results`.
export function shapePokerForSpa(seasonRows) {
  const seasons = (seasonRows || []).map((s) => {
    const events = (s.events || []).map((e) => ({
      id: e.id,
      month: e.month,
      year: e.year,
      ...(e.date ? { date: e.date } : {}),
      ...(e.time ? { time: e.time } : {}),
      host: e.host ?? null,
      played: !!e.played,
      // Game-by-game record (who won, who was runner-up). Null for nights
      // that came from the old spreadsheet, which only kept the points.
      games: e.games ?? null,
      results: (e.results || []).map((r) => ({
        playerId: r.player_id,
        name: r.name,
        appearance: num(r.appearance),
        win: num(r.win),
        tie: num(r.tie),
        runnerUp: num(r.runner_up),
      })),
    }));
    const derived = deriveSeason(events);
    return {
      // Strip the "poker-" prefix used in the DB so route paths and ids
      // match the legacy JSON ("2026-27").
      id: String(s.id).replace(/^poker-/, ''),
      label: s.label,
      events: derived.events,
      skippedMonths: s.skipped_months || [],
      finalStandings: derived.finalStandings,
    };
  });
  seasons.sort((a, b) => b.id.localeCompare(a.id));   // newest first, like poker.json
  return { sport: 'poker', source: 'supabase', seasons };
}

// Recorded names → roster ids, following aliases (Darren → dee).
export function playerIdResolver(players) {
  const map = new Map();
  for (const p of players || []) {
    map.set(p.name, p.id);
    for (const alias of p.aliases || []) map.set(alias, p.id);
  }
  return (name) => map.get(name) ?? null;
}

// → { seasons, events, results } row arrays ready to upsert.
// Names stay as recorded (the apps rewrite them to current names at
// load); only the player id follows the roster. Throws on a name the
// roster doesn't know, so a typo can't silently drop someone's points.
export function pokerRowsFromJson(poker, players) {
  const idOf = playerIdResolver(players);
  const seasons = [];
  const events = [];
  const results = [];
  for (const s of poker?.seasons || []) {
    const seasonId = `poker-${s.id}`;
    seasons.push({ id: seasonId, sport: 'poker', label: s.label, skipped_months: s.skippedMonths || [] });
    for (const e of s.events || []) {
      events.push({
        id: e.id,
        season_id: seasonId,
        month: e.month,
        year: e.year,
        date: e.date ?? null,
        time: e.time ?? null,
        host: e.host ?? null,
        played: !!e.played,
        games: e.games ?? null,
      });
      for (const r of e.played ? e.results || [] : []) {
        const playerId = r.playerId || idOf(r.name);
        if (!playerId) throw new Error(`Unknown player "${r.name}" in ${e.id} — add them (or an alias) to players.json.`);
        results.push({
          event_id: e.id,
          player_id: playerId,
          name: r.name,
          appearance: r.appearance ?? 0,
          win: r.win ?? null,
          tie: r.tie ?? null,
          runner_up: r.runnerUp ?? null,
        });
      }
    }
  }
  return { seasons, events, results };
}

// The wizard's state → the enter_poker_event() payload (snake_case, to
// match the SQL). A played night carries a row for every poker player on
// the roster — absentees on zero — the way the spreadsheet always listed
// the whole crew. `takenIds`: every existing event id, so a second night
// in one month gets its own id; `eventId` is kept when editing.
export function buildEventPayload({ eventId, takenIds = [], date, time, host, played, attendees = [], games = [], players = [] }) {
  const season = seasonForDate(date);
  const my = monthYearOf(date);
  if (!season || !my) throw new Error('A date is needed first.');
  const scored = played ? scoreNight({ attendees, games }) : new Map();
  return {
    season: { id: `poker-${season.id}`, label: season.label },
    event: {
      id: eventId || eventIdFor(date, takenIds),
      season_id: `poker-${season.id}`,
      date,
      month: my.month,
      year: my.year,
      time: time || null,
      host: (host || '').trim() || null,
      played: !!played,
      games: played ? games.map((g) => ({ winners: [...g.winners], runnersUp: [...g.runnersUp] })) : null,
    },
    results: played
      ? players.map((p) => {
          const row = scored.get(p.id) || { appearance: 0, win: null, tie: null, runnerUp: null };
          return { player_id: p.id, name: p.name, appearance: row.appearance, win: row.win, tie: row.tie, runner_up: row.runnerUp };
        })
      : [],
  };
}
