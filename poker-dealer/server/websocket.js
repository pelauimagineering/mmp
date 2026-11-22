const WebSocket = require('ws');
const auth = require('./auth');
const { GameManager } = require('./game-manager');

// userId -> Set<WebSocket>. A player can hold several sockets at once (phone
// and laptop, or a reconnect that overlaps the socket it replaces). Keying a
// single socket per user meant the old socket's late 'close' event evicted the
// new one, which then silently stopped receiving game state.
const clients = new Map();
const publicClients = new Set(); // WebSocket connections for public views

const HEARTBEAT_INTERVAL_MS = 25000;

// Monotonic counter stamped on every state payload so a client can tell a
// fresh snapshot from a stale or out-of-order one.
let stateVersion = Date.now(); // seeded from the clock so it keeps rising across restarts

function addClient(userId, ws) {
    if (!clients.has(userId)) {
        clients.set(userId, new Set());
    }
    clients.get(userId).add(ws);
}

function removeClient(userId, ws) {
    const sockets = clients.get(userId);
    if (!sockets) return;
    sockets.delete(ws);
    if (sockets.size === 0) {
        clients.delete(userId);
    }
}

function countAuthenticatedSockets() {
    let count = 0;
    for (const sockets of clients.values()) count += sockets.size;
    return count;
}

function safeSend(ws, payload) {
    if (ws.readyState !== WebSocket.OPEN) return false;
    try {
        ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
        return true;
    } catch (error) {
        console.error('WebSocket send failed:', error.message);
        return false;
    }
}

function stamp(state) {
    state.version = stateVersion;
    state.serverTime = Date.now();
    return state;
}

function playerStateFor(userId) {
    return stamp(gameManager.getGameState(userId));
}

function communityState() {
    const gameState = gameManager.getGameState(); // full state including revealed hands
    return stamp({
        communityCards: gameState.communityCards,
        phase: gameState.phase,
        cardsDealt: gameState.cardsDealt,
        revealedHands: gameState.revealedHands,
        timerState: gameState.timerState,
        blinds: gameState.blinds, // Issue #27: Include blinds for community display
        players: gameState.players // seat order, dealer and blinds for the shared board
    });
}

let gameManager = null;
let timerCheckInterval = null;

function initWebSocketServer(server) {
    console.log('Initializing WebSocket server...');

    gameManager = new GameManager();

    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
        console.log('New WebSocket connection');

        let userId = null;
        let userName = null;

        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        ws.on('message', (message) => {
            ws.isAlive = true;
            try {
                const data = JSON.parse(message);
                if (data.type !== 'ping' && data.type !== 'get-state' && data.type !== 'get-community-state') {
                    console.log('Received message:', data.type);
                }

                handleMessage(ws, data, (newUserId, newUserName) => {
                    userId = newUserId;
                    userName = newUserName;
                });
            } catch (error) {
                console.error('Error handling message:', error);
                safeSend(ws, {
                    type: 'error',
                    message: error.message
                });
            }
        });

        ws.on('close', () => {
            console.log(`WebSocket connection closed for user: ${userName || 'public'}`);

            // Remove only this socket; the same user may have a newer one open.
            if (userId) {
                removeClient(userId, ws);
            }
            publicClients.delete(ws);
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });

    console.log('WebSocket server initialized');

    // Heartbeat: drop sockets that stopped answering (phone asleep, network
    // switched) so they don't linger as half-open connections.
    const heartbeat = setInterval(() => {
        for (const ws of wss.clients) {
            if (ws.isAlive === false) {
                ws.terminate();
                continue;
            }
            ws.isAlive = false;
            try { ws.ping(); } catch (error) { /* socket already closing */ }
        }
    }, HEARTBEAT_INTERVAL_MS);
    wss.on('close', () => clearInterval(heartbeat));

    // Start timer check interval
    startTimerCheckInterval();

    return wss;
}

function startTimerCheckInterval() {
    // Check timer every second
    timerCheckInterval = setInterval(() => {
        if (gameManager) {
            const timerJustExpired = gameManager.checkAndUpdateTimerExpiration();

            if (timerJustExpired) {
                console.log('Broadcasting timer-expired event');
                broadcast({
                    type: 'timer-expired',
                    message: 'Blind level timer has expired. Blinds will increase on the next deal!'
                });

                // Also broadcast updated game state so clients get the new timer state
                broadcastGameState();
            }
        }
    }, 1000);
}

