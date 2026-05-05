# Release notes

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
