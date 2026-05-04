---
project: MMP Challenge Cup
audience: solo developer (Darren) — design brief
date: 2026-05-01
status: draft v1
---

# MMP Challenge Cup — Information Architecture

A unified, ESPN-styled scoreboard for two MMP competitions: the **Links Cup** (golf, 2026 summer season) and the **Poker** tournament (winter, multi-season history starting 2022-23). Single static site, no build step. Data lives in `data/*.json` and the site reads it on load.

## Goals

The site has to do three jobs, in order of priority. First, it tells anyone who shows up "who is winning right now" within five seconds. Second, it lets the regulars drill into a specific event or their own record without feeling like a spreadsheet. Third, it survives the off-season — when poker is dormant in summer or golf in winter, the inactive sport should feel intentional, not broken.

## Top-level navigation

Two tabs in the header: **Golf** and **Poker**. The active tab paints its accent color through the whole page. Below the tabs, a season picker (segmented control, latest season selected by default). On launch the site lands on whichever sport is currently in season — golf May–Oct, poker Nov–Apr — using the local date. A small "all-time" link sits to the right of the season picker for cross-season views.

## Page structure

The site is a single page (`index.html`) with view-swapping driven by hash routing (`#/poker/2025-26`, `#/poker/event/2025-26-mar`, `#/poker/player/neave`, `#/golf`). No router library — a 30-line vanilla JS dispatcher handles it. Hash routing means the back button works and links are shareable without a server.

## Views

### Home / Season Leaderboard (default)
The headline view. Big page title with the season ("2025–26 MMP Poker Season"), three KPI tiles across the top — current leader, last event winner, next event date/host — then the full standings table. Standings show rank, player, season total, events played, and a sparkline of YTD over time. Clicking a player row routes to the player profile; clicking an event in a "recent events" strip below routes to the event detail.

Data needed: one season object from `poker.json` (or `golf.json`) — events array, finalStandings, totals.

### Event Detail
One screen per monthly tournament. Header shows the date, host, and total points awarded. The body is the event's results table — exactly the columns from the spreadsheet (Appearance, Win, Tie, Runner-Up, Event Total, YTD Total, Rank) — with a tie-split annotation row underneath when ties occurred. A right rail shows "Season standings after this event" so context is always one glance away.

Data needed: a single event object plus the YTD snapshot it produced.

### Player Profile
One row per season the player appeared in, plus headline numbers at the top: career points, career wins, career runner-ups, attendance rate, best season finish. Below that, a season-by-season chart (small recharts/SVG line, season totals over time) and a list of every event they played with their finish.

Data needed: cross-season aggregation built client-side from the seasons array. No new data file.

### All-time
A single leaderboard that sums each player's final-YTD across seasons they played. Includes columns for seasons played, wins, runner-ups, ties, attendance percentage. This is where Neave/Seymour/Junior — the dominant trio — get their flowers.

Data needed: derived from all season objects in `poker.json`.

### Golf views (placeholder until 2026 Links Cup data arrives)
Same shell, same view names. Until scores exist, each view shows an empty state: a friendly "First round tees off [date]" card with a countdown and the season schedule once it's known. The empty state is its own component so the flip from "no data" to "data" is one boolean.

## Data model

Each sport has one JSON file: `data/poker.json` (already produced) and `data/golf.json` (TBD when the Links Cup format is decided). Both follow the same top-level shape — `sport`, `seasons[]`, where each season has `id`, `label`, `events[]`, `finalStandings[]`. Golf events will swap the poker-specific point columns for golf scoring (likely strokes, points, or stableford depending on format), but the season/event/leaderboard pattern stays identical so the views are reusable.

## Decisions worth flagging

A few choices baked into the design that are worth a sanity check before the mockup hardens.

**Sparse players (Lorenzo, Tony) stay in the standings.** They show up in the spreadsheet so they show up in the table, sitting at the bottom with zeros. Hiding them would erase part of the group, and the data already ranks them last. The findings doc suggests downplaying them on highlight cards — that's right — but the source-of-truth standings should remain complete.

**Tie scores show with decimals (7.5, 9.5).** Rounding would be a lie. Tie splits are part of the format's character.

**Skipped months render as ghost rows in the schedule strip.** Faded card with "No game scheduled" so the season's rhythm reads correctly, rather than vanishing the gap.

**Unplayed/future events are visually distinct from played ones.** April 2026 in the spreadsheet is all-zeros — the schema marks it `played: false`. The UI must not rank these or count their zeros against players. Treat them as upcoming, not as last-place finishes.

**Host rotation is a feature, not metadata.** The host name appears prominently on every event card. It's part of the social fabric of the league.

**Terminology — "host" vs "organizer".** Poker uses *host* (the player whose home the game is at). Golf uses *organizer* (the player who set the round up — picks the course, books tee times). Same role, different word per sport, and the data model preserves the distinction: `event.host` for poker, `round.organizer` for golf. The UI surfaces whichever label fits the active sport.

## What gets built first (mockup scope)

The mockup that accompanies this doc covers the home/season-leaderboard view with a mini event-detail panel and a player card hover state. It hard-codes 2025–26 data so the visual choices are tested against real values, including a tie split and Harish's season-stealing April. The other views (player profile full page, all-time, golf empty states) inherit the same components and are sketched conceptually in the mockup's right-side annotations.

## Updating scores

Two sports, two distinct cadences, so two ergonomically different flows. Both end in a JSON file the static site reads — neither requires a server.

### Poker (once a month, Nov–Apr)

The source of truth is the Numbers/Excel scoresheet you already maintain. After an event, drop the latest xlsx in the project root and run:

```bash
python3 scripts/build_poker.py
```

The script picks the most recently modified `MMP Poker*.xlsx`, walks every `Poker_YYYY_YY` sheet, parses each `Event:` block, and writes `data/poker.json`. It handles the Numbers-export quirks (stray whitespace in cells, host name formatting variants, placeholder events with all-None rows) and prints a one-line summary per season showing event count and current winner. No interactive prompts — fast enough to run after every event.

### Golf (up to 3 rounds/week, May–Oct)

The xlsx-and-script flow is too heavy for three rounds a week. Instead, the project includes `admin.html` — a self-contained, mobile-friendly form. Open it on the phone after the round, tap in each player's gross score, and hit **Save round**. The page does this work locally:

- Loads `data/players.json` for the roster and `data/golf.json` for the existing season.
- Persists each player's current handicap in `localStorage` so it pre-fills next round.
- Computes net = gross − handicap as you type, with a low-gross / low-net summary tile.
- Builds the updated `golf.json` (existing rounds + this one), and either downloads it or copies it to clipboard.

The only manual step is replacing `data/golf.json` in the project — drop the downloaded file in, commit, push. If you're hosting on GitHub Pages or Netlify drop, the new round goes live within seconds. The admin page works equally well opened locally (`file://`) or hosted; when no `data/*.json` is reachable, it falls back to a built-in roster so you're never locked out.

The flow purposely avoids any backend, auth, or database. Three rounds a week of tap-tap-save with one file replace is the simplest thing that actually works, and matches the constraint of a single-developer static site.

### Player roster, handicaps, and other shared facts

`data/players.json` is the single source of truth for who plays. Adding a new player is one entry there; both sports pick it up. Per-player current handicap lives in the same file as a default; the admin page can override per round if needed and saves the latest value back via localStorage. To make a handicap change permanent across the project (and for new rounds entered on a different device), edit `data/players.json` directly and commit.
