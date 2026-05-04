let currentUser = null;
let gameState = null;

// Initialize app
async function init() {
    console.log('Initializing game app...');

    // Check session
    try {
        const response = await fetch('/api/auth/session', {
            credentials: 'same-origin'
        });
        const data = await response.json();

        if (!data.authenticated) {
            console.log('Not authenticated, redirecting to login');
            window.location.href = '/';
            return;
        }

        currentUser = data.user;
        const token = data.token;  // Get token from response instead of cookie
        document.getElementById('userName').textContent = currentUser.display_name;

        console.log('User authenticated:', currentUser.display_name);

        // Connect WebSocket
        if (token) {
            wsClient.connect(token);
            setupWebSocketHandlers();
            setupDealerControls();
        } else {
            console.error('No session token found');
            window.location.href = '/';
        }

    } catch (error) {
        console.error('Session check error:', error);
        window.location.href = '/';
    }

    // Setup logout
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Setup join game
    document.getElementById('joinGameBtn').addEventListener('click', joinGame);

    // Setup choose dealer
    document.getElementById('chooseDealerBtn').addEventListener('click', chooseDealer);

    // Setup reset game
    document.getElementById('resetGameBtn').addEventListener('click', resetGame);

    // Setup video toggle
    setupVideoToggle();
}

function setupVideoToggle() {
    const toggleCheckbox = document.getElementById('toggle-video');
    const videoSection = document.querySelector('.game-room-section');

    if (!toggleCheckbox || !videoSection) {
        console.warn('Video toggle elements not found');
        return;
    }

    // Add event listener for checkbox changes
    toggleCheckbox.addEventListener('change', function() {
        if (this.checked) {
            videoSection.classList.add('visible');
            console.log('Video section shown');
        } else {
            videoSection.classList.remove('visible');
            console.log('Video section hidden');
        }
    });

    console.log('Video toggle initialized');
}

function setupWebSocketHandlers() {
    // Handle authentication confirmation
    wsClient.on('authenticated', (message) => {
        console.log('WebSocket authenticated');
    });

    // Handle game state updates
    wsClient.on('game-state', (message) => {
        console.log('Game state updated');
        gameState = message.data;
        updateUI();
    });

    // Handle cards dealt
    wsClient.on('cards-dealt', (message) => {
        console.log('Cards dealt!');
        showOverlay('Cards have been dealt!', 'deal');
        // Reset reveal state for new hand (Issue #18 fix)
        cardsAlreadyRevealed = false;
    });

    // Handle community card revealed
    wsClient.on('community-revealed', (message) => {
        console.log('Community card revealed:', message.phase);
        showOverlay(`${message.phase} revealed!`, 'reveal');
    });

    // Handle join accepted
    wsClient.on('join-accepted', (message) => {
        console.log('Join accepted');
        showOverlay('Successfully joined the game!', 'join');
    });

    // Handle join rejected
    wsClient.on('join-rejected', (message) => {
        console.log('Join rejected:', message.message);
        showError(message.message);
    });

    // Handle errors
    wsClient.on('error', (message) => {
        console.error('WebSocket error:', message.message);
        showError(message.message);
    });

    // Handle dealer selected
    wsClient.on('dealer-selected', (message) => {
        console.log('Dealer selected:', message.dealer.name);
        showOverlay(`${message.dealer.name} is the dealer!`, 'dealer');
    });

    // Handle game reset
    wsClient.on('game-reset', (message) => {
        console.log('Game has been reset');
        showOverlay(message.message, 'reset');
        // Redirect to login after a short delay
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    });

    // Handle timer expired
    wsClient.on('timer-expired', (message) => {
        console.log('Timer expired:', message.message);
        showOverlay(message.message, 'timer');
        blindTimer.showExpiredAlert();
    });

    // Handle fold confirmed
    wsClient.on('fold-confirmed', (message) => {
        console.log('Fold confirmed:', message.message);
        showOverlay(message.message, 'fold');
    });

    // Handle player folded notification
    wsClient.on('player-folded', (message) => {
        console.log(`${message.playerName} folded. Active players: ${message.activePlayerCount}`);
        showOverlay(`${message.playerName} has folded`, 'fold');
    });

    // Issue #31: Handle player broke status toggled
    wsClient.on('player-broke-toggled', (message) => {
        console.log(`${message.playerName} is now ${message.isBroke ? 'broke' : 'active'}`);
        showOverlay(message.message, 'broke');
    });
}

