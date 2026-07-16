// golf-calc.js — the single source of truth for MMP golf math.
//
// Pure ES module with zero imports so it runs in the SPA, the
// score-entry form, and plain Node (tests / parity scripts) alike.
// The rules implemented here are documented in golf/docs/CALCULATIONS.md;
// the SQL mirror lives in golf-supabase/migrations/0009_scoring_fixes.sql.

// ── Point values ────────────────────────────────────────────────────

export const GOLF_POINTS = {
  attendance: 5,
  par: 1,
  birdie: 3,
  eagle: 10,
  albatross: 20,
  holeInOne: 25,
  lowRound: 3,
};

/** How many of a player's best rounds count toward the championship. */
export const BEST_ROUNDS_COUNT = 10;

// ── Per-round scoring ───────────────────────────────────────────────

/** Net score (gross − handicap), or null when either is missing. */
export function netOf(r) {
  return (Number.isFinite(r.gross) && Number.isFinite(r.handicap))
    ? r.gross - r.handicap
    : null;
}

/**
 * Penalty for shooting well over handicap par. Bands stack on the diff
 * (gross − par − handicap), where par/handicap scale linearly for
 * 9-hole rounds (par/2, handicap/2). −1 pt per 5 strokes over handicap
 * par, no upper bound: 6–10 → 1, 11–15 → 2, 16–20 → 3, and so on.
 */
export function penaltyFor(r, coursePar = 72) {
  if (!r.attended) return 0;
  if (!Number.isFinite(r.gross) || !Number.isFinite(r.handicap)) return 0;
  if (r.holesPlayed !== 9 && r.holesPlayed !== 18) return 0;
  const par = r.holesPlayed === 18 ? coursePar : coursePar / 2;
  const hcp = r.holesPlayed === 18 ? r.handicap : r.handicap / 2;
  const diff = r.gross - par - hcp;
  return diff > 5 ? Math.ceil((diff - 5) / 5) : 0;
}

/**
 * Annotate one round's results with { net, lowRound, lowRoundPts,
 * penalty, points }.
 *
 * Low round = lowest NET among players who attended, played 18 holes,
 * and have a handicap set. Ties SPLIT the 3 points evenly (1.5 each
 * for a two-way tie), matching the league's championship sheet.
 */
export function computeRoundPoints(round, coursePar = 72) {
  const results = (round.results || []).map((r) => ({ ...r, net: netOf(r) }));

  const eligible = results.filter(
    (r) => r.attended && r.holesPlayed === 18 && Number.isFinite(r.net)
  );
  let lowRoundIds = new Set();
  if (eligible.length) {
    const min = Math.min(...eligible.map((r) => r.net));
    lowRoundIds = new Set(
      eligible.filter((r) => r.net === min).map((r) => r.playerId || slugName(r.name))
    );
  }
  const lowRoundPts = lowRoundIds.size
    ? GOLF_POINTS.lowRound / lowRoundIds.size
    : 0;

  for (const r of results) {
    const id = r.playerId || slugName(r.name);
    r.lowRound = lowRoundIds.has(id);
    r.lowRoundPts = r.lowRound ? lowRoundPts : 0;
    if (!r.attended) { r.points = 0; r.penalty = 0; continue; }
    r.penalty = penaltyFor(r, coursePar);
    r.points =
      GOLF_POINTS.attendance
      + (r.pars || 0) * GOLF_POINTS.par
      + (r.birdies || 0) * GOLF_POINTS.birdie
      + (r.eagles || 0) * GOLF_POINTS.eagle
      + (r.albatrosses || 0) * GOLF_POINTS.albatross
      + (r.holeInOnes || 0) * GOLF_POINTS.holeInOne
      + r.lowRoundPts
      - r.penalty;
  }
  return results;
}

// ── Handicap engine ─────────────────────────────────────────────────

/**
 * Handicap Index for one event:
 *   (gross18 − course rating) × 113 ÷ course slope
 * 9-hole rounds extrapolate to 18 via average strokes per hole
 * (gross × 2). Returns an unrounded float, or null when the score or
 * the course's slope/rating is missing.
 */
export function handicapIndex(result, course) {
  if (!course || !Number.isFinite(course.slope) || !Number.isFinite(course.rating)) return null;
  if (!Number.isFinite(result?.gross)) return null;
  const gross18 = result.holesPlayed === 9 ? result.gross * 2 : result.gross;
  return ((gross18 - course.rating) * 113) / course.slope;
}

