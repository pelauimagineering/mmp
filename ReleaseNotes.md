# Release notes

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