function updateUI() {
    if (!gameState) {
        return;
    }

    console.log('Updating UI with game state:', gameState);

    // Update players list
    updatePlayersList();

    // Update community cards
    updateCommunityCards();

    // Update hole cards
    updateHoleCards();

    // Update phase indicator
    updatePhaseIndicator();

    // Show/hide join game section
    updateJoinGameSection();

    // Update choose dealer button state
    updateChooseDealerButton();

    // Update revealed hands display
    updateRevealedHands();

    // Update slide-to-show control visibility
    updateSlideToShowControl();

    // Update slide-to-fold control visibility
    updateSlideToFoldControl();

    // Update blind level timer
    if (gameState.timerState) {
        blindTimer.update(gameState.timerState);
    }

    // Update blinds display
    updateBlindsDisplay();
}

function updatePlayersList() {
    const playersList = document.getElementById('playersList');

    // Clear any stale drag state before updating list (Issue #30 fix)
    cleanupDragState();

    if (!gameState.players || gameState.players.length === 0) {
        playersList.innerHTML = '<div class="no-cards-message">No players yet</div>';
        return;
    }

    playersList.innerHTML = '';

    // Check if current user is the dealer and cards haven't been dealt
    const currentDealer = gameState.players.find(p => p.isDealer);
    const isCurrentUserDealer = currentDealer && currentDealer.id === currentUser.id;
    const canReorder = isCurrentUserDealer && !gameState.cardsDealt;

    // Issue #32: Allow dealer selection/change when cards not dealt (even if dealer exists)
    const canSelectDealer = !gameState.cardsDealt && gameState.players.length > 0;

    console.log('updatePlayersList - Can reorder:', canReorder, 'isDealer:', isCurrentUserDealer, 'cardsDealt:', gameState.cardsDealt, 'canSelectDealer:', canSelectDealer);

    gameState.players.forEach((player, index) => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.dataset.playerId = player.id;
        playerItem.dataset.playerIndex = index;

        if (player.isDealer) {
            playerItem.classList.add('is-dealer');
        }

        // Make clickable to select as dealer (before dealer is selected)
        if (canSelectDealer) {
            playerItem.classList.add('selectable-dealer');
            playerItem.addEventListener('click', () => selectPlayerAsDealer(player.id, player.name));
        }

        // Make draggable only if dealer and cards haven't been dealt
        if (canReorder) {
            playerItem.setAttribute('draggable', 'true');
            playerItem.classList.add('draggable');
            setupDragAndDrop(playerItem);
        }

        const playerName = document.createElement('span');
        playerName.className = 'player-name';
        playerName.textContent = player.name;

        playerItem.appendChild(playerName);

        if (player.isDealer) {
            const badge = document.createElement('span');
            badge.className = 'player-dealer-badge';
            badge.textContent = 'D';
            playerItem.appendChild(badge);
        }

        if (player.isSmallBlind) {
            const sbBadge = document.createElement('span');
            sbBadge.className = 'player-sb-badge';
            sbBadge.textContent = 'SB';
            playerItem.appendChild(sbBadge);
        }

        if (player.isBigBlind) {
            const bbBadge = document.createElement('span');
            bbBadge.className = 'player-bb-badge';
            bbBadge.textContent = 'BB';
            playerItem.appendChild(bbBadge);
        }

        // Add folded badge and styling if player has folded
        if (player.hasFolded) {
            playerItem.classList.add('is-folded');
            const foldedBadge = document.createElement('span');
            foldedBadge.className = 'player-folded-badge';
            foldedBadge.textContent = 'FOLDED';
            playerItem.appendChild(foldedBadge);
        }

        // Issue #31: Add broke badge and styling if player is broke
        if (player.isBroke) {
            playerItem.classList.add('is-broke');
            const brokeBadge = document.createElement('span');
            brokeBadge.className = 'player-broke-badge';
            brokeBadge.textContent = 'BROKE';
            playerItem.appendChild(brokeBadge);
        }

        // Issue #31: Add broke toggle button for dealer (only when cards not dealt)
        if (isCurrentUserDealer && !gameState.cardsDealt) {
            const brokeToggleBtn = document.createElement('button');
            brokeToggleBtn.className = 'broke-toggle-btn';
            brokeToggleBtn.title = player.isBroke ? 'Mark as active (has chips)' : 'Mark as broke (no chips)';
            brokeToggleBtn.textContent = player.isBroke ? '💰' : '🚫';
            brokeToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Don't trigger dealer selection
                togglePlayerBroke(player.id, player.name);
            });
            playerItem.appendChild(brokeToggleBtn);
        }

        // Add drag handle indicator if draggable
        if (canReorder) {
            const dragHandle = document.createElement('span');
            dragHandle.className = 'drag-handle';
            dragHandle.textContent = '☰';
            playerItem.insertBefore(dragHandle, playerItem.firstChild);
        }

        playersList.appendChild(playerItem);
    });
}