/**
 * Running handicaps for a season.
 *
 *   rounds:            played rounds sorted by date, each { id, results[] }
 *                      plus a resolved course object { slope, rating } on
 *                      `courseInfo` (or `course`, when it's an object —
 *                      the SPA keeps `course` as the display name string).
 *   startingHandicaps: Map or plain object of playerId → int — each
 *                      player's handicap at the start of the season.
 *
 * Each played event contributes the player's handicap index; each
 * missed event (or one where the index can't be computed) contributes
 * the player's STARTING handicap, so sitting out holds you steady —
 * the sheet back-solves a synthetic score for this, we use the value
 * directly.
 *
 * Running handicap after event n = round(mean(starting, c₁ … cₙ)).
 * Season-end handicap (next season's starting) = round(mean(c₁ … cₙ)).
 *
 * Returns Map<playerId, {
 *   starting, current, seasonEnd,
 *   events: [{ roundId, index, contribution, handicapBefore, handicapAfter }],
 * }>. `current` is the handicap to use for the NEXT round.
 */
export function runningHandicaps({ rounds, startingHandicaps }) {
  const entries = startingHandicaps instanceof Map
    ? startingHandicaps
    : new Map(Object.entries(startingHandicaps || {}));
  const out = new Map();
  for (const [playerId, starting] of entries) {
    if (!Number.isFinite(starting)) continue;
    const events = [];
    const contribs = [];
    let before = starting;
    for (const round of rounds || []) {
      const r = (round.results || []).find(
        (x) => (x.playerId || slugName(x.name)) === playerId
      );
      const index = r && r.attended ? handicapIndex(r, courseOf(round)) : null;
      const contribution = index ?? starting;
      contribs.push(contribution);
      const after = roundHalfUp(
        (starting + contribs.reduce((s, v) => s + v, 0)) / (contribs.length + 1)
      );
      events.push({ roundId: round.id, index, contribution, handicapBefore: before, handicapAfter: after });
      before = after;
    }
    out.set(playerId, {
      starting,
      events,
      current: events.length ? events[events.length - 1].handicapAfter : starting,
      seasonEnd: contribs.length
        ? roundHalfUp(contribs.reduce((s, v) => s + v, 0) / contribs.length)
        : starting,
    });
  }
  return out;
}

// ── Season standings ────────────────────────────────────────────────

/**
 * Championship standings for a season: per-player totals where only
 * each player's best `bestN` rounds count (extra rounds drop the
 * lowest-scoring ones). Counting stats (pars, birdies, …) still cover
 * every round played; only totalPoints is capped.
 *
 * `courseParFor(round)` lets the caller resolve per-course par;
 * defaults to 72 everywhere.
 */
export function buildSeasonStandings(season, { bestN = BEST_ROUNDS_COUNT, courseParFor } = {}) {
  const playedRounds = (season.rounds || []).filter((r) => r.played);
  if (!playedRounds.length) return [];
  const map = new Map();
  for (const round of playedRounds) {
    const coursePar = courseParFor ? courseParFor(round) : 72;
    const annotated = computeRoundPoints(round, coursePar);
    for (const r of annotated) {
      const key = r.playerId || slugName(r.name);
      const cur = map.get(key) || {
        playerId: r.playerId || key, name: r.name,
        rounds: 0, attended: 0,
        pars: 0, birdies: 0, eagles: 0, albatrosses: 0, holeInOnes: 0,
        lowRounds: 0,
        totalGross: 0,
        roundPoints: [],
        sparkPoints: [],
      };
      cur.rounds++;
      if (r.attended) {
        cur.attended++;
        cur.totalGross += (r.gross || 0);
      }
      cur.pars        += (r.pars || 0);
      cur.birdies     += (r.birdies || 0);
      cur.eagles      += (r.eagles || 0);
      cur.albatrosses += (r.albatrosses || 0);
      cur.holeInOnes  += (r.holeInOnes || 0);
      if (r.lowRound) cur.lowRounds++;
      cur.roundPoints.push(r.points);
      map.set(key, cur);
    }
  }
  const list = [...map.values()];
  for (const p of list) {
    const counted = [...p.roundPoints].sort((a, b) => b - a).slice(0, bestN);
    p.totalPoints = counted.reduce((s, v) => s + v, 0);
    p.droppedRounds = Math.max(0, p.roundPoints.length - bestN);
    // Season-to-date spark of the CAPPED total after each round.
    let running = [];
    p.sparkPoints = p.roundPoints.map((pts) => {
      running.push(pts);
      return [...running].sort((a, b) => b - a).slice(0, bestN).reduce((s, v) => s + v, 0);
    });
  }
  // Highest total points wins. Tiebreaker: more rounds attended, then alphabetical.
  list.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.attended !== a.attended) return b.attended - a.attended;
    return a.name.localeCompare(b.name);
  });
  let rank = 0, prev = null;
  list.forEach((p, i) => {
    if (p.totalPoints !== prev) { rank = i + 1; prev = p.totalPoints; }
    p.rank = rank;
  });
  return list;
}

// ── Internals ───────────────────────────────────────────────────────

/** Round half UP (2.5 → 3), matching the league sheet's convention. */
function roundHalfUp(v) {
  return Math.round(v);
}

/** Resolve a round's course object ({slope, rating, par}) if present. */
function courseOf(round) {
  const c = round.courseInfo ?? round.course;
  return c && typeof c === 'object' ? c : null;
}

function slugName(s) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
