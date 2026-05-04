const { Deck } = require('./deck');

class PokerGame {
    constructor() {
        this.players = [];
        this.dealerIndex = -1; // -1 indicates no dealer selected yet
        this.deck = new Deck();
        this.communityCards = [];
        this.playerHands = new Map(); // userId -> [card1, card2]
        this.revealedHands = new Set(); // Set of userIds who have revealed their cards
        this.foldedPlayers = new Set(); // Set of userIds who have folded
        this.brokePlayers = new Set(); // Issue #31: Set of userIds who are broke (no chips)
        this.phase = 'waiting'; // waiting, pre-flop, flop, turn, river, complete
        this.cardsDealt = false;
        this.lastBigBlindIndex = -1; // -1 = first hand, derive from dealer
        this._handBigBlindIndex = -1; // BB index locked at deal time for current hand
    }

    addPlayer(userId, userName) {
        console.log(`Adding player: ${userName} (${userId})`);

        if (this.cardsDealt) {
            throw new Error('Cannot add players once cards have been dealt');
        }

        if (this.players.length >= 10) {
            throw new Error('Maximum 10 players allowed');
        }

        const existingPlayer = this.players.find(p => p.id === userId);
        if (existingPlayer) {
            console.log(`Player ${userName} already in game`);
            return false;
        }

        this.players.push({
            id: userId,
            name: userName
        });

        return true;
    }

    removePlayer(userId) {
        const index = this.players.findIndex(p => p.id === userId);
        if (index !== -1) {
            const wasDealer = index === this.dealerIndex;

            this.players.splice(index, 1);
            this.playerHands.delete(userId);

            // If the dealer was removed, reset to no dealer
            if (wasDealer) {
                this.dealerIndex = -1;
            }
            // Adjust dealer index if it's now out of bounds
            else if (this.dealerIndex >= this.players.length) {
                this.dealerIndex = this.players.length > 0 ? 0 : -1;
            }
            // Adjust dealer index if a player before the dealer was removed
            else if (index < this.dealerIndex) {
                this.dealerIndex--;
            }

            // Adjust lastBigBlindIndex for removed player
            if (this.lastBigBlindIndex !== -1) {
                if (index === this.lastBigBlindIndex) {
                    // BB player removed: clamp to bounds so next hand finds correct next
                    if (this.players.length === 0) {
                        this.lastBigBlindIndex = -1;
                    } else if (this.lastBigBlindIndex >= this.players.length) {
                        this.lastBigBlindIndex = this.players.length - 1;
                    }
                } else if (index < this.lastBigBlindIndex) {
                    this.lastBigBlindIndex--;
                }
            }
        }
    }

    selectRandomDealer() {
        if (this.players.length === 0) {
            this.dealerIndex = -1;
            return;
        }

        this.dealerIndex = Math.floor(Math.random() * this.players.length);
        this.lastBigBlindIndex = -1; // Reset for fresh derivation from dealer
        console.log(`Random dealer selected: ${this.players[this.dealerIndex].name} (index ${this.dealerIndex})`);
    }

    selectDealerById(playerId) {
        if (this.players.length === 0) {
            throw new Error('No players in game to select as dealer');
        }

        // Normalize playerId to number
        const normalizedId = typeof playerId === 'string' ? parseInt(playerId, 10) : playerId;

        const playerIndex = this.players.findIndex(p => p.id === normalizedId);
        if (playerIndex === -1) {
            throw new Error('Player not found in game');
        }

        this.dealerIndex = playerIndex;
        this.lastBigBlindIndex = -1; // Reset for fresh derivation from dealer
        console.log(`Dealer manually selected: ${this.players[this.dealerIndex].name} (index ${this.dealerIndex})`);
    }

