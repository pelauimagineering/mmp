# Release Notes - Poker Dealer

## 2026-02-01 - feature/fix-seven-issues

### Bug Fixes and Enhancements

This release addresses 7 GitHub issues with bug fixes and new features:

#### Issue #18: Fixed "reveal/show cards" requiring refresh
- **Problem**: The slide-to-show cards feature required a page refresh between hands
- **Fix**: Reset `cardsAlreadyRevealed` flag when new cards are dealt and when slide control becomes visible
- **Files**: `public/js/game.js`

#### Issue #27: Show timer on /community display
- **Feature**: Blind level timer now visible on public community display page
- **Details**:
  - Added timer section HTML to community.ejs
  - Included timer.js script in community page
  - Added blinds display update logic
  - Timer and blinds sync with main game view
- **Files**: `views/community.ejs`, `public/js/community-display.js`, `server/websocket.js`

#### Issue #28: Improved slide-to-action controls
- **Changes**:
  - Removed text/emoji from slider buttons for cleaner appearance
  - Increased slider track minimum width (280px)
  - Increased activation threshold from 90% to 95% (requires fuller slide)
- **Files**: `views/game.ejs`, `public/css/game.css`, `public/js/game.js`

#### Issue #29: Added Shuffle Deck button for dealer
- **Feature**: Dealers can now manually shuffle the deck before dealing
- **Details**:
  - New "Shuffle Deck" button in dealer controls
  - Only available when cards are not dealt
  - Resets and shuffles deck without dealing
- **Files**: `views/game.ejs`, `public/js/dealer-controls.js`, `server/websocket.js`, `server/game-manager.js`, `server/game/poker-game.js`

#### Issue #30: Fixed player reorder freezing
- **Problem**: Drag-and-drop player reordering sometimes froze the UI
- **Fix**:
  - Clear stale drag state at start of list updates
  - Added error handling in drag/drop event handlers
  - Added debounce to prevent rapid-fire server updates
  - Improved cleanup on drag end
- **Files**: `public/js/game.js`

#### Issue #31: Added "Broke" player state (no chips)
- **Feature**: Dealers can mark players as "broke" (out of chips)
- **Details**:
  - 💸/💰 toggle button for dealer to mark/unmark players
  - Broke players show strikethrough name, red "BROKE" badge
  - Broke players are skipped when dealing cards
  - Broke players can still serve as dealer
  - State persists until toggled back or game reset
- **Files**: `server/game/poker-game.js`, `server/websocket.js`, `public/js/game.js`, `public/css/game.css`

#### Issue #32: Anyone can become dealer
- **Feature**: Dealer can now be changed between hands
- **Details**:
  - Click any player name to select as dealer (when cards not dealt)
  - "Random Dealer" button available between hands
  - Handles situations where current dealer leaves
- **Files**: `server/websocket.js`, `public/js/game.js`

### Technical Notes
- All changes are backward compatible with existing game state
- New broke player state is persisted to database
- WebSocket protocol extended with new message types: `shuffle-deck`, `toggle-player-broke`

---

## 2025-01-07 - feature/rename-join-game-button

### UI Changes
- Renamed "Join Game" button to "Next >" on the Select User login screen
- Added tap target to footer text "Made with 💕 in the 6ix" to refresh the page

## 2025-12-31 - feature/fold-button

### New Feature

#### Fold Button with Safety Switch (Issue #19)
- **Slide-to-Fold Control**: Players can fold their hand using a slide action
  - Red gradient slide track appears after cards are dealt
  - Must slide past 90% to confirm fold (prevents accidental folds)
  - Slide button uses 🃏 icon for clear visual distinction
  - Works on both desktop (mouse) and mobile (touch)

- **Folded State Visual Feedback**:
  - Folded players show "FOLDED" badge (gray) next to their name
  - Player item becomes semi-transparent with dashed border
  - Player name gets strikethrough styling
  - Hole cards section shows "You have folded" message

- **Game State Tracking**:
  - Fold state persists across page refreshes
  - All players see who has folded in real-time
  - Active player count tracked and broadcast
  - Fold state resets when hand completes

### Technical Details

