let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 2000;

function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    console.log('Connecting to WebSocket:', wsUrl);

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttempts = 0;
        updateConnectionStatus(true);

        // Send public auth message (no token needed for community view)
        ws.send(JSON.stringify({
            type: 'auth-public',
            view: 'community'
        }));

        // Request initial game state
        ws.send(JSON.stringify({
            type: 'get-community-state'
        }));
    };

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            console.log('WebSocket message received:', message.type);
            handleMessage(message);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false);
    };

    ws.onclose = () => {
        console.log('WebSocket connection closed');
        updateConnectionStatus(false);

        // Attempt to reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);

            setTimeout(() => {
                connect();
            }, reconnectDelay);
        }
    };
}

function handleMessage(message) {
    switch (message.type) {
        case 'community-state':
            updateCommunityCards(message.data);
            break;

        case 'game-state':
            updateCommunityCards(message.data);
            break;

        case 'cards-dealt':
            console.log('Cards dealt!');
            break;

        case 'community-revealed':
            console.log('Community card revealed:', message.phase);
            break;

        case 'error':
            console.error('Server error:', message.message);
            break;
    }
}

function updateCommunityCards(state) {
    if (!state) {
        return;
    }

    console.log('Updating community cards with state:', state);

    // Update community cards
    const communityCards = document.getElementById('communityCards');

    if (!state.communityCards || state.communityCards.length === 0) {
        communityCards.innerHTML = '<div class="no-cards-message">Waiting for cards to be dealt...</div>';
    } else {
        communityCards.innerHTML = '';

        state.communityCards.forEach(card => {
            const cardElement = createCardElement(card);
            communityCards.appendChild(cardElement);
        });
    }

    // Update phase indicator
    updatePhaseIndicator(state.phase || 'waiting');

    // Update revealed hands
    updateRevealedHands(state.revealedHands || []);

    // Update blind level timer (Issue #27)
    if (state.timerState && typeof blindTimer !== 'undefined') {
        blindTimer.update(state.timerState);
    }

    // Update blinds display (Issue #27)
    updateBlindsDisplay(state.blinds);
}

// Update blinds display (Issue #27)
function updateBlindsDisplay(blinds) {
    const blindsAmount = document.getElementById('blindsAmount');
    if (blindsAmount && blinds) {
        blindsAmount.textContent = `${blinds.small}/${blinds.big}`;
    }
}

function updatePhaseIndicator(phase) {
    const phaseIndicator = document.getElementById('phaseIndicator');

    const phaseNames = {
        'waiting': 'Waiting for game to start',
        'pre-flop': 'Pre-Flop - Cards Dealt',
        'flop': 'Flop',
        'turn': 'Turn',
        'river': 'River',
        'complete': 'Hand Complete'
    };

    phaseIndicator.textContent = phaseNames[phase] || phase;
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

    // Add flip animation
    cardDiv.classList.add('flipping');
    setTimeout(() => {
        cardDiv.classList.remove('flipping');
    }, 500);

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

function updateRevealedHands(revealedHands) {
    console.log('Updating revealed hands:', revealedHands);

    const revealedSection = document.getElementById('revealedHandsSection');
    const revealedContainer = document.getElementById('revealedHandsContainer');
    const phaseIndicator = document.getElementById('phaseIndicator');

    if (!revealedSection || !revealedContainer) {
        console.warn('Revealed hands elements not found');
        return;
    }

    // If no revealed hands, hide the section and show phase indicator
    if (!revealedHands || revealedHands.length === 0) {
        revealedSection.classList.add('hidden');
        revealedContainer.innerHTML = '';
        if (phaseIndicator) {
            phaseIndicator.classList.remove('hidden');
        }
        return;
    }

    // Show the section and populate with revealed hands, hide phase indicator
    revealedSection.classList.remove('hidden');
    revealedContainer.innerHTML = '';
    if (phaseIndicator) {
        phaseIndicator.classList.add('hidden');
    }

    revealedHands.forEach(hand => {
        const handDiv = document.createElement('div');
        handDiv.className = 'revealed-hand-compact';

        // Player name label
        const nameLabel = document.createElement('div');
        nameLabel.className = 'player-name-compact';
        nameLabel.textContent = hand.playerName;
        handDiv.appendChild(nameLabel);

        // Cards container
        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'revealed-cards-compact';

        hand.cards.forEach(card => {
            const cardElement = createCardElement(card);
            cardElement.classList.add('card-compact'); // Add compact styling
            cardsDiv.appendChild(cardElement);
        });

        handDiv.appendChild(cardsDiv);
        revealedContainer.appendChild(handDiv);
    });
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');

    if (indicator && text) {
        if (connected) {
            indicator.classList.add('connected');
            text.textContent = 'Connected';
        } else {
            indicator.classList.remove('connected');
            text.textContent = 'Disconnected';
        }
    }
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

// Initialize when page loads
window.addEventListener('load', () => {
    console.log('Initializing community display...');
    connect();
    setupVideoToggle();
});