let draggedElement = null;
let reorderDebounceTimeout = null;

function setupDragAndDrop(element) {
    element.addEventListener('dragstart', handleDragStart);
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('drop', handleDrop);
    element.addEventListener('dragend', handleDragEnd);
    element.addEventListener('dragenter', handleDragEnter);
    element.addEventListener('dragleave', handleDragLeave);
}

function handleDragStart(e) {
    try {
        // Clear any stale drag state (Issue #30 fix)
        cleanupDragState();

        draggedElement = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.innerHTML);
        console.log('Drag started for player:', this.dataset.playerId);
    } catch (error) {
        console.error('Error in handleDragStart:', error);
        cleanupDragState();
    }
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    if (this !== draggedElement) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    try {
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        if (draggedElement && draggedElement !== this) {
            const playersList = document.getElementById('playersList');
            const allItems = Array.from(playersList.querySelectorAll('.player-item'));

            const draggedIndex = allItems.indexOf(draggedElement);
            const targetIndex = allItems.indexOf(this);

            console.log('Drop - moving from index', draggedIndex, 'to', targetIndex);

            // Validate indices (Issue #30 fix)
            if (draggedIndex === -1 || targetIndex === -1) {
                console.warn('Invalid drag indices, aborting drop');
                cleanupDragState();
                return false;
            }

            // Reorder DOM elements
            if (draggedIndex < targetIndex) {
                this.parentNode.insertBefore(draggedElement, this.nextSibling);
            } else {
                this.parentNode.insertBefore(draggedElement, this);
            }

            // Send new order to server with debounce (Issue #30 fix)
            sendPlayerOrderDebounced();
        }

        this.classList.remove('drag-over');
    } catch (error) {
        console.error('Error in handleDrop:', error);
        cleanupDragState();
    }
    return false;
}

function handleDragEnd(e) {
    try {
        this.classList.remove('dragging');
        cleanupDragState();
    } catch (error) {
        console.error('Error in handleDragEnd:', error);
        cleanupDragState();
    }
}

// Cleanup function to clear all drag state (Issue #30 fix)
function cleanupDragState() {
    // Remove all drag-over and dragging classes
    const playersList = document.getElementById('playersList');
    if (playersList) {
        const allItems = playersList.querySelectorAll('.player-item');
        allItems.forEach(item => {
            item.classList.remove('drag-over');
            item.classList.remove('dragging');
        });
    }
    draggedElement = null;
}

function sendPlayerOrder() {
    const playersList = document.getElementById('playersList');
    const allItems = Array.from(playersList.querySelectorAll('.player-item'));
    const playerIds = allItems.map(item => item.dataset.playerId);

    console.log('Sending new player order to server:', playerIds);

    wsClient.send('reorder-players', { playerIds: playerIds });
}