function handleMessage(ws, data, setUser) {
    const { type, token } = data;

    // Application-level heartbeat. Lets the browser detect a dead socket
    // (it cannot see protocol-level ping frames).
    if (type === 'ping') {
        safeSend(ws, { type: 'pong', serverTime: Date.now(), version: stateVersion });
        return;
    }

    // Handle public authentication for community display
    if (type === 'auth-public') {
        console.log('Public WebSocket connection established');
        publicClients.add(ws);

        safeSend(ws, { type: 'community-state', data: communityState() });

        return;
    }

    // Handle public community state request
    if (type === 'get-community-state') {
        safeSend(ws, { type: 'community-state', data: communityState() });

        return;
    }

    // Authenticate WebSocket connection
    if (type === 'auth') {
        auth.validateSession(token, (err, session) => {
            if (err || !session) {
                ws.send(JSON.stringify({
                    type: 'error',
                    code: 'session-expired',
                    message: 'Invalid or expired session'
                }));
                return;
            }

            const userId = session.user_id;
            const userName = session.display_name;

            setUser(userId, userName);
            addClient(userId, ws);

            console.log(`User authenticated via WebSocket: ${userName} (${userId})`);

            // Send authentication confirmation
            ws.send(JSON.stringify({
                type: 'authenticated',
                user: {
                    id: userId,
                    display_name: userName,
                    user_name: session.user_name
                }
            }));

            // Send current game state
            safeSend(ws, { type: 'game-state', data: playerStateFor(userId) });
        });

        return;
    }

    // All other messages require authentication
    auth.validateSession(token, (err, session) => {
        if (err || !session) {
            ws.send(JSON.stringify({
                type: 'error',
                code: 'session-expired',
                message: 'Not authenticated'
            }));
            return;
        }

        const userId = session.user_id;
        const userName = session.display_name;

        // Handle different message types
        switch (type) {
            case 'join-game':
                handleJoinGame(userId, userName, ws);
                break;

            case 'deal-cards':
                handleDealCards(userId, ws);
                break;

            case 'flip-community-card':
                handleFlipCommunityCard(userId, ws);
                break;

            case 'shuffle-deck':
                handleShuffleDeck(userId, ws);
                break;

            case 'choose-dealer':
                handleChooseDealer(userId, ws);
                break;

            case 'select-dealer':
                handleSelectDealer(userId, data.playerId, ws);
                break;

            case 'reorder-players':
                handleReorderPlayers(userId, data.playerIds, ws);
                break;

            case 'show-my-cards':
                handleShowMyCards(userId, ws);
                break;

            case 'fold-hand':
                handleFoldHand(userId, ws);
                break;

            case 'toggle-player-broke':
                handleTogglePlayerBroke(userId, data.playerId, ws);
                break;

            case 'pause-timer':
                handlePauseTimer(userId, ws);
                break;

            case 'resume-timer':
                handleResumeTimer(userId, ws);
                break;

            case 'reset-timer':
                handleResetTimer(userId, ws);
                break;

            case 'get-state':
                // A socket that authenticated before a reconnect race is
                // always (re)registered here, so a resync also repairs routing.
                addClient(userId, ws);
                safeSend(ws, { type: 'game-state', data: playerStateFor(userId) });
                break;

            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    message: `Unknown message type: ${type}`
                }));
        }
    });
}

function handleJoinGame(userId, userName, ws) {
    console.log(`User ${userName} attempting to join game`);

    if (!gameManager.canJoinGame()) {
        ws.send(JSON.stringify({
            type: 'join-rejected',
            message: 'Cannot join game - cards already dealt or game is full'
        }));
        return;
    }

    const added = gameManager.addPlayer(userId, userName);

    if (added) {
        console.log(`User ${userName} joined the game`);

        // Broadcast updated game state to all clients
        broadcastGameState();

        ws.send(JSON.stringify({
            type: 'join-accepted',
            message: 'Successfully joined the game'
        }));
    } else {
        ws.send(JSON.stringify({
            type: 'join-rejected',
            message: 'Already in game'
        }));
    }
}

function handleDealCards(userId, ws) {
    console.log(`User ${userId} attempting to deal cards`);

    if (!gameManager.isDealer(userId)) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Only the dealer can deal cards'
        }));
        return;
    }

    try {
        gameManager.dealCards();
        console.log('Cards dealt successfully');

        // Broadcast to all clients
        broadcastGameState();

        // Send specific notification
        broadcast({
            type: 'cards-dealt',
            message: 'Cards have been dealt'
        });
    } catch (error) {
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message
        }));
    }
}

