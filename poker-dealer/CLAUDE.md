# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A digital card dealer for in-person Texas Hold'em poker sessions. Players join via mobile/desktop devices for real-time game updates. Betting is handled in-person (outside the app).

## Commands

```bash
# Development
npm install          # Install dependencies
npm run db:init      # Initialize SQLite database (first time setup)
npm run build        # Build the React client into public/app (required before start)
npm run build:watch  # Rebuild the client on every change
npm start            # Start server (http://localhost:3000)
npm test             # Sync regression tests (real server, scratch DB)
npm run start:reset  # Start with clean state (clears game + sessions)
npm run dev          # Development mode with watch

# Docker
docker-compose up -d                                    # Start containerized
docker-compose exec poker-dealer node scripts/init-db.js  # Init DB in container
```

## Architecture

### Server-Side (Node.js/Express)
- `server/index.js` - Express app entry point, routes, session validation
- `server/websocket.js` - WebSocket server handling all real-time game communication
- `server/game-manager.js` - Game state orchestration, timer/blind management, persistence
- `server/game/poker-game.js` - Core Texas Hold'em logic (dealing, phases, player actions)
- `server/game/deck.js` - Card/Deck classes with shuffle implementation
- `server/db.js` - SQLite operations (users, sessions, game_state)
- `server/auth.js` - Session-based authentication

### Client-Side (React 19 + Tailwind 4, built with Vite)
- `client/src/main.jsx` - Entry; mounts the page named in the server's boot data
- `client/src/pages/` - `Login.jsx`, `Game.jsx`, `Community.jsx`
- `client/src/components/` - Playing cards, board, blind clock, slide-to-confirm, drawers, dialogs
- `client/src/lib/connection.js` - Self-healing WebSocket (endless backoff, heartbeat, resync on wake)
- `client/src/lib/useTable.js` - Live table state hook; the UI renders only from server snapshots
- `client/src/lib/demo.js` - In-browser sample table for `?demo=<scene>`
- `client/src/styles/app.css` - Tailwind theme; the tokens from `design-system/MASTER.md`

### Views (EJS)
- `views/app.ejs` - One HTML shell for every page. The server embeds boot data
  (page, user, video token) and links the hashed bundle from the Vite manifest.

### Design system
- `design-system/MASTER.md` is the source of truth; `design-system/pages/*.md` override it per page.
- Read both before changing UI. Tokens live in `client/src/styles/app.css`; never hard-code a hex in a component.

## Key Patterns

### WebSocket Messages
Client sends: `auth`, `ping`, `get-state`, `join-game`, `deal-cards`, `flip-community-card`, `show-my-cards`, `fold-hand`, `select-dealer`, `reorder-players`

Server sends: `game-state`, `community-state`, `pong`, `authenticated`, `cards-dealt`, `community-revealed`, `player-folded`, `timer-expired`

### Game State Flow
1. Players join (`waiting` phase, dealerIndex = -1)
2. Dealer selected (manually by clicking player or randomly)
3. Cards dealt (`pre-flop` phase, 2 hole cards each + 5 community face-down)
4. Dealer flips: `pre-flop` -> `flop` (3 cards) -> `turn` (1) -> `river` (1) -> `complete`
5. On complete: hands cleared, revealed/folded reset, dealer rotates clockwise

### Staying in sync
- The server keeps a *set* of sockets per user. Never key one socket per user:
  a replaced socket's late `close` would evict the live one.
- Every snapshot carries `version` (rising) and `serverTime`. Clients drop
  older snapshots and correct the blind clock for device clock skew.
- The server pings every 25s and terminates dead sockets; it closes all
  sockets on SIGTERM so clients move to the new instance.
- The client never applies optimistic state. It reconnects forever, resyncs
  on visibility/focus/online, and pulls a snapshot every 20s as a safety net.

### State Persistence
Game state serialized to SQLite via `GameManager.saveGameState()`. Restored on server restart via `PokerGame.fromJSON()`.

### Blind Timer
- 7-minute countdown per blind level (TIMER_DURATION_SECONDS = 420)
- `blindsWillIncrease` flag set when timer expires
- Blinds double on next deal, timer resets

## Database Schema

Three tables in SQLite:
- `users` - id, display_name, user_name
- `sessions` - token-based auth with expiry
- `game_state` - Single row (id=1), stores deck_state as JSON, timer fields, blind levels

## Public Endpoints

- `/` - Login page
- `/game` - Authenticated game view
- `/community` - Public community cards (no auth, for shared TV display)
- Add `?demo=<scene>` to any page for sample data (`lobby`, `waiting`, `preflop`, `flop`, `turn`, `river`, `showdown`, `dealer`, `blindsup`)
- `/api/health` - Health check