// Debounced version to prevent rapid-fire updates (Issue #30 fix)
function sendPlayerOrderDebounced() {
    if (reorderDebounceTimeout) {
        clearTimeout(reorderDebounceTimeout);
    }
    reorderDebounceTimeout = setTimeout(() => {
        sendPlayerOrder();
        reorderDebounceTimeout = null;
    }, 100);
}

function updateCommunityCards() {
    const communityCards = document.getElementById('communityCards');

    if (!gameState.communityCards || gameState.communityCards.length === 0) {
        communityCards.innerHTML = '<div class="no-cards-message">Waiting for cards to be dealt...</div>';
        return;
    }

    communityCards.innerHTML = '';

    gameState.communityCards.forEach(card => {
        const cardElement = createCardElement(card);
        communityCards.appendChild(cardElement);
    });
}

let isViewingHoleCards = false;

function updateHoleCards() {
    const holeCardsContainer = document.getElementById('holeCards');

    if (!gameState.holeCards || gameState.holeCards.length === 0) {
        holeCardsContainer.innerHTML = '<div class="no-cards-message">No cards yet</div>';
        return;
    }

    holeCardsContainer.innerHTML = '';

    // Create cards (they will be shown as card-backs initially)
    gameState.holeCards.forEach(card => {
        const cardElement = createHoleCardElement(card);
        holeCardsContainer.appendChild(cardElement);
    });

    // Setup peek functionality
    setupHoleCardsPeek();
}

function createHoleCardElement(card) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card hole-card';

    // Store the card data for peeking
    cardDiv.dataset.suit = card.suit;
    cardDiv.dataset.rank = card.rank;

    // Initially show as card back
    cardDiv.classList.add('card-back');

    return cardDiv;
}

function setupHoleCardsPeek() {
    const holeCardsContainer = document.getElementById('holeCards');

    // Remove any existing event listeners
    const newContainer = holeCardsContainer.cloneNode(true);
    holeCardsContainer.parentNode.replaceChild(newContainer, holeCardsContainer);

    const holeCards = document.getElementById('holeCards');

    // Mouse events for desktop
    holeCards.addEventListener('mousedown', startPeekingHoleCards);
    holeCards.addEventListener('mouseup', stopPeekingHoleCards);
    holeCards.addEventListener('mouseleave', stopPeekingHoleCards);

    // Touch events for mobile
    holeCards.addEventListener('touchstart', startPeekingHoleCards);
    holeCards.addEventListener('touchend', stopPeekingHoleCards);
    holeCards.addEventListener('touchcancel', stopPeekingHoleCards);
}

function startPeekingHoleCards(e) {
    e.preventDefault();
    if (isViewingHoleCards) return;

    isViewingHoleCards = true;
    const holeCardsContainer = document.getElementById('holeCards');
    holeCardsContainer.classList.add('peeking');

    // Reveal all hole cards
    const cards = holeCardsContainer.querySelectorAll('.hole-card');
    cards.forEach(card => {
        revealHoleCard(card);
    });

    console.log('Peeking at hole cards');
}

function stopPeekingHoleCards(e) {
    if (!isViewingHoleCards) return;

    isViewingHoleCards = false;
    const holeCardsContainer = document.getElementById('holeCards');
    holeCardsContainer.classList.remove('peeking');

    // Hide all hole cards
    const cards = holeCardsContainer.querySelectorAll('.hole-card');
    cards.forEach(card => {
        hideHoleCard(card);
    });

    console.log('Stopped peeking at hole cards');
}

function revealHoleCard(cardDiv) {
    // Remove card back styling
    cardDiv.classList.remove('card-back');

    // Add suit class for coloring
    cardDiv.classList.add(cardDiv.dataset.suit);

    // Create and add card content
    const cardContent = document.createElement('div');
    cardContent.className = 'card-content';

    const rankSpan = document.createElement('span');
    rankSpan.className = 'card-rank';
    rankSpan.textContent = cardDiv.dataset.rank;

    const suitSpan = document.createElement('span');
    suitSpan.className = 'card-suit';
    suitSpan.textContent = getSuitSymbol(cardDiv.dataset.suit);

    cardContent.appendChild(rankSpan);
    cardContent.appendChild(suitSpan);
    cardDiv.appendChild(cardContent);
}