    reorderPlayers(playerIds) {
        console.log('Reordering players with IDs:', playerIds);
        console.log('Current player order:', this.players.map(p => `${p.name}(${p.id})`));

        if (this.cardsDealt) {
            throw new Error('Cannot reorder players once cards have been dealt');
        }

        if (this.dealerIndex === -1) {
            throw new Error('Cannot reorder players before dealer is selected');
        }

        // Convert playerIds to numbers if they're strings (they come from HTML dataset as strings)
        const normalizedPlayerIds = playerIds.map(id => typeof id === 'string' ? parseInt(id, 10) : id);
        console.log('Normalized player IDs:', normalizedPlayerIds);

        // Validate that all player IDs match current players
        if (normalizedPlayerIds.length !== this.players.length) {
            throw new Error('Player count mismatch');
        }

        const currentPlayerIds = this.players.map(p => p.id);
        console.log('Current player IDs in game:', currentPlayerIds);
        const hasAllPlayers = normalizedPlayerIds.every(id => currentPlayerIds.includes(id));

        if (!hasAllPlayers) {
            throw new Error('Invalid player IDs provided');
        }

        // Store the current dealer's ID and BB player ID before reorder
        const currentDealerId = this.players[this.dealerIndex].id;
        const currentBBPlayerId = this.lastBigBlindIndex !== -1 && this.lastBigBlindIndex < this.players.length
            ? this.players[this.lastBigBlindIndex].id
            : null;
        console.log(`Current dealer: ${this.players[this.dealerIndex].name} (${currentDealerId}) at index ${this.dealerIndex}`);

        // Reorder players array based on provided IDs
        const reorderedPlayers = normalizedPlayerIds.map(id => {
            return this.players.find(p => p.id === id);
        });

        this.players = reorderedPlayers;

        // Update dealer index to match the reordered array
        this.dealerIndex = this.players.findIndex(p => p.id === currentDealerId);

        // Update lastBigBlindIndex to match the reordered array
        if (currentBBPlayerId !== null) {
            this.lastBigBlindIndex = this.players.findIndex(p => p.id === currentBBPlayerId);
        }

        console.log(`Players reordered successfully. New order:`, this.players.map(p => `${p.name}(${p.id})`));
        console.log(`New dealer index: ${this.dealerIndex} (${this.players[this.dealerIndex].name})`);
    }

    rotateDealer() {
        if (this.players.length === 0) {
            this.dealerIndex = -1;
            return;
        }

        const activePlayers = this.getActivePlayers();
        if (activePlayers.length < 2) {
            // Not enough active players to derive blinds — keep current dealer
            return;
        }

        // Derive dealer from blind positions
        const bbIdx = this._computeBigBlindIndex();
        const sbIdx = this._computeSmallBlindIndex(bbIdx);

        if (activePlayers.length === 2) {
            // Heads-up: dealer = SB = the non-BB active player
            this.dealerIndex = sbIdx;
        } else {
            // 3+ active: dealer = seat immediately before SB (dead button rule)
            const len = this.players.length;
            this.dealerIndex = (sbIdx - 1 + len) % len;
        }

        console.log(`Dealer rotated to: ${this.players[this.dealerIndex].name} (index ${this.dealerIndex})`);
    }

    // Issue #29: Shuffle deck without dealing cards
    shuffleDeck() {
        console.log('Shuffling deck...');

        if (this.cardsDealt) {
            throw new Error('Cannot shuffle deck while cards are dealt');
        }

        this.deck.reset();
        this.deck.shuffle();
        console.log('Deck shuffled successfully');
    }

    dealCards() {
        console.log('Dealing cards...');

        // Issue #31: Only count active (non-broke) players
        const activePlayers = this.getActivePlayers();

        if (activePlayers.length < 2) {
            throw new Error('Need at least 2 active players to deal');
        }

        if (this.cardsDealt) {
            throw new Error('Cards already dealt for this hand');
        }

        // Reset and shuffle deck
        this.deck.reset();
        this.deck.shuffle();

        // Clear previous hands
        this.playerHands.clear();
        this.communityCards = [];

        // Issue #31: Deal 2 hole cards only to active (non-broke) players
        for (const player of activePlayers) {
            const holeCards = this.deck.deal(2);
            // Hole cards are visible to the player
            holeCards.forEach(card => card.visible = true);
            this.playerHands.set(player.id, holeCards);
        }

        // Deal 5 community cards (face down)
        this.communityCards = this.deck.deal(5);
        this.communityCards.forEach(card => card.visible = false);

        this.phase = 'pre-flop';
        this.cardsDealt = true;

        // Lock in current BB position at deal time (before broke status changes mid-hand)
        this._handBigBlindIndex = this._computeBigBlindIndex();
        console.log(`Locked handBBIndex: ${this._handBigBlindIndex}`);

        console.log(`Dealt cards to ${activePlayers.length} active players (${this.brokePlayers.size} broke)`);
    }