#### Backend Changes
- Modified `server/game/poker-game.js`:
  - Added `foldedPlayers` Set to track folded players
  - Added `foldPlayer(userId)` method
  - Added `hasPlayerFolded(userId)` method
  - Added `getActivePlayerCount()` method
  - Updated `getGameState()` to include `hasFolded` flag per player
  - Updated `toJSON()` and `fromJSON()` for fold state persistence
  - Clear folded players in `completeHand()`

- Modified `server/websocket.js`:
  - Added `fold-hand` WebSocket message handler
  - Added `handleFoldHand()` function
  - Broadcasts `player-folded` notification to all clients

#### Frontend Changes
- Modified `views/game.ejs`:
  - Added slide-to-fold HTML component

- Modified `public/js/game.js`:
  - Added `fold-confirmed` and `player-folded` WebSocket handlers
  - Added `updateSlideToFoldControl()` function
  - Added slide-to-fold functionality (setupSlideToFold, startSlideFold, doSlideFold, endSlideFold)
  - Added `foldMyHand()` function
  - Updated player list to show folded badge and styling

- Modified `public/css/game.css`:
  - Added `.slide-to-fold-container` and related slide styles (red theme)
  - Added `.player-folded-badge` styling (gray)
  - Added `.player-item.is-folded` styling (opacity, dashed border)
  - Added `.folded-message` styling

### Usage
1. Cards must be dealt before fold option appears
2. Red "Slide to Fold" track appears below hole cards
3. Slide the button past 90% to confirm fold
4. Folded player's cards are hidden
5. Other players see the FOLDED badge
6. Fold state resets when hand completes

---

## 2025-12-31 - feature/manual-dealer-selection

### New Feature

#### Manual Dealer Selection (Issue #17)
- **Click-to-Select Dealer**: Players can now click directly on a player's name to select them as the dealer
  - Player items become clickable when no dealer has been selected
  - Visual feedback with dashed border and hover effects
  - Click transforms to solid border with slight slide animation

- **Random Dealer Option**: The "Random Dealer" button is still available
  - Renamed from "Choose Dealer" to "Random Dealer" for clarity
  - Randomly selects a dealer from all players in the game

- **Updated Hint Text**: New hint explains both options
  - "Click a player's name to select them as dealer, or use the button for random selection"

### Technical Details

#### Backend Changes
- Modified `server/game/poker-game.js`:
  - Added `selectDealerById(playerId)` method for manual dealer selection
  - Validates player exists in game before setting as dealer

- Modified `server/websocket.js`:
  - Added `select-dealer` WebSocket message handler
  - Added `handleSelectDealer()` function to process manual selection
  - Broadcasts dealer selection to all connected clients

#### Frontend Changes
- Modified `public/js/game.js`:
  - Added `selectPlayerAsDealer()` function
  - Updated `updatePlayersList()` to make players clickable when no dealer selected
  - Added click event listeners for dealer selection

- Modified `views/game.ejs`:
  - Renamed button from "Choose Dealer" to "Random Dealer"
  - Updated hint text to explain both selection methods

- Modified `public/css/game.css`:
  - Added `.selectable-dealer` class with dashed border
  - Added hover and active states with visual feedback
  - Smooth transition animations

### Usage
1. All players join the game
2. Before dealer is selected, player names have dashed green borders
3. Click any player's name to select them as dealer, OR
4. Click "Random Dealer" button for random selection
5. Once dealer is selected, player items are no longer clickable
6. Dealer rotation continues automatically for subsequent hands

---

## 2025-12-30 - feature/blind-level-tracking

### New Feature

#### Blind Level Tracking (Issue #21)
- **Blind Amount Display**: Shows current blind levels in the timer section
  - Displays "Blinds: X/Y" format (e.g., "Blinds: 1/2")
  - Blinds start at 1/2 by default
  - Golden color styling for visibility

- **Automatic Blind Increases**:
  - Blinds double when the 7-minute timer expires
  - Timer resets to 7:00 when blinds increase
  - Example progression: 1/2 → 2/4 → 4/8 → 8/16 → etc.

- **Player Position Indicators**:
  - SB (Small Blind) badge - Blue color
  - BB (Big Blind) badge - Orange color
  - D (Dealer) badge - Green color (existing)
  - Badges appear next to player names in the player list
  - Positions update automatically when dealer rotates