function hideHoleCard(cardDiv) {
    // Remove card content
    cardDiv.innerHTML = '';

    // Remove suit class
    cardDiv.classList.remove(cardDiv.dataset.suit);

    // Add card back styling
    cardDiv.classList.add('card-back');
}

function updatePhaseIndicator() {
    const phaseIndicator = document.getElementById('phaseIndicator');
    phaseIndicator.textContent = `Phase: ${gameState.phase}`;
}

function updateBlindsDisplay() {
    const blindsAmount = document.getElementById('blindsAmount');

    if (!blindsAmount) {
        return;
    }

    if (gameState && gameState.blinds) {
        blindsAmount.textContent = `${gameState.blinds.small}/${gameState.blinds.big}`;
    } else {
        blindsAmount.textContent = '1/2';
    }
}

function updateJoinGameSection() {
    const joinGameSection = document.getElementById('joinGameSection');

    // Check if current user is in the players list
    const isInGame = gameState.players && gameState.players.some(p => p.id === currentUser.id);

    if (!isInGame && !gameState.cardsDealt) {
        joinGameSection.classList.remove('hidden');
    } else {
        joinGameSection.classList.add('hidden');
    }
}

function createCardElement(card) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';

    if (!card.visible) {
        cardDiv.classList.add('card-back');
        return cardDiv;
    }

    cardDiv.classList.add(card.suit);

    const cardContent = document.createElement('div');
    cardContent.className = 'card-content';

    const rankSpan = document.createElement('span');
    rankSpan.className = 'card-rank';
    rankSpan.textContent = card.rank;

    const suitSpan = document.createElement('span');
    suitSpan.className = 'card-suit';
    suitSpan.textContent = getSuitSymbol(card.suit);

    cardContent.appendChild(rankSpan);
    cardContent.appendChild(suitSpan);
    cardDiv.appendChild(cardContent);

    return cardDiv;
}

function getSuitSymbol(suit) {
    const symbols = {
        'hearts': '♥',
        'diamonds': '♦',
        'clubs': '♣',
        'spades': '♠'
    };
    return symbols[suit] || suit;
}

function joinGame() {
    console.log('Attempting to join game');
    wsClient.send('join-game');
}

function chooseDealer() {
    console.log('Attempting to choose dealer randomly');
    wsClient.send('choose-dealer');
}

function selectPlayerAsDealer(playerId, playerName) {
    console.log(`Selecting ${playerName} as dealer`);
    wsClient.send('select-dealer', { playerId: playerId });
}

// Issue #31: Toggle player broke status
function togglePlayerBroke(playerId, playerName) {
    console.log(`Toggling broke status for ${playerName}`);
    wsClient.send('toggle-player-broke', { playerId: playerId });
}

async function resetGame() {
    console.log('Reset game button clicked');

    // Prompt for challenge phrase
    const challengePhrase = prompt('Enter the challenge phrase to reset the game:');

    if (!challengePhrase) {
        console.log('Reset cancelled - no phrase entered');
        return;
    }

    // Confirm the action
    const confirmed = confirm('Are you sure you want to reset the game? This will log out all players and clear the game state.');

    if (!confirmed) {
        console.log('Reset cancelled by user');
        return;
    }

    console.log('Attempting to reset game...');

    try {
        const response = await fetch('/api/game/reset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify({ challengePhrase })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('Game reset successful');
            showOverlay(data.message, 'reset');
            // Redirect to login after a short delay
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            console.error('Reset failed:', data.error);
            showError(data.error || 'Failed to reset game');
        }
    } catch (error) {
        console.error('Reset error:', error);
        showError('Network error. Please try again.');
    }
}

function updateChooseDealerButton() {
    const chooseDealerBtn = document.getElementById('chooseDealerBtn');

    // Issue #32: Enable button if:
    // - There are players in the game
    // - Cards have not been dealt (allow changing dealer anytime between hands)
    const hasPlayers = gameState.players && gameState.players.length > 0;
    const noCardsDealt = !gameState.cardsDealt;

    const shouldEnable = hasPlayers && noCardsDealt;

    chooseDealerBtn.disabled = !shouldEnable;

    console.log('Choose dealer button state:', {
        hasPlayers,
        noCardsDealt,
        shouldEnable
    });
}

