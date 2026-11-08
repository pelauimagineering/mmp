# Release notes

## 2026-11-08 · `claude/determined-brown-b0ihrx`

Upcoming poker game nights can now be prepared ahead of time, like golf
rounds: a scheduled event carries a specific date, a start time, and a
host. First one in: **Sun Nov 15, 2026 · 4:00 PM · hosted by Dee**.

- **golf/data/poker.json**: new `_schema` block, and a new 2026–27 season
  whose Nov event is scheduled (`played: false`) with `date` (ISO) and
  `time` (24h `"HH:MM"`) fields alongside the existing `host`.
- **Golf/poker app**: a poker season with nothing played yet shows a
  schedule page (date, start time, host) instead of "No data yet"; the
  schedule strip's upcoming cards show the date and time; an unplayed
  event's detail page is an "Upcoming event" hero like golf's; and a
  completed season's "Next Season" KPI now reads the next scheduled game
  from the data instead of a hardcoded "Nov 2026".
- **Home page**: the poker standings card gains a "Next game" block
  (date / host / start time) mirroring golf's "Next round", and scheduled
  poker nights appear in the Latest strip. A played event with no
  recorded host now reads "TBD" instead of "null" there.
- **scripts/build_poker.py**: rebuilding from the xlsx no longer wipes
  hand-maintained scheduling — it keeps seasons and unplayed events the
  xlsx doesn't have, and `date`/`time` on events it does.

Player name aliases — Darren's history follows Dee.

- **golf/data/players.json**: the roster entry is now Dee (id `dee`,
  poker only) with `aliases: ["Darren"]`. An alias lists a player's
  former names.