function handleFlipCommunityCard(userId, ws) {
    console.log(`User ${userId} attempting to flip community card`);

    if (!gameManager.isDealer(userId)) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Only the dealer can flip community cards'
        }));
        return;
    }

    try {
        const phaseBefore = gameManager.game.phase;
        gameManager.flipCommunityCard();
        const phaseAfter = gameManager.game.phase;

        console.log(`Community card flipped: ${phaseBefore} -> ${phaseAfter}`);

        // Broadcast to all clients
        broadcastGameState();

        // Send specific notification
        broadcast({
            type: 'community-revealed',
            phase: phaseAfter
        });
    } catch (error) {
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message
        }));
    }
}

// Issue #29: Handle shuffle deck request
function handleShuffleDeck(userId, ws) {
    console.log(`User ${userId} attempting to shuffle deck`);

    if (!gameManager.isDealer(userId)) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Only the dealer can shuffle the deck'
        }));
        return;
    }

    try {
        gameManager.shuffleDeck();
        console.log('Deck shuffled successfully');

        // Broadcast to all clients
        broadcastGameState();

        // Send specific notification
        broadcast({
            type: 'deck-shuffled',
            message: 'Deck has been shuffled'
        });
    } catch (error) {
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message
        }));
    }
}

function handleChooseDealer(userId, ws) {
    console.log(`User ${userId} attempting to choose dealer randomly`);

    // Issue #32: Allow dealer change when cards not dealt
    if (gameManager.game.cardsDealt) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Cannot change dealer while cards are dealt'
        }));
        return;
    }

    // Check if there are players to choose from
    if (gameManager.game.players.length === 0) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'No players in game to select as dealer'
        }));
        return;
    }

    try {
        gameManager.game.selectRandomDealer();
        gameManager.saveGameState();

        const dealer = gameManager.game.getCurrentDealer();
        console.log(`Dealer selected randomly: ${dealer.name}`);

        // Broadcast to all clients
        broadcastGameState();

        // Send specific notification
        broadcast({
            type: 'dealer-selected',
            dealer: {
                id: dealer.id,
                name: dealer.name
            }
        });
    } catch (error) {
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message
        }));
    }
}

function handleSelectDealer(userId, playerId, ws) {
    console.log(`User ${userId} attempting to select player ${playerId} as dealer`);

    // Issue #32: Allow dealer change when cards not dealt (waiting/complete phase)
    // Only block during active hand (pre-flop through river)
    if (gameManager.game.cardsDealt) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Cannot change dealer while cards are dealt'
        }));
        return;
    }

    // Check if there are players to choose from
    if (gameManager.game.players.length === 0) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'No players in game to select as dealer'
        }));
        return;
    }

    try {
        gameManager.game.selectDealerById(playerId);
        gameManager.saveGameState();

        const dealer = gameManager.game.getCurrentDealer();
        console.log(`Dealer manually selected: ${dealer.name}`);

        // Broadcast to all clients
        broadcastGameState();

        // Send specific notification
        broadcast({
            type: 'dealer-selected',
            dealer: {
                id: dealer.id,
                name: dealer.name
            }
        });
    } catch (error) {
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message
        }));
    }
}

function handleReorderPlayers(userId, playerIds, ws) {
    console.log(`User ${userId} attempting to reorder players`);
    console.log('Received playerIds:', playerIds);

    // Check if current user is the dealer
    if (!gameManager.isDealer(userId)) {
        console.log('User is not the dealer, rejecting request');
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Only the dealer can reorder players'
        }));
        return;
    }

    try {
        console.log('User is dealer, proceeding with reorder');
        gameManager.game.reorderPlayers(playerIds);

        console.log('Saving game state to database...');
        gameManager.saveGameState();

        console.log('Players reordered successfully, broadcasting to all clients');

        // Broadcast updated game state to all clients
        broadcastGameState();

        ws.send(JSON.stringify({
            type: 'players-reordered',
            message: 'Players reordered successfully'
        }));
    } catch (error) {
        console.error('Error reordering players:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message
        }));
    }
}

function handleShowMyCards(userId, ws) {
    console.log(`User ${userId} attempting to show their cards`);

    try {
        const revealed = gameManager.game.revealPlayerCards(userId);

        if (revealed) {
            console.log(`Player ${userId} revealed their cards successfully`);
            gameManager.saveGameState();

            // Broadcast updated game state to all clients
            broadcastGameState();

            ws.send(JSON.stringify({
                type: 'cards-revealed',
                message: 'Your cards have been revealed to all players'
            }));
        } else {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Your cards are already revealed'
            }));
        }
    } catch (error) {
        console.error('Error revealing cards:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message
        }));
    }
}