    revealFlop() {
        console.log('Revealing flop...');

        if (this.phase !== 'pre-flop') {
            throw new Error('Can only reveal flop from pre-flop phase');
        }

        // Reveal first 3 community cards
        this.communityCards[0].visible = true;
        this.communityCards[1].visible = true;
        this.communityCards[2].visible = true;

        this.phase = 'flop';
    }

    revealTurn() {
        console.log('Revealing turn...');

        if (this.phase !== 'flop') {
            throw new Error('Can only reveal turn from flop phase');
        }

        // Reveal 4th community card
        this.communityCards[3].visible = true;

        this.phase = 'turn';
    }

    revealRiver() {
        console.log('Revealing river...');

        if (this.phase !== 'turn') {
            throw new Error('Can only reveal river from turn phase');
        }

        // Reveal 5th community card
        this.communityCards[4].visible = true;

        this.phase = 'river';
    }

    completeHand() {
        console.log('Completing hand...');

        // Promote stashed BB to lastBigBlindIndex for next hand's computation
        if (this._handBigBlindIndex !== -1) {
            this.lastBigBlindIndex = this._handBigBlindIndex;
            console.log(`Saved lastBigBlindIndex: ${this.lastBigBlindIndex}`);
        }
        this._handBigBlindIndex = -1;

        this.phase = 'complete';
        this.cardsDealt = false;
        this.playerHands.clear();
        this.communityCards = [];
        this.revealedHands.clear(); // Clear revealed cards when hand completes
        this.foldedPlayers.clear(); // Clear folded players when hand completes
        this.rotateDealer();
        this.phase = 'waiting';
    }

    revealPlayerCards(userId) {
        console.log(`Player ${userId} revealing their cards`);

        if (!this.cardsDealt) {
            throw new Error('Cannot reveal cards before they are dealt');
        }

        if (!this.playerHands.has(userId)) {
            throw new Error('Player does not have cards to reveal');
        }

        if (this.revealedHands.has(userId)) {
            console.log(`Player ${userId} cards already revealed`);
            return false; // Already revealed
        }

        this.revealedHands.add(userId);
        console.log(`Player ${userId} cards revealed successfully. Total revealed: ${this.revealedHands.size}`);
        return true;
    }

    foldPlayer(userId) {
        console.log(`Player ${userId} folding`);

        if (!this.cardsDealt) {
            throw new Error('Cannot fold before cards are dealt');
        }

        if (!this.playerHands.has(userId)) {
            throw new Error('Player is not in this hand');
        }

        if (this.foldedPlayers.has(userId)) {
            console.log(`Player ${userId} already folded`);
            return false; // Already folded
        }

        this.foldedPlayers.add(userId);
        console.log(`Player ${userId} folded successfully. Total folded: ${this.foldedPlayers.size}`);
        return true;
    }

    hasPlayerFolded(userId) {
        return this.foldedPlayers.has(userId);
    }

    // Issue #31: Toggle player broke status
    togglePlayerBroke(userId) {
        if (this.cardsDealt) {
            throw new Error('Cannot change player status while cards are dealt');
        }

        const player = this.players.find(p => p.id === userId);
        if (!player) {
            throw new Error('Player not found');
        }

        if (this.brokePlayers.has(userId)) {
            this.brokePlayers.delete(userId);
            console.log(`Player ${player.name} is now active (has chips)`);
            return false; // Now active
        } else {
            this.brokePlayers.add(userId);
            console.log(`Player ${player.name} is now broke (no chips)`);
            return true; // Now broke
        }
    }