async function logout() {
    console.log('Logging out...');

    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'same-origin'
        });
        wsClient.close();
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/';
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');

    setTimeout(() => {
        errorDiv.classList.remove('show');
    }, 5000);
}

const OVERLAY_CATEGORIES = {
    deal:    { icon: '🎴', color: 'overlay-deal' },
    reveal:  { icon: '♠',  color: 'overlay-reveal' },
    fold:    { icon: '✋', color: 'overlay-fold' },
    join:    { icon: '✅', color: 'overlay-join' },
    dealer:  { icon: '⭐', color: 'overlay-dealer' },
    timer:   { icon: '⏰', color: 'overlay-timer' },
    broke:   { icon: '💰', color: 'overlay-broke' },
    shuffle: { icon: '🔄', color: 'overlay-shuffle' },
    reset:   { icon: '🔄', color: 'overlay-reset' },
    default: { icon: '',   color: 'overlay-default' }
};

function showOverlay(message, category) {
    category = category || 'default';
    const cat = OVERLAY_CATEGORIES[category] || OVERLAY_CATEGORIES.default;

    // Duration map: timer overlays (blind increases) stay longer
    const OVERLAY_DURATIONS = { timer: '6s' };
    const duration = OVERLAY_DURATIONS[category] || '4s';

    // Remove any existing overlay
    const existing = document.querySelector('.overlay-notification');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = `overlay-notification ${cat.color}`;
    overlay.style.animationDuration = duration;

    if (cat.icon) {
        const iconDiv = document.createElement('div');
        iconDiv.className = 'overlay-icon';
        iconDiv.textContent = cat.icon;
        overlay.appendChild(iconDiv);
    }

    const textDiv = document.createElement('div');
    textDiv.className = 'overlay-text';
    textDiv.textContent = message;
    overlay.appendChild(textDiv);

    document.body.appendChild(overlay);

    // Auto-remove after animation completes
    overlay.addEventListener('animationend', () => overlay.remove());
}

// Keep showSuccess as alias for backward compat (used in dealer-controls.js)
function showSuccess(message) {
    showOverlay(message, 'default');
}

// Slide-to-Show functionality
const KNOB_PADDING = 5;
let slideStartX = 0;
let slideCurrentX = 0;
let isSliding = false;
let cardsAlreadyRevealed = false;

function updateSlideToShowControl() {
    const slideContainer = document.getElementById('slideToShowContainer');

    if (!slideContainer) {
        console.warn('slideToShowContainer element not found');
        return;
    }

    // Check if cards are dealt and user is in game
    const isInGame = gameState && gameState.players && gameState.players.some(p => p.id === currentUser.id);
    const cardsDealt = gameState && gameState.cardsDealt;
    const hasCards = gameState && gameState.holeCards && gameState.holeCards.length > 0;

    // Check if current user has already revealed their cards
    const hasRevealed = gameState && gameState.revealedHands &&
                        gameState.revealedHands.some(rh => rh.userId === currentUser.id);

    console.log('updateSlideToShowControl - isInGame:', isInGame, 'cardsDealt:', cardsDealt, 'hasCards:', hasCards, 'hasRevealed:', hasRevealed);
    console.log('currentUser:', currentUser);
    console.log('gameState.players:', gameState?.players);
    console.log('gameState.revealedHands:', gameState?.revealedHands);

    if (isInGame && cardsDealt && hasCards && !hasRevealed) {
        console.log('SHOWING slide control - removing hidden class');
        slideContainer.classList.remove('hidden');
        // Reset reveal flag when control becomes visible (Issue #18 fix)
        cardsAlreadyRevealed = false;
        setupSlideToShow();
    } else {
        console.log('HIDING slide control - adding hidden class. Reason: isInGame=' + isInGame + ', cardsDealt=' + cardsDealt + ', hasRevealed=' + hasRevealed);
        slideContainer.classList.add('hidden');
    }
}