- **golf/lib/champions.js**: new `nameResolverFrom(players)` maps any
  recorded name to the player's current one; `buildCupHistory` takes an
  optional `resolveName` so engraved and standings names follow it
  (the 2013–14 poker plate now counts as Dee's cup). Data files keep
  the names as recorded — resolution happens at display/aggregation.
- **Golf/poker app**: poker results, hosts, and final standings are
  rewritten to current names at load, so standings, profiles, event
  pages, and the all-time table merge Darren's record into Dee's. The
  profile header notes "née Darren", and old `#/poker/player/darren`
  links land on Dee's profile.
- **Home page**: cups-won cards, roll of honour, and "hosted by" lines
  resolve aliases the same way.

## 2026-11-08 · `claude/admin-password-access-g9d2dk`

MMP Cup champions back to 2008, from the engraved history plates.

- **golf/data/champions.json** (new): the official winner of golf and poker
  for every cup year from 2008–09 to 2025–26. A cup year opens with the
  summer golf season and closes with the winter poker season. Notes record
  2018–19 poker (not awarded) and 2019–20 poker (cancelled, COVID-19).
- **golf/lib/champions.js** (new): merges that record with live season data.
  The record always wins. Cup years after it are filled from seasons that
  are complete, so a mid-season leader is never counted as a champion.
  Tests: `node golf/scripts/test-champions.mjs`.
- **Home page**: "All-time, by name" now counts every cup since 2008 for both
  sports (the golf card used to show only the 2026 Links Cup). A shared cup
  counts for each winner. New "Roll of honour" table lists every cup year.
- **Golf/poker app**: season champion labels and the all-time Titles column
  follow the record. Poker 2023–24 shows Kerwin (Seymour led on points), and
  2022–23 shows Neave / Harish as a shared cup.

## 2026-05-23 · `claude/issue-10-edit-rounds`

Round editing (Issue #10) — every round (upcoming, in-progress, or played)
can now be edited end-to-end without forking the row.

- **score-entry.html**: opening `score-entry.html?roundId=<id>` enters edit
  mode. The form pre-fills every metadata field plus per-player attendance,
  holes, handicap, gross, and counts. Title becomes "Edit round" and the
  save button "Save changes". When the round is Supabase-only (typical for
  played rounds), the form falls back to `loadGolfFromSupabase()` (or its
  soft cache) so live data can be edited even though the static
  `data/golf.json` doesn't carry it.
- **Id stability on edit**: `buildRound()` now reuses the original round id
  when in edit mode, so renaming the date or course no longer creates an
  orphaned duplicate row. The original-attendance set is also preserved in
  the payload so toggling a previously-attended player to DNP correctly
  flips their row to `attended=false` instead of silently leaving stale
  data.
- **score-entry guard relaxed**: the "at least one player attended" save
  guard is skipped in edit mode so pure metadata edits (date, course,
  organizer, tee times) on upcoming rounds save without scores.
- **index.html**: `renderGolfRoundDetail()` gains an "Edit round" button on
  both upcoming (next to "Enter scores for this round") and played (in the
  hero row) variants, linking to `score-entry.html?roundId=...`.
- **admin.html**: new "Edit existing round" picker above the form lists
  every round from `data/golf.json`, most-recent first. Selecting one
  pre-fills the form and locks the original id, so the JSON-download flow
  upgrades to a true edit operation.
- **No schema / RPC / SW changes** — the existing `enter_round` RPC is
  already upsert-capable, realtime publication already broadcasts edits,
  and the offline queue keys on payload id (a queued edit on the same id
  overwrites a queued create, which is correct).

## 2026-05-23 · `claude/issue-8-phone-ui-tweaks`

Phone-UI cleanup for the golf SPA (Issue #8).

- **Header**: removed the redundant "Switch to dealer" link; replaced
  the leftover `padding-bottom: var(--space-9)` inside `header.top .shell`
  that was producing a large empty band below the header actions on phones.
- **Same plane as content**: header is no longer sticky on phones
  (≤720px), so it scrolls with the standings/schedule/storylines panels
  instead of staying pinned and stealing vertical space. Header width
  already matched content via `.shell max-width: 1280px`; left untouched.
- **Create round**: added a secondary outline button in the header rail
  (`#header-create-round`) that links to `admin.html`. Lives next to
  "Enter scores", uses the existing `.golf-only` toggle so it is hidden
  in the poker view.
- **Next Round tile**: now skips any unplayed round whose date is before
  today (lexicographic ISO compare). When all unplayed rounds are in the
  past the tile falls through to the existing "Season Complete /
  Off-season" branch.

## 2026-05-05 · `feature/golf-supabase-realtime`

Live golf scoring backed by Supabase, with full offline support on the
course.

- **Database** (`golf-supabase/`): Postgres schema for `players`,
  `seasons`, `rounds`, `results`, plus a `_secret` table for the
  shared score-entry passphrase. RLS denies anon writes; the
  `enter_round(passphrase, payload)` SECURITY DEFINER RPC verifies
  the passphrase and upserts the round + every result row.
  Realtime publication enabled on `rounds` and `results`.
- **Seed**: `golf-supabase/scripts/seed-from-json.js` reads the
  existing `golf/data/*.json` and idempotently upserts everything
  via the Supabase REST API using the service role key (kept in
  `.env`, gitignored).
- **Leaderboard SPA** (`golf/index.html`): now fetches a single
  `seasons → rounds → results` JOIN from Supabase on first paint
  and subscribes to a Realtime channel for live updates. Renders
  through a `shapeForSpa()` adapter so every existing renderer
  function works unmodified. A localStorage soft-cache primes the
  view on flaky connections so users see yesterday's data instead
  of a spinner. Refetches coalesce bursty Realtime events into a
  single re-render with a 200ms debounce.
- **Score entry** (`golf/score-entry.html`): rewritten as an
  offline-first queue + sync.
  - **`golf/lib/queue.js`** — IndexedDB wrapper (`put`, `list`,
    `delete`, `count`).
  - **`golf/sw.js`** — service worker that precaches the form's
    HTML/CSS/JS + supabase-js bundle so the page loads with zero
    network. Supabase REST/Realtime requests are network-only.
  - **Save** writes the round payload to IndexedDB and immediately
    schedules a sync; sync triggers fire on `online`, page load,
    and a 30-second poll. Each queued payload is sent through the
    `enter_round()` RPC; successful entries are removed from the
    queue.
  - **Status chip** with four states: Ready / Offline / Syncing /
    Synced / Sync paused. Pending count is shown alongside; tap to
    retry.
  - The "Copy JSON" + "Download" buttons survive as panic-button
    fallbacks for browser-nuke recovery.
- Idempotency: every queued payload is keyed on `(round_id,
  player_id)` upsert, so retries can never duplicate or corrupt
  data.

Manual one-time setup (Supabase project creation, applying
migrations, seeding the passphrase) documented in
`golf-supabase/README.md`.

## 2026-05-04 · `feature/homepage-seasonal-default`

Homepage refresh.

- Trophy image moved from the top hero to a closing section just above the
  footer. Width capped to `min(460px, calc(100vw − gutter))` and `overflow-x:
  hidden` on `html, body` to prevent horizontal scroll on iPhone.
- Headline changed to **"Bring it on, _boys._"** and relocated above the
  trophy in the new closing section. The top of the page is now a slim
  text-led intro (eyebrow + lede + CTAs).
- Featured sport is now season-aware: golf May–Oct, poker Nov–Apr (matching
  the golf SPA's `inSeasonSport()`). On load, `body[data-in-season]` is set,
  CSS reorders the doors and standings cards so the in-season sport floats
  to the top, and an "In season" pill appears on its door. Manual switching
  is unchanged — both doors stay clickable.

## 2026-05-04 · `bugfix/digitalocean-deploy-fixes`

DigitalOcean App Platform refused the first deploy with two errors.

- **Symlink upload failure** at `poker-dealer/public/design-system`. DO doesn't
  follow symlinks during upload. Replaced the symlink with a `postinstall`
  script in `poker-dealer/package.json` that mirrors `design-system/` into
  `poker-dealer/public/design-system/` on `npm install`. The path is
  gitignored; Express still serves `/design-system/*` exactly as before.
- **Missing `404.html`**. Added one at the repo root using the design system
  (theme-links, MMP mark, "Back to the trophy" CTA).

## 2026-05-03 · `feature/mmp-unified-design-system`

Bootstrapped the unified MMP web property at `mmp.pelau.com`.

- Vendored the **MMP design system** (Fraunces / Inter Tight / JetBrains Mono;
  `theme-links` + `theme-felt`) into `design-system/` with shared `tokens.css`,
  `components.css`, assets, and 5 reference HTML kits.
- Renamed `MMPChallengeCup/` → `golf/`.
- Built a new **homepage** at the repo root: trophy hero, image-button doors to
  Poker and Golf, and an all-time standings strip that reads `golf/data/poker.json`
  and `golf/data/golf.json` on load to render real per-season champions. Golf
  shows an empty-state with the next scheduled round (course / organizer / tee
  times) until the first 2026 Links Cup card is entered.
- Re-skinned **golf SPA** (`golf/index.html`) and **score-entry**
  (`golf/score-entry.html`): inline `<style>` blocks replaced with shared
  design-system links + new `golf/styles.css` and `golf/score-entry.css` that
  re-implement every existing class name (`.tabs`, `.kpi`, `table.t`,
  `.events-strip`, `.empty`, `.player-card`, `.pc-counts`, `.summary-tile`, etc.)
  using design tokens. All renderer functions and form ids preserved verbatim —
  data flow, hash routing, points scoring, JSON download, and localStorage
  persistence untouched.
- Vendored `pelauimagineering/poker-dealer` into `poker-dealer/` (no submodule —
  history stripped). Added a relative symlink `poker-dealer/public/design-system
  → ../../design-system` so the same shared tokens are served by Express's static
  middleware. Removed iOS App Store leftovers (`WhatToTest.en-CA.txt`,
  `show my cards.png`).
- Re-skinned the **poker dealer** to felt theme by remapping `variables.css`
  values to design-system tokens while keeping every legacy variable name
  (`--color-primary`, `--color-bg-primary`, `--color-hearts`, `--spacing-md`, …)
  intact. Login, game, and community views gain the MMP wordmark and a
  "Switch to Golf →" cross-link. Server, WebSocket, dealer JS, and DB schema
  untouched.
- Added monorepo `.gitignore` and root `.htaccess` (DirectoryIndex + cache headers).
- Rewrote `README.md` for the new monorepo layout.