function handleFoldHand(userId, ws) {
    console.log(`User ${userId} attempting to fold`);

    try {
        const folded = gameManager.game.foldPlayer(userId);

        if (folded) {
            const player = gameManager.game.players.find(p => p.id === userId);
            const playerName = player ? player.name : 'Unknown';
            console.log(`Player ${playerName} folded successfully`);
            gameManager.saveGameState();

            // Broadcast updated game state to all clients
            broadcastGameState();

            // Notify the player who folded
            ws.send(JSON.stringify({
                type: 'fold-confirmed',
                message: 'You have folded your hand'
            }));

            // Broadcast fold notification to all players
            broadcast({
                type: 'player-folded',
                playerId: userId,
                playerName: playerName,
                activePlayerCount: gameManager.game.getActivePlayerCount()
            });
        } else {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'You have already folded'
            }));
        }
    } catch (error) {
        console.error('Error folding hand:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message
        }));
    }
}

// Issue #31: Handle toggle player broke status
function handleTogglePlayerBroke(userId, playerId, ws) {
    console.log(`User ${userId} attempting to toggle broke status for player ${playerId}`);

    // Only dealer can mark players as broke
    if (!gameManager.isDealer(userId)) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Only the dealer can mark players as broke'
        }));
        return;
    }

    try {
        const isBroke = gameManager.game.togglePlayerBroke(playerId);
        gameManager.saveGameState();

        const player = gameManager.game.players.find(p => p.id === parseInt(playerId, 10) || p.id === playerId);
        const playerName = player ? player.name : 'Unknown';

        console.log(`Player ${playerName} is now ${isBroke ? 'broke' : 'active'}`);

        // Broadcast updated game state to all clients
        broadcastGameState();

        // Send notification
        broadcast({
            type: 'player-broke-toggled',
            playerId: playerId,
            playerName: playerName,
            isBroke: isBroke,
            message: `${playerName} is now ${isBroke ? 'out of chips' : 'back in the game'}`
        });
    } catch (error) {
        console.error('Error toggling player broke status:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message
        }));
    }
}

// Issue #49: Timer control handlers
function handlePauseTimer(userId, ws) {
    if (!gameManager.isDealer(userId)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Only the dealer can pause the timer' }));
        return;
    }

    gameManager.pauseTimer();
    console.log('Timer paused by dealer');
    broadcastGameState();
}

function handleResumeTimer(userId, ws) {
    if (!gameManager.isDealer(userId)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Only the dealer can resume the timer' }));
        return;
    }

    gameManager.resumeTimer();
    console.log('Timer resumed by dealer');
    broadcastGameState();
}

function handleResetTimer(userId, ws) {
    if (!gameManager.isDealer(userId)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Only the dealer can reset the timer' }));
        return;
    }

    gameManager.resetTimer();
    console.log('Timer reset by dealer');
    broadcastGameState();
}

function broadcastGameState() {
    stateVersion++;
    console.log(`Broadcasting game state v${stateVersion} to ${countAuthenticatedSockets()} authenticated and ${publicClients.size} public sockets`);

    // Authenticated clients each get their own view (their hole cards only)
    for (const [userId, sockets] of clients.entries()) {
        const payload = JSON.stringify({ type: 'game-state', data: playerStateFor(userId) });
        for (const client of sockets) {
            safeSend(client, payload);
        }
    }

    // Public clients get the board, shown hands, seats and the clock
    const publicPayload = JSON.stringify({ type: 'community-state', data: communityState() });
    for (const client of publicClients) {
        safeSend(client, publicPayload);
    }
}

function broadcast(message) {
    const messageStr = JSON.stringify(message);

    for (const sockets of clients.values()) {
        for (const client of sockets) {
            safeSend(client, messageStr);
        }
    }
}

function removePlayerFromGame(userId, userName) {
    if (gameManager) {
        console.log(`Removing player ${userName} (${userId}) from game`);
        gameManager.removePlayer(userId);
        broadcastGameState();
    }
}

function selectRandomDealer() {
    if (gameManager && gameManager.game.players.length > 0) {
        console.log('Selecting random dealer from current players');
        gameManager.game.selectRandomDealer();
        gameManager.saveGameState();
        broadcastGameState();
        return true;
    }
    return false;
}

function notifyGameReset() {
    console.log('Notifying all clients that game has been reset');

    // Notify all authenticated clients
    broadcast({
        type: 'game-reset',
        message: 'The game has been reset. Please log in again.'
    });

    // Notify all public clients
    for (const client of publicClients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'game-reset',
                message: 'The game has been reset.'
            }));
        }
    }

    // Reset the game manager
    if (gameManager) {
        gameManager.resetGame();
    }
}

module.exports = {
    initWebSocketServer,
    broadcastGameState,
    broadcast,
    removePlayerFromGame,
    selectRandomDealer,
    notifyGameReset
};