- **Heads-Up Support**:
  - In 2-player games, dealer posts small blind (standard heads-up rules)
  - With 3+ players, SB is left of dealer, BB is left of SB

### Technical Details

#### Backend Changes
- Modified `database/schema.sql`:
  - Added `small_blind` (INTEGER DEFAULT 1)
  - Added `big_blind` (INTEGER DEFAULT 2)

- Modified `scripts/init-db.js`:
  - Added migration for blind columns

- Modified `server/db.js`:
  - Added blind fields to get/update/reset operations

- Modified `server/game-manager.js`:
  - Added `smallBlind` and `bigBlind` properties
  - Modified `dealCards()` to double blinds and reset timer when `blindsWillIncrease` is true
  - Added blinds to `getGameState()` response
  - Reset blinds to 1/2 in `resetGame()`

- Modified `server/game/poker-game.js`:
  - Added `getSmallBlindIndex()` method
  - Added `getBigBlindIndex()` method
  - Added `isSmallBlind` and `isBigBlind` flags to player state

#### Frontend Changes
- Modified `views/game.ejs`:
  - Added blinds display in timer section

- Modified `public/js/game.js`:
  - Added `updateBlindsDisplay()` function
  - Added SB/BB badges to player list

- Modified `public/css/game.css`:
  - Added `.blinds-display` and `.blinds-amount` styles
  - Added `.player-sb-badge` (blue) and `.player-bb-badge` (orange) styles

### Usage
1. Start a game with 2+ players
2. Select dealer - SB and BB badges appear
3. Deal cards - timer starts, blinds show 1/2
4. When timer expires, blinds will double on next deal
5. New deal doubles blinds (2/4) and resets timer

---

## 2025-12-29 - feature/timer-7-minute

### New Feature

#### Blind Level Timer
- **7-Minute Countdown Timer**: Tournament-style timer that tracks blind level duration
  - Timer starts when cards are first dealt
  - Displays countdown visible to all players
  - Shows "Blind Level" label with MM:SS format
  - Timer persists across page refreshes (stored in database)

- **Visual Feedback**:
  - Timer turns yellow and pulses when under 1 minute remaining
  - Timer turns red with faster pulse when under 30 seconds
  - Alert message flashes when timer expires: "Blinds will increase next hand!"

