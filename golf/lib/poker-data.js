// poker-data.js — where the pages get poker data from.
//
// Live order, same idea as golf:
//   1. Supabase (poker_events / poker_results, migration 0012)
//   2. the localStorage soft cache of the last good Supabase read
//   3. data/poker.json — the spreadsheet-era file, kept as the fallback
//      for a database that is unreachable, paused, or not yet migrated
//
// Whatever the source, the result is the { sport, seasons[] } shape of
// data/poker.json, so the leaderboard renderers never know the difference.

import { getSupabase, readSoftCache, writeSoftCache } from './golf-data.js';
import { shapePokerForSpa } from './poker-shape.js';

const CACHE_KEY = 'mmp.poker.lastFetch';
const STATIC_URL = '/golf/data/poker.json';

const hasEvents = (data) => (data?.seasons || []).some((s) => (s.events || []).length);

export async function loadPokerFromSupabase() {
  const { data, error } = await getSupabase()
    .from('seasons')
    .select('id,label,skipped_months, events:poker_events(*, results:poker_results(*))')
    .eq('sport', 'poker');
  if (error) throw error;
  return shapePokerForSpa(data || []);
}

async function loadStatic() {
  try {
    const r = await fetch(STATIC_URL, { cache: 'no-cache' });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

// Fresh Supabase data, cached on success. Null when the database is
// unreachable, not migrated, or holds no poker nights yet (an unseeded
// database answers with empty seasons, not an error).
async function fetchLive() {
  try {
    const fresh = await loadPokerFromSupabase();
    if (!hasEvents(fresh)) return null;
    writeSoftCache(fresh, CACHE_KEY);
    return fresh;
  } catch (e) {
    console.warn('Poker: Supabase fetch failed; falling back.', e);
    return null;
  }
}

/**
 * Best poker data available without making the page wait on a slow
 * database. The live read gets a short head start — 200ms when a cached
 * copy is ready to show, `graceMs` when the only alternative is the
 * static file (fetched alongside, not after). If live misses it, the
 * fallback is returned and the fresh data goes to `onLate` when it does
 * arrive, so the page can repaint.
 */
export async function loadPokerLive({ graceMs = 1500, onLate } = {}) {
  const live = fetchLive();
  const cached = readSoftCache(CACHE_KEY)?.data || null;
  const fallback = cached ? Promise.resolve(cached) : loadStatic();
  const first = await Promise.race([
    live,
    new Promise((resolve) => setTimeout(() => resolve(undefined), cached ? 200 : graceMs)),
  ]);
  if (first) return first;
  if (first === undefined && onLate) live.then((late) => { if (late) onLate(late); });
  return fallback;
}

/** Repaint hook: calls `onChange` (debounced) when anyone saves a night. */
export function subscribePokerLive(onChange) {
  let timer = null;
  const bump = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const fresh = await fetchLive();
      if (fresh) onChange(fresh);
    }, 200);
  };
  try {
    getSupabase()
      .channel('poker-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poker_events' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poker_results' }, bump)
      .subscribe();
  } catch (e) {
    console.warn('Poker: realtime subscription failed:', e);
  }
}
