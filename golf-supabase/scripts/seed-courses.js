#!/usr/bin/env node
/**
 * Seed the course table + per-season starting handicaps, and backfill
 * rounds.course_id on rounds entered before the courses table existed.
 * Run after applying 0008_courses_and_season_players.sql:
 *
 *   cd golf-supabase
 *   cp .env.example .env && edit .env  # SUPABASE_URL + SUPABASE_SERVICE_ROLE
 *   node scripts/seed-courses.js
 *
 * Idempotent: courses/season_players are upserts, and the backfill
 * only touches rounds whose course_id is still null.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ENV_PATH = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(ENV_PATH)) {
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE. See .env.example.');
  process.exit(1);
}

const coursesJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'golf', 'data', 'courses.json'), 'utf8'));
const playersJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'golf', 'data', 'players.json'), 'utf8'));

// The season whose starting handicaps come from players.currentHandicap.
// (Those values are the sheet's 2026 starting column.)
const SEASON_ID = 'golf-2026';

async function rest(method, pathAndQuery, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${pathAndQuery} → ${res.status}: ${text}`);
  }
  return res;
}

async function restGet(pathAndQuery) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`,
    },
  });
  if (!res.ok) throw new Error(`GET ${pathAndQuery} → ${res.status}: ${await res.text()}`);
  return res.json();
}

(async () => {
  const courses = coursesJson.courses;
  console.log(`Upserting ${courses.length} courses…`);
  await rest('POST', 'courses', courses);

  const seasonPlayers = playersJson.players
    .filter((p) => (p.sports || []).includes('golf') && Number.isFinite(p.currentHandicap))
    .map((p) => ({
      season_id: SEASON_ID,
      player_id: p.id,
      starting_handicap: p.currentHandicap,
    }));
  console.log(`Upserting ${seasonPlayers.length} ${SEASON_ID} starting handicaps…`);
  await rest('POST', 'season_players', seasonPlayers);

  console.log('Backfilling rounds.course_id from course names…');
  // Rounds were entered with free-text names, often the full club name
  // ("Silver Lakes Golf & Country Club") — match the longest course
  // name contained in the round's name (or vice versa).
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const matchCourse = (roundName) => {
    const n = norm(roundName);
    if (!n) return null;
    const hits = courses.filter((c) => {
      const cn = norm(c.name);
      return n === cn || n.includes(cn) || cn.includes(n);
    });
    hits.sort((a, b) => norm(b.name).length - norm(a.name).length);
    return hits[0] || null;
  };
  const rounds = await restGet('rounds?select=id,course,course_id&course_id=is.null');
  let matched = 0;
  for (const r of rounds) {
    const courseId = matchCourse(r.course)?.id;
    if (!courseId) {
      if (r.course) console.warn(`  ! no course match for round ${r.id} ("${r.course}") — left null`);
      continue;
    }
    await rest('PATCH', `rounds?id=eq.${encodeURIComponent(r.id)}`, { course_id: courseId });
    matched++;
  }
  console.log(`Done. Linked ${matched} of ${rounds.length} unlinked rounds.`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