- **Timer Behavior**:
  - Starts automatically on first deal
  - Continues running through all phases (pre-flop, flop, turn, river)
  - When expired, sets flag that blinds will increase
  - Flag resets on next deal (blind increase handled by future issue #21)
  - Game reset clears timer completely

### Technical Details

#### Backend Changes
- Modified `database/schema.sql`:
  - Added `timer_start_time` (TEXT) - ISO timestamp when timer started
  - Added `timer_duration_seconds` (INTEGER) - Duration in seconds (default 420 = 7 min)
  - Added `blinds_will_increase` (INTEGER) - Flag for blind level up

- Modified `scripts/init-db.js`:
  - Added migration to add timer columns to existing databases

- Modified `server/db.js`:
  - Updated gameStateOps to include timer fields in get/update/reset operations

- Modified `server/game-manager.js`:
  - Added timer state properties and constants
  - Added `getTimerState()` method for timer calculations
  - Added `checkAndUpdateTimerExpiration()` for expiration detection
  - Modified `dealCards()` to start timer on first deal
  - Modified `getGameState()` to include timer state
  - Modified `resetGame()` to clear timer state

- Modified `server/websocket.js`:
  - Added timer check interval (every 1 second)
  - Added `timer-expired` WebSocket message type
  - Included timer state in all game state broadcasts

#### Frontend Changes
- Created `public/js/timer.js`:
  - `BlindTimer` class for managing countdown display
  - Local countdown with server time sync
  - Warning threshold detection (1 min, 30 sec, 10 sec)

- Modified `views/game.ejs`:
  - Added timer section HTML below phase indicator
  - Included timer.js script

- Modified `public/js/game.js`:
  - Added `timer-expired` WebSocket handler
  - Integrated `blindTimer.update()` in `updateUI()`

- Modified `public/css/game.css`:
  - Added `.timer-section` styling with gradient background
  - Added `.timer-countdown` with monospace font
  - Added `.timer-warning` and `.timer-critical` states
  - Added `.timer-alert` with flash animation
  - Added pulse keyframe animations

### Usage
1. Join game and have dealer selected
2. Dealer clicks "Deal Cards" - timer starts
3. Timer counts down from 7:00
4. At 1 minute: timer turns yellow and pulses
5. At 30 seconds: timer turns red with faster pulse
6. At 0:00: alert message appears "Blinds will increase next hand!"
7. Next deal resets the alert (future: blinds double)

---

## 2025-12-01 - feature/reset-phrase-env-variable

### Enhancement

#### Configurable Reset Challenge Phrase
- **Environment Variable Configuration**: Reset challenge phrase is now configurable via environment variable
  - Game reset functionality previously used hardcoded challenge phrase "milliken mills posse"
  - Now reads from `RESET_PHRASE` environment variable for flexibility
  - Maintains backward compatibility with default value if environment variable is not set
  - Allows production deployments to use custom reset phrase via Digital Ocean App Platform
  - Improves security by allowing different phrases per environment

### Technical Details

#### Backend Changes
- Modified `server/routes/game.js`:
  - Line 6: Changed from hardcoded string to `process.env.RESET_PHRASE || 'milliken mills posse'`
  - Maintains same case-insensitive validation logic
  - No breaking changes to API endpoint behavior

#### Environment Configuration
- Updated `.env` file:
  - Added `RESET_PHRASE` environment variable under "Game Reset Configuration" section
  - Default value: "milliken mills posse" for local development
  - Production deployments should set this via Digital Ocean App Platform dashboard

### Usage
- **Local Development**: Set `RESET_PHRASE` in `.env` file
- **Production**: Configure via Digital Ocean App Platform environment variables dashboard
- **Default Behavior**: If not configured, falls back to "milliken mills posse"

---

## 2025-11-27 - feature/video-toggle-control

### New Feature

#### Video Section Toggle
- **Show/Hide Video Control**: Added toggle checkbox to show/hide the Jitsi video conference section
  - Video section is hidden by default when the page loads
  - "Show Video" checkbox in the header controls visibility
  - When checked, the video conference section appears
  - When unchecked, the video section is hidden
  - Improves page performance by allowing users to hide video when not needed

### Technical Details

#### Frontend Changes
- Modified `public/css/game.css`:
  - Added `display: none` to `.game-room-section` to hide by default
  - Added `.game-room-section.visible` class to show when toggled
  - Updated comment from "Join Game Section" to "Video Room Section"

- Modified `public/js/game.js`:
  - Added `setupVideoToggle()` function to handle checkbox changes
  - Listens for changes on `#toggle-video` checkbox
  - Toggles `.visible` class on `.game-room-section` element
  - Added console logging for debugging
  - Integrated into main `init()` function

### Usage
1. Load the game page
2. Video section is hidden by default
3. Click "Show Video" checkbox to reveal the Jitsi video conference
4. Uncheck to hide the video section again

---

## 2025-11-27 - feature/logout-player-removal-and-dealer-selection

### New Features

#### Player Removal on Logout
- **Automatic Player Cleanup**: When a user logs out, they are automatically removed from the active game
  - Prevents logged-out users from being accidentally selected as dealer
  - Game state updates in real-time for all remaining players
  - Ensures player list accurately reflects currently active players

#### Manual Dealer Selection
- **"Choose Dealer" Button**: Added new UI control for manual dealer selection
  - Located in the Players section of the game interface
  - Randomly selects the first dealer from all currently logged-in players
  - Button is enabled only when:
    * At least one player has joined the game
    * No dealer has been selected yet
    * No cards have been dealt
  - Once clicked, the button becomes permanently disabled
  - Button remains disabled for all subsequent hands until server restart with `--reset` flag
  - Automatic dealer rotation for subsequent hands continues to work as before

### Technical Details

#### Backend Changes
- Modified `server/routes/auth.js`:
  - Updated logout endpoint to validate session before deletion
  - Added call to `removePlayerFromGame()` during logout process

- Modified `server/websocket.js`:
  - Added `removePlayerFromGame()` function to handle player removal
  - Added `handleChooseDealer()` WebSocket message handler
  - Added validation to prevent re-selection of dealer after initial choice
  - Added 'choose-dealer' message type to WebSocket switch
  - Broadcasts game state updates when players leave or dealer is selected

- Modified `server/game-manager.js`:
  - Removed automatic dealer selection when first player joins
  - Allows manual dealer selection via "Choose Dealer" button

#### Frontend Changes
- Modified `public/game.html`:
  - Added "Choose Dealer" button in Players section
  - Added hint text explaining button functionality

- Modified `public/css/game.css`:
  - Added `.choose-dealer-section` styling with proper spacing and borders
  - Added `.choose-dealer-hint` styling for instructional text
  - Added disabled state styling for the button

- Modified `public/js/game.js`:
  - Added `chooseDealer()` function to send WebSocket message
  - Added `updateChooseDealerButton()` function to manage button state
  - Added event listener for button clicks
  - Added 'dealer-selected' WebSocket message handler
  - Integrated button state updates into main `updateUI()` flow

### What Gets Updated
- **Player List**: Automatically updated when players log out
- **Dealer Selection**: Manual control for first dealer, automatic rotation thereafter
- **Game State**: Real-time synchronization across all connected clients

### Usage
1. Start server normally or with `--reset` flag for clean state
2. Players login and join the game
3. Any player can click "Choose Dealer" to randomly select first dealer
4. Button becomes disabled after selection
5. Game proceeds with automatic dealer rotation for subsequent hands

---

## 2025-11-27 - feature/colored-suit-symbols

### Enhancement
- **Colored Suit Symbols**: Card suit symbols (♥ ♦ ♣ ♠) now display in their appropriate colors
  - Hearts and Diamonds: Red (#e74c3c)
  - Clubs and Spades: Black (#2c3e50)
  - Applies to all card displays including:
    - Player hole cards
    - Community cards on game view
    - Public community cards display

### Technical Details
- Modified `public/css/cards.css` to apply suit-specific colors to both rank and suit symbols
- Leverages existing CSS variable system for consistent theming
- No changes required to JavaScript card rendering logic
## 2025-11-27 - feature/reset-game-parameter

### New Feature
- **Reset Command Line Flag**: Added `--reset` parameter for clean server startup
  - Clears all game state (players, cards, dealer position, game phase)
  - Logs out all users by clearing all active sessions
  - Useful for starting fresh game sessions or testing scenarios

### Usage
```bash
# Using npm script
npm run start:reset

# Direct node command
node server/index.js --reset
```

### What Gets Reset
- **Game State**: All players removed, cards cleared, dealer position reset, phase set to 'waiting'
- **User Sessions**: All active sessions deleted, forcing all users to log in again
- **Database**: Only sessions and game_state tables affected; user accounts remain intact

### Technical Details
- Added `deleteAll()` method to session operations in `server/db.js`
- Modified `server/index.js` to detect `--reset` flag via `process.argv`
- Reset operations execute before server starts listening
- Added `start:reset` npm script in `package.json`
- Updated README.md with reset documentation

---

## 2025-11-26 - feature/poker-dealer-app

### Initial Release
Complete Texas Hold'em digital dealer application with the following features:

#### Core Functionality
- Support for up to 10 simultaneous players
- Real-time WebSocket communication for instant updates
- Automatic dealer rotation after each hand
- Mobile-responsive design for phones and tablets
- Public community cards display (no authentication required)

#### Authentication & Sessions
- Simple email/password authentication
- 10 pre-configured test accounts
- httpOnly session cookies for security
- 24-hour session duration

#### Game Features
- Deal hole cards (2 per player, visible only to owner)
- Deal community cards (5 cards, revealed progressively)
- Dealer controls for card dealing and revealing
- Phases: Pre-Flop → Flop (3 cards) → Turn (1 card) → River (1 card)
- Player order based on join sequence
- Random initial dealer selection

#### Bug Fixes Applied
- Fixed cookie path issue preventing session persistence
- Fixed httpOnly cookie access for WebSocket authentication
- Fixed login infinite loop caused by automatic redirects
- Added proper fetch credentials for cookie support
- Changed sameSite policy from 'strict' to 'lax'

### Technology Stack
- Backend: Node.js with Express
- WebSocket: ws library
- Database: SQLite (embedded)
- Frontend: Vanilla HTML, CSS, and JavaScript
- Deployment: Docker containerization
