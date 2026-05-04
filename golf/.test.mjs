import pkg from 'jsdom';
import { setTimeout } from 'node:timers/promises';
const { JSDOM } = pkg;
const url = 'http://127.0.0.1:8765/index.html';
const BASE = 'http://127.0.0.1:8765/';

async function loadAt(hash) {
  const html = await (await fetch(url)).text();
  const dom = new JSDOM(html, { url: url + (hash ? '#/' + hash : ''), runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.fetch = (path, opts) => fetch(new URL(path, BASE), opts);
  for (const s of dom.window.document.querySelectorAll('script')) if (s.textContent) dom.window.eval(s.textContent);
  await setTimeout(900);
  return dom;
}

// Expected points after handicap adjustment:
// Wayne wins low round (net 39) — points = 5 + 2*1 + 3 = 10
// Junior: 5 + 8*1 + 2*3 = 19 (no low round bonus now)
// Harish: 5 + 7*1 + 1*3 = 15
// Kerwin: 5 + 5*1 = 10
// Neave (9 holes): 5 + 3*1 = 8 (no low round eligibility)
// Tony (no HCP): 5 + 4*1 = 9 (no low round eligibility)
// Lorenzo: 0 (DNP)

console.log('=== Round detail content (key cells) ===');
const detail = await loadAt('golf/event/2026-r001');
const rows = [...detail.window.document.querySelectorAll('tbody tr')];
for (const tr of rows) {
  const cells = [...tr.querySelectorAll('td')].map(td => td.textContent.trim());
  console.log(cells.join(' | '));
}
detail.window.close();

console.log('\n=== Season standings (sorted by points desc) ===');
const season = await loadAt('golf');
const sRows = [...season.window.document.querySelectorAll('tbody tr')];
for (const tr of sRows) {
  const cells = [...tr.querySelectorAll('td')].map(td => td.textContent.trim());
  // rank, player, rds, par, bird, eagle+, low, pts, trend
  console.log(cells.slice(0, -1).join(' | '));
}

// Assertions: Wayne = 10 (with low round bonus), Junior = 19 (no bonus), Junior should be #1 in points
const wayneRow = [...season.window.document.querySelectorAll('tr[data-player-id="wayne"]')][0];
const juniorRow = [...season.window.document.querySelectorAll('tr[data-player-id="junior"]')][0];
const wayneCells = [...wayneRow.querySelectorAll('td')].map(td => td.textContent.trim());
const juniorCells = [...juniorRow.querySelectorAll('td')].map(td => td.textContent.trim());
const waynePts = wayneCells[wayneCells.length - 2];
const juniorPts = juniorCells[juniorCells.length - 2];
const wayneLow = wayneCells[wayneCells.length - 3];

console.log(`\nWayne pts: ${waynePts} (expected 10) · Wayne low rounds: ${wayneLow} (expected 1)`);
console.log(`Junior pts: ${juniorPts} (expected 19)`);

let ok = waynePts === '10' && juniorPts === '19' && wayneLow === '1';

// Check that Tony (no HCP) didn't get a low-round bonus
const tonyRow = [...season.window.document.querySelectorAll('tr[data-player-id="tony"]')][0];
const tonyCells = [...tonyRow.querySelectorAll('td')].map(td => td.textContent.trim());
const tonyPts = tonyCells[tonyCells.length - 2];
console.log(`Tony pts: ${tonyPts} (expected 9 — no HCP, no low round bonus)`);
ok = ok && tonyPts === '9';

console.log('\n' + (ok ? 'ALL OK — handicap-based net works' : 'FAIL'));
process.exit(ok ? 0 : 1);
