const { PokerGame } = require('./game/poker-game');
const db = require('./db');

const TIMER_DURATION_SECONDS = 420; // 7 minutes
const DEFAULT_SMALL_BLIND = 1;
const DEFAULT_BIG_BLIND = 2;
const MAX_SMALL_BLIND = 64;
const MAX_BIG_BLIND = 128;

class GameManager {
    constructor() {
        this.game = new PokerGame();
        this.timerStartTime = null;
        this.timerDurationSeconds = TIMER_DURATION_SECONDS;
        this.blindsWillIncrease = false;
        this.timerPaused = false;
        this.timerRemainingWhenPaused = null;
        this.smallBlind = DEFAULT_SMALL_BLIND;
        this.bigBlind = DEFAULT_BIG_BLIND;
        this.loadGameState();
    }

    loadGameState() {
        console.log('Loading game state from database...');

        db.gameState.get((err, gameState) => {
            if (err) {
                console.error('Error loading game state:', err);
                return;
            }

            if (gameState && gameState.deck_state) {
                this.game = PokerGame.fromJSON(gameState.deck_state);
                console.log(`Loaded game state: ${this.game.players.length} players, phase: ${this.game.phase}`);

                // Load timer state
                this.timerStartTime = gameState.timer_start_time || null;
                this.timerDurationSeconds = gameState.timer_duration_seconds || TIMER_DURATION_SECONDS;
                this.blindsWillIncrease = gameState.blinds_will_increase || false;
                console.log(`Timer state: startTime=${this.timerStartTime}, blindsWillIncrease=${this.blindsWillIncrease}`);

                // Load pause state
                this.timerPaused = gameState.timer_paused || false;
                this.timerRemainingWhenPaused = gameState.timer_remaining_when_paused != null ? gameState.timer_remaining_when_paused : null;
                console.log(`Pause state: paused=${this.timerPaused}, remaining=${this.timerRemainingWhenPaused}`);

                // Load blind levels
                this.smallBlind = gameState.small_blind || DEFAULT_SMALL_BLIND;
                this.bigBlind = gameState.big_blind || DEFAULT_BIG_BLIND;
                console.log(`Blind levels: ${this.smallBlind}/${this.bigBlind}`);
            } else {
                console.log('No saved game state, starting fresh');
            }
        });
    }

    saveGameState() {
        console.log('Saving game state to database...');

        const gameState = {
            current_dealer_index: this.game.dealerIndex,
            player_order: this.game.players.map(p => p.id),
            deck_state: this.game,
            community_cards: this.game.communityCards,
            phase: this.game.phase,
            cards_dealt: this.game.cardsDealt,
            timer_start_time: this.timerStartTime,
            timer_duration_seconds: this.timerDurationSeconds,
            blinds_will_increase: this.blindsWillIncrease,
            small_blind: this.smallBlind,
            big_blind: this.bigBlind,
            timer_paused: this.timerPaused,
            timer_remaining_when_paused: this.timerRemainingWhenPaused
        };

        db.gameState.update(gameState, (err) => {
            if (err) {
                console.error('Error saving game state:', err);
            }
        });
    }

    addPlayer(userId, userName) {
        const added = this.game.addPlayer(userId, userName);

        if (added) {
            // Don't automatically select dealer - let users choose manually
            // Dealer rotation happens automatically after each hand completes
            this.saveGameState();
        }

        return added;
    }

    removePlayer(userId) {
        this.game.removePlayer(userId);
        this.saveGameState();
    }

    // Issue #29: Shuffle deck without dealing
    shuffleDeck() {
        if (this.game.cardsDealt) {
            throw new Error('Cannot shuffle deck while cards are dealt');
        }
        this.game.shuffleDeck();
        this.saveGameState();
    }

    dealCards() {
        // Auto-resume paused timer before dealing
        if (this.timerPaused) {
            this.resumeTimer();
        }

        this.game.dealCards();

        // Start timer on first deal if not already running and below max blinds
        if (!this.timerStartTime && !this.blindsWillIncrease && this.smallBlind < MAX_SMALL_BLIND) {
            this.timerStartTime = new Date().toISOString();
            console.log(`Timer started at: ${this.timerStartTime}`);
        }

        // Double blinds and reset timer if blinds_will_increase flag is set
        if (this.blindsWillIncrease) {
            if (this.smallBlind < MAX_SMALL_BLIND) {
                this.smallBlind *= 2;
                this.bigBlind *= 2;
                console.log(`Blinds increased to: ${this.smallBlind}/${this.bigBlind}`);
            } else {
                console.log(`Blinds already at max: ${this.smallBlind}/${this.bigBlind}`);
            }

            // Only restart timer if blinds can still increase
            if (this.smallBlind < MAX_SMALL_BLIND) {
                this.timerStartTime = new Date().toISOString();
                console.log(`Timer reset for new blind level at: ${this.timerStartTime}`);
            }

            this.blindsWillIncrease = false;
        }

        this.saveGameState();
    }