function setupSlideToShow() {
    const slideButton = document.getElementById('slideButton');
    const slideTrack = slideButton.parentElement;

    // Remove existing listeners
    slideButton.replaceWith(slideButton.cloneNode(true));
    const newSlideButton = document.getElementById('slideButton');

    // Mouse events
    newSlideButton.addEventListener('mousedown', startSlide);
    document.addEventListener('mousemove', doSlide);
    document.addEventListener('mouseup', endSlide);

    // Touch events
    newSlideButton.addEventListener('touchstart', startSlide);
    document.addEventListener('touchmove', doSlide);
    document.addEventListener('touchend', endSlide);
}

function startSlide(e) {
    e.preventDefault();
    isSliding = true;

    const slideButton = document.getElementById('slideButton');
    const touch = e.touches ? e.touches[0] : e;
    slideStartX = touch.clientX - slideButton.offsetLeft;

    console.log('Started sliding to show cards');
}

function doSlide(e) {
    if (!isSliding) return;

    const touch = e.touches ? e.touches[0] : e;
    const slideButton = document.getElementById('slideButton');
    const slideTrack = slideButton.parentElement;
    const maxSlide = slideTrack.offsetWidth - slideButton.offsetWidth - 10;

    slideCurrentX = touch.clientX - slideStartX;

    // Constrain to track bounds
    if (slideCurrentX < KNOB_PADDING) slideCurrentX = KNOB_PADDING;
    if (slideCurrentX > maxSlide) slideCurrentX = maxSlide;

    slideButton.style.left = slideCurrentX + 'px';

    // Check if slid far enough (95% of track width - Issue #28)
    if (slideCurrentX >= maxSlide * 0.95 && !cardsAlreadyRevealed) {
        cardsAlreadyRevealed = true;
        revealMyCards();
    }
}

function endSlide(e) {
    if (!isSliding) return;

    isSliding = false;
    const slideButton = document.getElementById('slideButton');

    // Reset button position if not completed
    if (!cardsAlreadyRevealed) {
        slideButton.style.left = KNOB_PADDING + 'px';
    }
}

function revealMyCards() {
    console.log('Revealing my cards to all players');

    // Send WebSocket message to reveal cards
    wsClient.send('show-my-cards');

    // Hide the slide control
    const slideContainer = document.getElementById('slideToShowContainer');
    slideContainer.classList.add('hidden');

    showOverlay('Your cards have been revealed!', 'reveal');
}

// Slide-to-Fold functionality
let slideFoldStartX = 0;
let slideFoldCurrentX = 0;
let isSlidingFold = false;
let alreadyFolded = false;

function updateSlideToFoldControl() {
    const slideContainer = document.getElementById('slideToFoldContainer');

    if (!slideContainer) {
        console.warn('slideToFoldContainer element not found');
        return;
    }

    // Check if cards are dealt and user is in game
    const isInGame = gameState && gameState.players && gameState.players.some(p => p.id === currentUser.id);
    const cardsDealt = gameState && gameState.cardsDealt;
    const hasCards = gameState && gameState.holeCards && gameState.holeCards.length > 0;

    // Check if current user has already folded
    const currentPlayer = gameState && gameState.players && gameState.players.find(p => p.id === currentUser.id);
    const hasFolded = currentPlayer && currentPlayer.hasFolded;

    console.log('updateSlideToFoldControl - isInGame:', isInGame, 'cardsDealt:', cardsDealt, 'hasCards:', hasCards, 'hasFolded:', hasFolded);

    if (isInGame && cardsDealt && hasCards && !hasFolded) {
        console.log('SHOWING fold control - removing hidden class');
        slideContainer.classList.remove('hidden');
        alreadyFolded = false;
        setupSlideToFold();
    } else {
        console.log('HIDING fold control - adding hidden class');
        slideContainer.classList.add('hidden');
    }
}

