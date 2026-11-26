# MMP Challenge Cup — Web App

A static, JSON-driven leaderboard site for the MMP Challenge Cup: golf (Links Cup, summer) and poker (winter). No backend, no build step.

## What's in the box

```
MMP Challenge Sup/                       # workspace folder ("Sup" is a typo — the project is "Cup")
├── index.html                           # the public site (single-page, hash-routed)
├── score-entry.html                     # mobile-friendly admin page for golf rounds
├── robots.txt                           # keeps score-entry / admin out of search results
├── data/
│   ├── poker.json                       # poker data, all seasons
│   ├── golf.json                        # golf data, current and past seasons
│   └── players.json                     # shared roster (with current handicaps)
├── scripts/
│   └── build_poker.py                   # poker xlsx → poker.json
├── INFORMATION_ARCHITECTURE.md          # design doc (not deployed)
├── data/findings.md                     # data analysis (not deployed)
├── mockup.html                          # design mockup (not deployed)
└── MMP Poker Final 2025-26.xlsx         # source of truth for poker (not deployed)
```

## Deploying to a static web server

The site is a folder of static files. Drop it under your document root.

### What to upload

```
index.html
score-entry.html
robots.txt
data/poker.json
data/golf.json
data/players.json
```

That's the whole production payload — about **140 KB** before gzip.

### What NOT to upload

`mockup.html`, `INFORMATION_ARCHITECTURE.md`, `data/findings.md`, `scripts/`, the `*.xlsx` source files. They're either superseded, internal, or sensitive enough that they don't belong on the public web.

A safe `rsync` recipe from the project root:

```bash
rsync -av --delete \
  --include='index.html' \
  --include='score-entry.html' \
  --include='robots.txt' \
  --include='data/' \
  --include='data/poker.json' \
  --include='data/golf.json' \
  --include='data/players.json' \
  --exclude='*' \
  ./ user@host:/var/www/mmp/
```

For cPanel / SFTP, just upload the six files (and the `data/` folder) by hand.

### Apache / cPanel

A minimal `.htaccess` (optional but tidy) goes in the same folder as `index.html`:

```apache
# Serve JSON with the right MIME type
AddType application/json .json

# Cache static data files for 5 minutes (long enough for browsing, short enough that updates land fast)
<FilesMatch "\.(json)$">
  Header set Cache-Control "max-age=300"
</FilesMatch>

# Default cache for HTML — short, since you'll be redeploying often
<FilesMatch "\.(html)$">
  Header set Cache-Control "max-age=60"
</FilesMatch>

# Hide score-entry from being too discoverable
<Files "score-entry.html">
  Header set X-Robots-Tag "noindex, nofollow"
</Files>
```

### Nginx

Equivalent server block snippet:

```nginx
location ~ \.json$ {
  add_header Cache-Control "max-age=300";
  types { application/json json; }
}
location = /score-entry.html {
  add_header X-Robots-Tag "noindex, nofollow";
}
```

### Routing

The site uses hash routing (`#/poker/2025-26`, `#/golf/2026`, etc.), so no server rewrite rules are needed. Every URL is the same `index.html`.

## Updating scores

### Poker (once a month, Nov–Apr)

Open `poker-entry.html` on your phone (or tap
**Enter results** / **Plan a night** on the poker leaderboard):

- **Plan a game night**: date, start time, host. It shows up on the homepage
  and the schedule straight away. A planned night can be changed or cancelled.
- **Enter results**: tap who came, then for each game tap the winner once and
  the runner-up twice (tied? mark them both). The points work themselves out:
  2 for showing up, 10 a win, 5 a runner-up, ties split.
- **Fix a past night**: reopens it on the review screen.

Saves queue on the phone and sync to Supabase (same passphrase as golf) when
there's signal. `golf/data/poker.json` and `scripts/build_poker.py` are now
the fallback and the record of the spreadsheet era — the leaderboard reads
them only when the database can't be reached.

### Golf (during the season, multiple rounds per week)

Open `score-entry.html` — a guided wizard designed for phones:

- **Plan a future round**: date + course, done. No scores needed until game day.
- **Enter scores**: pick who played, then one screen per player (gross + big − / + steppers for pars, birdies, etc.). Handicaps pre-fill from the running-handicap engine.
- **Fix a past round**: opens on a review screen; tap a player to correct them.

Saves queue locally and sync to Supabase (passphrase-gated) whenever there's signal, so the page works fully offline at the course. The live leaderboard updates itself — no file uploads.

### Adding a new player or changing handicaps

Edit `data/players.json` and re-upload. The roster is shared across both sports; `sports: ["golf", "poker"]` controls who appears where.

## Updating the leaderboard you see in production

Browser caching on the JSON is set to 5 minutes by the suggested `.htaccess`. To force a refresh, add `?v=` query strings or hard-reload. The `index.html` itself uses `cache: "no-store"` on its fetches so the data is always fresh on a true page reload.

## Local preview

```bash
cd "MMP Challenge Sup"
python3 -m http.server 8000
# open http://localhost:8000
```

Anything that uses `fetch()` (which is everything on the public site) needs an HTTP server — `file://` won't work for the JSON loading.