    isPlayerBroke(userId) {
        return this.brokePlayers.has(userId);
    }

    // Get players who can receive cards (not broke)
    getActivePlayers() {
        return this.players.filter(p => !this.brokePlayers.has(p.id));
    }

    getActivePlayerCount() {
        // Count players who haven't folded
        let activeCount = 0;
        for (const player of this.players) {
            if (this.playerHands.has(player.id) && !this.foldedPlayers.has(player.id)) {
                activeCount++;
            }
        }
        return activeCount;
    }

    getPlayerHand(userId) {
        return this.playerHands.get(userId) || [];
    }

    getCurrentDealer() {
        if (this.players.length === 0 || this.dealerIndex === -1) {
            return null;
        }
        return this.players[this.dealerIndex];
    }

    // Find the next non-broke player clockwise from startIndex (exclusive)
    getNextActivePlayerIndex(startIndex) {
        const len = this.players.length;
        for (let i = 1; i <= len; i++) {
            const idx = (startIndex + i) % len;
            if (!this.brokePlayers.has(this.players[idx].id)) {
                return idx;
            }
        }
        return -1; // all players broke
    }

    // Find the nearest non-broke player counter-clockwise from startIndex (exclusive)
    getPreviousActivePlayerIndex(startIndex) {
        const len = this.players.length;
        for (let i = 1; i <= len; i++) {
            const idx = (startIndex - i + len) % len;
            if (!this.brokePlayers.has(this.players[idx].id)) {
                return idx;
            }
        }
        return -1; // all players broke
    }

    // Private: compute BB index from lastBigBlindIndex or dealer
    _computeBigBlindIndex() {
        if (this.players.length === 0 || this.dealerIndex === -1) {
            return -1;
        }

        const activePlayers = this.getActivePlayers();
        if (activePlayers.length < 2) {
            return -1;
        }

        if (this.lastBigBlindIndex === -1) {
            // First hand or manual dealer select: derive from dealer (legacy behavior)
            if (activePlayers.length === 2) {
                // Heads-up: BB = next active from dealer
                return this.getNextActivePlayerIndex(this.dealerIndex);
            }
            // 3+ active: SB = next active from dealer, BB = next active from SB
            const sbIdx = this.getNextActivePlayerIndex(this.dealerIndex);
            return this.getNextActivePlayerIndex(sbIdx);
        }

        // BB advances exactly one active seat clockwise from last BB
        return this.getNextActivePlayerIndex(this.lastBigBlindIndex);
    }

    // Private: compute SB index from a known BB index
    _computeSmallBlindIndex(bbIdx) {
        if (bbIdx === -1) {
            return -1;
        }

        const activePlayers = this.getActivePlayers();
        if (activePlayers.length < 2) {
            return -1;
        }

        if (activePlayers.length === 2) {
            // Heads-up: SB = the other active player (also the dealer)
            return this.getPreviousActivePlayerIndex(bbIdx);
        }

        // 3+ active: SB = previous active player from BB
        return this.getPreviousActivePlayerIndex(bbIdx);
    }

    getSmallBlindIndex() {
        // During a hand, use the locked-in BB from deal time
        const bbIdx = this._handBigBlindIndex !== -1 ? this._handBigBlindIndex : this._computeBigBlindIndex();
        const sbIdx = this._computeSmallBlindIndex(bbIdx);
        if (sbIdx !== -1) {
            console.log(`SB: ${this.players[sbIdx]?.name} at index ${sbIdx}`);
        }
        return sbIdx;
    }

    getBigBlindIndex() {
        // During a hand, use the locked-in BB from deal time
        const bbIdx = this._handBigBlindIndex !== -1 ? this._handBigBlindIndex : this._computeBigBlindIndex();
        if (bbIdx !== -1) {
            console.log(`BB: ${this.players[bbIdx]?.name} at index ${bbIdx}`);
        }
        return bbIdx;
    }

