# MMP — Bound by Brotherhood

The MMP Challenge Cup web property. One trophy, two games,
guys, since 2008.

This monorepo ships **three deployable surfaces** under one shared design system:

| Surface | Path | What it is | Theme |
|---|---|---|---|
| **Homepage** | `/` | Trophy hero + image-button doors to Poker and Golf, with a real all-time standings strip read from the JSON data files | `theme-links` |
| **Golf** | `/golf/` | Hash-routed leaderboard SPA + mobile score-entry. Points-based scoring (5/1/3/10/20/25/3 attendance/par/birdie/eagle/albatross/HIO/low-round). Same data model, JSON loaders, and renderers — visual layer re-skinned. | `theme-links` |
| **Poker** | `poker-dealer/` (deploys to `poker.pelau.com`) | Vendored from [pelauimagineering/poker-dealer](https://github.com/pelauimagineering/poker-dealer). Node/Express + WebSocket Texas Hold'em dealer. Re-skinned via remapped `variables.css`; server, JS, and DB untouched. | `theme-felt` |

## Layout

```
mmp/
├── index.html                  Homepage
├── design-system/              Shared tokens, components, assets
│   ├── tokens.css              Colors, type, spacing, motion (theme-links + theme-felt)
│   ├── components.css          Buttons, cards, leaderboard rows, plaques, timers, etc.
│   ├── assets/                 mmp-mark.svg, mmp-lockup.svg, trophy.jpg
│   ├── reference/              The 5 design-kit HTML pages — crib from these
│   └── SKILL.md                In-repo design rules
├── golf/                       Static SPA + mobile score entry
│   ├── index.html              Hash-routed leaderboard (`#/poker`, `#/golf`, etc.)
│   ├── score-entry.html        Mobile golf round entry, downloads updated golf.json
│   ├── styles.css              Golf-specific layout, token-driven
│   ├── score-entry.css         Score-entry styles, token-driven
│   ├── data/                   poker.json, golf.json, players.json
│   └── scripts/build_poker.py  xlsx → poker.json
└── poker-dealer/               Vendored Node/Express WebSocket app
    ├── server/                 Untouched — Express, WebSocket, SQLite, JWT
    ├── views/{game,community}.ejs   Re-skinned headers + body classes
    ├── public/login.html       Re-skinned
    ├── public/css/             Existing CSS files; variables.css re-bound to design tokens
    ├── public/design-system → ../../design-system  (symlink)
    └── ...
```

## Design system

`design-system/tokens.css` defines two themes:

- **`.theme-links`** — light editorial parchment, fairway-green primary. For homepage and golf.
- **`.theme-felt`** — dark casino, poker-green primary, gold accent. For poker.

`design-system/components.css` provides shared UI: `.btn` family, `.card-pc` playing cards,
`.player-row` (with `leader-1` modifier), `.leader-row`, `.plaque`, `.timer-card`,
`.slide-track`, `.appbar`, `.panel`, `.chip`, `.scorecard`.

Type stack: **Fraunces** (display) + **Inter Tight** (UI) + **JetBrains Mono** (numerics).

Read `design-system/SKILL.md` before designing for any MMP surface.

## Local preview

Two terminals — homepage and golf are static, poker is a Node service.

```bash
# Terminal 1 — homepage + golf + design-system reference
cd /path/to/mmp && python3 -m http.server 8000
# → http://localhost:8000/                        homepage
# → http://localhost:8000/golf/                   golf SPA
# → http://localhost:8000/golf/score-entry.html   golf score entry
# → http://localhost:8000/design-system/reference/ design kits

# Terminal 2 — poker (one-time DB init, then run)
cd poker-dealer
npm install
npm run db:init
npm start
# → http://localhost:3000/         login
# → http://localhost:3000/game     dealer view (after login, requires JWT env vars)
# → http://localhost:3000/community community display (requires JWT_COMMUNITY)
```

## Deployment

Production layout (assumed):

- **`mmp.pelau.com`** → Apache vhost, `DocumentRoot` is this repo's root.
  Existing `golf/.htaccess` keeps JSON cached 5 min and `score-entry.html`
  out of search engines. Root `.htaccess` handles `DirectoryIndex` + cache headers.
- **`poker.pelau.com`** → Apache vhost reverse-proxying to Node on `:3000`,
  with WebSocket upgrade rewrite. `systemd` unit runs `node poker-dealer/server/index.js`.
- The shared `design-system/` is served by Apache for the main host. The
  poker subdomain serves its own copy via the symlink + Express's static
  middleware. Both surfaces resolve `/design-system/*` independently.

See `poker-dealer/DEPLOYMENT.md` for the Node side specifics.

## Updating data

### Poker (once a month, Nov–Apr)

```bash
python3 golf/scripts/build_poker.py    # picks the most recent MMP Poker*.xlsx
scp golf/data/poker.json user@host:/var/www/mmp/golf/data/
```

### Golf (during season, multiple rounds per week)

After a round, open `https://mmp.pelau.com/golf/score-entry.html` on your phone,
fill in each player's gross + counts, tap **Save round & download golf.json**,
and replace `golf/data/golf.json` on the server.

### Adding a player or changing handicaps

Edit `golf/data/players.json` and re-upload. The roster is shared across both
sports; `sports: ["golf", "poker"]` controls who appears where.

## Browser support

The design system uses `color-mix()` for tinted backgrounds and modern font
loading. Tested on Safari 16.2+ and Chrome 111+. Older browsers will see solid
fallback colors but everything functional still works.