    flipCommunityCard() {
        // Auto-resume paused timer before flipping
        if (this.timerPaused) {
            this.resumeTimer();
        }

        console.log(`Flipping community card, current phase: ${this.game.phase}`);

        switch (this.game.phase) {
            case 'pre-flop':
                this.game.revealFlop();
                break;
            case 'flop':
                this.game.revealTurn();
                break;
            case 'turn':
                this.game.revealRiver();
                break;
            case 'river':
                this.game.completeHand();
                break;
            default:
                throw new Error(`Cannot flip card in phase: ${this.game.phase}`);
        }

        this.saveGameState();
    }

    getGameState(forUserId = null) {
        const state = this.game.getGameState(forUserId);

        // Add timer state to game state
        state.timerState = this.getTimerState();

        // Add blind levels to game state
        state.blinds = {
            small: this.smallBlind,
            big: this.bigBlind
        };

        return state;
    }

    getTimerState() {
        if (this.timerPaused) {
            return {
                isRunning: false,
                isPaused: true,
                startTime: null,
                durationSeconds: this.timerDurationSeconds,
                remainingSeconds: this.timerRemainingWhenPaused || this.timerDurationSeconds,
                expired: false,
                blindsWillIncrease: this.blindsWillIncrease
            };
        }

        if (!this.timerStartTime) {
            return {
                isRunning: false,
                isPaused: false,
                startTime: null,
                durationSeconds: this.timerDurationSeconds,
                remainingSeconds: this.timerDurationSeconds,
                expired: false,
                blindsWillIncrease: this.blindsWillIncrease
            };
        }

        const startTime = new Date(this.timerStartTime);
        const now = new Date();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const remainingSeconds = Math.max(0, this.timerDurationSeconds - elapsedSeconds);
        const expired = remainingSeconds === 0;

        return {
            isRunning: true,
            isPaused: false,
            startTime: this.timerStartTime,
            durationSeconds: this.timerDurationSeconds,
            remainingSeconds: remainingSeconds,
            expired: expired,
            blindsWillIncrease: this.blindsWillIncrease
        };
    }

    checkAndUpdateTimerExpiration() {
        if (this.timerPaused) {
            return false;
        }

        const timerState = this.getTimerState();

        if (timerState.expired && !this.blindsWillIncrease) {
            console.log('Timer expired! Blinds will increase on next deal.');
            this.blindsWillIncrease = true;
            this.timerStartTime = null; // Pause timer until next deal
            this.saveGameState();
            return true; // Timer just expired
        }

        return false;
    }

    canJoinGame() {
        return !this.game.cardsDealt && this.game.players.length < 10;
    }

    isDealer(userId) {
        const dealer = this.game.getCurrentDealer();
        return dealer && dealer.id === userId;
    }

    pauseTimer() {
        if (this.timerPaused || !this.timerStartTime) {
            return;
        }

        const startTime = new Date(this.timerStartTime);
        const now = new Date();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const remaining = Math.max(0, this.timerDurationSeconds - elapsedSeconds);

        this.timerRemainingWhenPaused = remaining;
        this.timerStartTime = null;
        this.timerPaused = true;

        console.log(`Timer paused with ${remaining} seconds remaining`);
        this.saveGameState();
    }

    resumeTimer() {
        if (!this.timerPaused) {
            return;
        }

        const remaining = this.timerRemainingWhenPaused || this.timerDurationSeconds;

        // Back-calculate a synthetic start time so existing elapsed-time math works
        const now = new Date();
        const syntheticStart = new Date(now.getTime() - (this.timerDurationSeconds - remaining) * 1000);
        this.timerStartTime = syntheticStart.toISOString();

        this.timerPaused = false;
        this.timerRemainingWhenPaused = null;

        console.log(`Timer resumed with ${remaining} seconds remaining`);
        this.saveGameState();
    }

    resetTimer() {
        this.timerStartTime = new Date().toISOString();
        this.timerPaused = false;
        this.timerRemainingWhenPaused = null;
        this.blindsWillIncrease = false;

        console.log('Timer reset to full duration');
        this.saveGameState();
    }

    resetGame() {
        console.log('Resetting game...');
        this.game = new PokerGame();

        // Reset timer state
        this.timerStartTime = null;
        this.timerDurationSeconds = TIMER_DURATION_SECONDS;
        this.blindsWillIncrease = false;
        this.timerPaused = false;
        this.timerRemainingWhenPaused = null;

        // Reset blind levels
        this.smallBlind = DEFAULT_SMALL_BLIND;
        this.bigBlind = DEFAULT_BIG_BLIND;
        console.log(`Blinds reset to: ${this.smallBlind}/${this.bigBlind}`);

        db.gameState.reset((err) => {
            if (err) {
                console.error('Error resetting game state:', err);
            }
        });
    }
}

module.exports = { GameManager };