    getGameState(forUserId = null) {
        const smallBlindIndex = this.getSmallBlindIndex();
        const bigBlindIndex = this.getBigBlindIndex();

        const state = {
            players: this.players.map((p, index) => ({
                id: p.id,
                name: p.name,
                isDealer: this.dealerIndex !== -1 && index === this.dealerIndex,
                isSmallBlind: smallBlindIndex !== -1 && index === smallBlindIndex,
                isBigBlind: bigBlindIndex !== -1 && index === bigBlindIndex,
                hasFolded: this.foldedPlayers.has(p.id),
                isBroke: this.brokePlayers.has(p.id) // Issue #31
            })),
            dealerIndex: this.dealerIndex,
            smallBlindIndex: smallBlindIndex,
            bigBlindIndex: bigBlindIndex,
            communityCards: this.communityCards.map(card => card.toJSON()),
            phase: this.phase,
            cardsDealt: this.cardsDealt,
            activePlayerCount: this.getActivePlayerCount()
        };

        // Include player-specific hole cards if userId is provided
        if (forUserId) {
            const holeCards = this.getPlayerHand(forUserId);
            state.holeCards = holeCards.map(card => card.toJSON());
        }

        // Include revealed hands for all players
        state.revealedHands = [];
        for (const userId of this.revealedHands) {
            const player = this.players.find(p => p.id === userId);
            const cards = this.getPlayerHand(userId);
            if (player && cards.length > 0) {
                state.revealedHands.push({
                    userId: userId,
                    playerName: player.name,
                    cards: cards.map(card => card.toJSON())
                });
            }
        }

        return state;
    }

    toJSON() {
        return {
            players: this.players,
            dealerIndex: this.dealerIndex,
            deck: this.deck.toJSON(),
            communityCards: this.communityCards.map(card => card.toJSON()),
            playerHands: Array.from(this.playerHands.entries()).map(([userId, cards]) => ({
                userId,
                cards: cards.map(card => card.toJSON())
            })),
            revealedHands: Array.from(this.revealedHands),
            foldedPlayers: Array.from(this.foldedPlayers),
            brokePlayers: Array.from(this.brokePlayers), // Issue #31
            lastBigBlindIndex: this.lastBigBlindIndex, // Issue #51
            phase: this.phase,
            cardsDealt: this.cardsDealt
        };
    }

    static fromJSON(data) {
        const game = new PokerGame();

        if (!data) {
            return game;
        }

        game.players = data.players || [];
        game.dealerIndex = data.dealerIndex !== undefined ? data.dealerIndex : -1;
        game.deck = data.deck ? Deck.fromJSON(data.deck) : new Deck();
        game.phase = data.phase || 'waiting';
        game.cardsDealt = data.cardsDealt || false;

        // Restore community cards
        if (data.communityCards) {
            const { Card } = require('./deck');
            game.communityCards = data.communityCards.map(cardData => {
                const card = new Card(cardData.suit, cardData.rank);
                card.visible = cardData.visible;
                return card;
            });
        }

        // Restore player hands
        if (data.playerHands) {
            const { Card } = require('./deck');
            game.playerHands.clear();
            for (const handData of data.playerHands) {
                const cards = handData.cards.map(cardData => {
                    const card = new Card(cardData.suit, cardData.rank);
                    card.visible = cardData.visible;
                    return card;
                });
                game.playerHands.set(handData.userId, cards);
            }
        }

        // Restore revealed hands
        if (data.revealedHands) {
            game.revealedHands.clear();
            for (const userId of data.revealedHands) {
                game.revealedHands.add(userId);
            }
        }

        // Restore folded players
        if (data.foldedPlayers) {
            game.foldedPlayers.clear();
            for (const userId of data.foldedPlayers) {
                game.foldedPlayers.add(userId);
            }
        }

        // Issue #31: Restore broke players
        if (data.brokePlayers) {
            game.brokePlayers.clear();
            for (const userId of data.brokePlayers) {
                game.brokePlayers.add(userId);
            }
        }

        // Issue #51: Restore last big blind index
        game.lastBigBlindIndex = data.lastBigBlindIndex !== undefined ? data.lastBigBlindIndex : -1;

        return game;
    }
}

module.exports = { PokerGame };
