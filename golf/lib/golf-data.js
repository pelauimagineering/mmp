// Adapter: Supabase rows → the {sport, scoringMatrix, seasons[]} shape
// that golf/index.html's existing render*() functions consume.
//
// Keeping the legacy shape means the renderers don't change at all
// when we swap the backend out from under them.

// Absolute path so the adapter is importable from any page on the site
// (the root /index.html, the golf SPA, the score-entry form) without
// each consumer needing its own config bridge.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '/golf/supabase-config.js';

const SCORING_MATRIX = {
  attendance: { points: 5,  label: 'Showed up',  description: 'Played the round.' },
  par:        { points: 1,  label: 'Par',        description: 'Per par scored on a hole.' },
  birdie:     { points: 3,  label: 'Birdie',     description: 'Per birdie.' },
  eagle:      { points: 10, label: 'Eagle',      description: 'Per eagle.' },
  albatross:  { points: 20, label: 'Albatross',  description: 'Per albatross.' },
  holeInOne:  { points: 25, label: 'Hole-in-one',description: 'Per ace.' },
  lowRound:   { points: 3,  label: 'Low round',  description: 'Lowest 18-hole gross of the round (ties each get full points).' },
  // Penalty bands stack as diff (gross − handicap par) climbs. 9-hole
  // rounds use par 36 and handicap/2.
  penalty:    { points: -3, display: '−1 to −3', label: 'Over handicap par',
                description: 'Score over (par + handicap): 6–10 over → −1 pt; 11–15 → −2 pts; 16+ → −3 pts.' },
};

const CACHE_KEY = 'mmp.golf.lastFetch';

/**
 * Lazily-instantiated supabase-js client. The library is loaded as a
 * <script> tag in the page (window.supabase); we don't import it here
 * because score-entry needs the SDK before the queue tries to flush.
 */
export function getSupabase() {
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    throw new Error('supabase-js not loaded — check the <script> tag in the entry HTML.');
  }
  if (!getSupabase._client) {
    getSupabase._client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return getSupabase._client;
}

export async function loadGolfFromSupabase() {
  const supa = getSupabase();
  const [playersRes, seasonsRes] = await Promise.all([
    supa.from('players').select('*'),
    supa
      .from('seasons')
      .select('id,label,sport, rounds:rounds(id,date,course,organizer,tee_times,played, results:results(*)), final_standings:final_standings(*)')
      .eq('sport', 'golf')
      .order('id', { ascending: true }),
  ]);

  if (playersRes.error) throw playersRes.error;
  if (seasonsRes.error) throw seasonsRes.error;

  return shapeForSpa(playersRes.data || [], seasonsRes.data || []);
}

export function shapeForSpa(playersRows, seasonsRows) {
  return {
    sport: 'golf',
    _schema: 'rounds: per-round results, snake_case → camelCase normalized below',
    scoringMatrix: SCORING_MATRIX,
    seasons: seasonsRows.map((s) => ({
      // Strip the "golf-" prefix used in the DB to keep external ids
      // (route paths, cached file ids) consistent with the legacy JSON.
      id: s.id.replace(/^golf-/, ''),
      label: s.label,
      rounds: (s.rounds || [])
        .slice()
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .map((r) => ({
          id: r.id,
          date: r.date,
          course: r.course,
          organizer: r.organizer,
          teeTimes: r.tee_times || [],
          played: !!r.played,
          results: (r.results || []).map((x) => ({
            playerId: x.player_id,
            name: x.name,
            attended: !!x.attended,
            holesPlayed: x.holes_played,
            gross: x.gross,
            handicap: x.handicap,
            pars: x.pars ?? 0,
            birdies: x.birdies ?? 0,
            eagles: x.eagles ?? 0,
            albatrosses: x.albatrosses ?? 0,
            holeInOnes: x.hole_in_ones ?? 0,
          })),
        })),
      finalStandings: (s.final_standings || [])
        .slice()
        .sort((a, b) => a.rank - b.rank)
        .map((p) => ({
          rank: p.rank,
          playerId: p.player_id,
          name: p.name,
          totalPoints: Number(p.total_points),
          roundsPlayed: p.rounds_played,
        })),
    })),
    _players: playersRows.map((p) => ({
      id: p.id,
      name: p.name,
      currentHandicap: p.current_handicap,
      sports: p.sports || [],
    })),
  };
}

/** Read the last successful Supabase fetch from localStorage, if any. */
export function readSoftCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Persist a fresh fetch result for the offline / flaky-net soft fallback. */
export function writeSoftCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, at: Date.now() }));
  } catch { /* quota exceeded — ignore */ }
}
