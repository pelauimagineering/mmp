# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A digital card dealer for in-person Texas Hold'em poker sessions. Players join via mobile/desktop devices for real-time game updates. Betting is handled in-person (outside the app).

## Commands

```bash
# Development
npm install          # Install dependencies
npm run db:init      # Initialize SQLite database (first time setup)
npm start            # Start server (http://localhost:3000)
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

### Client-Side (Vanilla JS)
- `public/js/game.js` - Main game UI, player interactions, card rendering
- `public/js/websocket-client.js` - WebSocket client wrapper
- `public/js/timer.js` - Blind level countdown timer
- `public/js/dealer-controls.js` - Dealer-specific controls
- `public/js/community-display.js` - Public community cards view

### Views (EJS templates)
- `views/game.ejs` - Authenticated player view
- `views/community.ejs` - Public display (no auth, shows community cards on TV)

## Key Patterns

### WebSocket Messages
Client sends: `auth`, `join-game`, `deal-cards`, `flip-community-card`, `show-my-cards`, `fold-hand`, `select-dealer`, `reorder-players`

Server sends: `game-state`, `authenticated`, `cards-dealt`, `community-revealed`, `player-folded`, `timer-expired`

### Game State Flow
1. Players join (`waiting` phase, dealerIndex = -1)
2. Dealer selected (manually by clicking player or randomly)
3. Cards dealt (`pre-flop` phase, 2 hole cards each + 5 community face-down)
4. Dealer flips: `pre-flop` -> `flop` (3 cards) -> `turn` (1) -> `river` (1) -> `complete`
5. On complete: hands cleared, revealed/folded reset, dealer rotates clockwise

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
- `/api/health` - Health check