function setupSlideToFold() {
    const slideFoldButton = document.getElementById('slideFoldButton');
    const slideTrack = slideFoldButton.parentElement;

    // Remove existing listeners
    slideFoldButton.replaceWith(slideFoldButton.cloneNode(true));
    const newSlideFoldButton = document.getElementById('slideFoldButton');

    // Mouse events
    newSlideFoldButton.addEventListener('mousedown', startSlideFold);
    document.addEventListener('mousemove', doSlideFold);
    document.addEventListener('mouseup', endSlideFold);

    // Touch events
    newSlideFoldButton.addEventListener('touchstart', startSlideFold);
    document.addEventListener('touchmove', doSlideFold);
    document.addEventListener('touchend', endSlideFold);
}

function startSlideFold(e) {
    e.preventDefault();
    isSlidingFold = true;

    const slideFoldButton = document.getElementById('slideFoldButton');
    const touch = e.touches ? e.touches[0] : e;
    slideFoldStartX = touch.clientX - slideFoldButton.offsetLeft;

    console.log('Started sliding to fold');
}

function doSlideFold(e) {
    if (!isSlidingFold) return;

    const touch = e.touches ? e.touches[0] : e;
    const slideFoldButton = document.getElementById('slideFoldButton');
    const slideTrack = slideFoldButton.parentElement;
    const maxSlide = slideTrack.offsetWidth - slideFoldButton.offsetWidth - 10;

    slideFoldCurrentX = touch.clientX - slideFoldStartX;

    // Constrain to track bounds
    if (slideFoldCurrentX < KNOB_PADDING) slideFoldCurrentX = KNOB_PADDING;
    if (slideFoldCurrentX > maxSlide) slideFoldCurrentX = maxSlide;

    slideFoldButton.style.left = slideFoldCurrentX + 'px';

    // Check if slid far enough (95% of track width - Issue #28)
    if (slideFoldCurrentX >= maxSlide * 0.95 && !alreadyFolded) {
        alreadyFolded = true;
        foldMyHand();
    }
}

function endSlideFold(e) {
    if (!isSlidingFold) return;

    isSlidingFold = false;
    const slideFoldButton = document.getElementById('slideFoldButton');

    // Reset button position if not completed
    if (!alreadyFolded) {
        slideFoldButton.style.left = KNOB_PADDING + 'px';
    }
}

function foldMyHand() {
    console.log('Folding my hand');

    // Send WebSocket message to fold
    wsClient.send('fold-hand');

    // Hide the slide control
    const slideContainer = document.getElementById('slideToFoldContainer');
    slideContainer.classList.add('hidden');

    // Also hide hole cards since we folded
    const holeCardsContainer = document.getElementById('holeCards');
    holeCardsContainer.innerHTML = '<div class="no-cards-message folded-message">You have folded</div>';

    // Hide the slide-to-show control as well
    const slideToShowContainer = document.getElementById('slideToShowContainer');
    if (slideToShowContainer) {
        slideToShowContainer.classList.add('hidden');
    }
}

function updateRevealedHands() {
    const revealedContainer = document.getElementById('revealedHandsContainer');

    if (!revealedContainer) {
        console.warn('revealedHandsContainer element not found');
        return;
    }

    if (!gameState || !gameState.revealedHands || gameState.revealedHands.length === 0) {
        revealedContainer.innerHTML = '';
        return;
    }

    revealedContainer.innerHTML = '';

    gameState.revealedHands.forEach(revealedHand => {
        const playerHandDiv = document.createElement('div');
        playerHandDiv.className = 'revealed-player-hand';

        const playerNameDiv = document.createElement('div');
        playerNameDiv.className = 'revealed-player-name';
        playerNameDiv.textContent = revealedHand.playerName;

        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'revealed-cards';

        revealedHand.cards.forEach(card => {
            const cardElement = createCardElement(card);
            cardsDiv.appendChild(cardElement);
        });

        playerHandDiv.appendChild(playerNameDiv);
        playerHandDiv.appendChild(cardsDiv);
        revealedContainer.appendChild(playerHandDiv);
    });

    console.log(`Displaying ${gameState.revealedHands.length} revealed hands`);
}

// Initialize when page loads
window.addEventListener('load', init);
