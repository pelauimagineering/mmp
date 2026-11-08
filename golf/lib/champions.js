// champions.js — the MMP Cup roll of honour.
//
// data/champions.json is the official record (the engraved plates), one
// entry per cup year. A cup year opens with the summer golf season and
// closes with the winter poker season: golf "2026" and poker "2026-27"
// both belong to cup year 2026-27. Cup years after the record are filled
// in from the live season data, but only once a season is complete — a
// mid-season leader is not a champion.

// Players can change names (the roster lists former names in `aliases`,
// e.g. Dee, née Darren). The resolver maps any recorded name to the
// player's current one, so their history follows them.
export function nameResolverFrom(players) {
  const map = new Map();
  for (const p of players || []) {
    for (const alias of p.aliases || []) map.set(alias, p.name);
  }
  return (name) => map.get(name) ?? name;
}

const pad2 = (n) => String(n % 100).padStart(2, '0');

function cupYearFromStart(year) {
  return { id: `${year}-${pad2(year + 1)}`, label: `${year}–${pad2(year + 1)}` };
}

// Golf seasons are ids like "2026"; poker seasons like "2025-26".
export function cupYearOf(sport, season) {
  const year = parseInt(String(season?.id ?? ''), 10);
  if (!Number.isFinite(year)) return null;
  return cupYearFromStart(year);
}

// Mirrors the golf SPA: done once something was played and nothing is
// still scheduled for today or later.
export function isSeasonComplete(sport, season, todayISO = new Date().toISOString().slice(0, 10)) {
  if (sport === 'poker') {
    const events = season?.events || [];
    return events.length > 0 && events.every((e) => e.played || e.skipped);
  }
  const rounds = season?.rounds || [];
  return rounds.some((r) => r.played) &&
    !rounds.some((r) => !r.played && (!r.date || r.date >= todayISO));
}

const rankOneNames = (season) =>
  (season?.finalStandings || []).filter((p) => p.rank === 1).map((p) => p.name);

// → [{ id, label, golf: { names, note }, poker: { names, note } }], oldest first.
// `resolveName` (optional, e.g. from nameResolverFrom) rewrites engraved and
// standings names to each player's current name.
export function buildCupHistory({ record, golf, poker, todayISO, resolveName } = {}) {
  const resolve = resolveName || ((n) => n);
  const years = new Map();
  for (const y of record?.cupYears || []) {
    years.set(y.id, {
      id: y.id,
      label: y.label,
      official: true,
      golf: { names: (y.golf || []).map(resolve), note: y.golfNote || null },
      poker: { names: (y.poker || []).map(resolve), note: y.pokerNote || null },
    });
  }
  for (const [sport, data] of [['golf', golf], ['poker', poker]]) {
    for (const season of data?.seasons || []) {
      const cup = cupYearOf(sport, season);
      if (!cup) continue;
      const entry = years.get(cup.id) || { ...cup, official: false };
      years.set(cup.id, entry);
      if (entry.official || entry[sport]) continue;   // the plates always win
      const done = isSeasonComplete(sport, season, todayISO);
      const names = done ? rankOneNames(season).map(resolve) : [];
      entry[sport] = { names, note: names.length ? null : 'In progress' };
    }
  }
  const out = [...years.values()].sort((a, b) => a.id.localeCompare(b.id));
  for (const y of out) {
    for (const sport of ['golf', 'poker']) {
      if (!y[sport]) y[sport] = { names: [], note: 'In progress' };
    }
  }
  return out;
}

// → { ranked: [[name, cups], …], lastWin: Map(name → cup-year label) }.
// Shared cups count once for each winner. Ties in cups go to the more
// recent winner, then alphabetically.
export function titlesBy(history, sport) {
  const cups = new Map();
  const lastWin = new Map();
  const lastIdx = new Map();
  history.forEach((y, i) => {
    for (const name of y[sport]?.names || []) {
      cups.set(name, (cups.get(name) || 0) + 1);
      lastWin.set(name, y.label);
      lastIdx.set(name, i);
    }
  });
  const ranked = [...cups.entries()].sort((a, b) =>
    b[1] - a[1] || lastIdx.get(b[0]) - lastIdx.get(a[0]) || a[0].localeCompare(b[0]));
  return { ranked, lastWin };
}

// The champion(s) of one season per the history, or null when none was
// crowned (yet).
export function championsOf(history, sport, season) {
  const cup = cupYearOf(sport, season);
  const names = cup && history.find((y) => y.id === cup.id)?.[sport]?.names;
  return names && names.length ? names : null;
}
