// Dealer controls functionality

let isDealerNow = false;

// Setup dealer controls after WebSocket is connected
function setupDealerControls() {
    const dealBtn = document.getElementById('dealBtn');
    const flipBtn = document.getElementById('flipBtn');
    const shuffleBtn = document.getElementById('shuffleBtn');

    if (dealBtn) {
        dealBtn.addEventListener('click', dealCards);
    }

    if (flipBtn) {
        flipBtn.addEventListener('click', flipCommunityCard);
    }

    // Issue #29: Add shuffle button handler
    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', shuffleDeck);
    }

    // Issue #49: Timer control handlers
    const timerPauseBtn = document.getElementById('timerPauseBtn');
    const timerResumeBtn = document.getElementById('timerResumeBtn');
    const timerResetBtn = document.getElementById('timerResetBtn');

    if (timerPauseBtn) {
        timerPauseBtn.addEventListener('click', pauseTimer);
    }
    if (timerResumeBtn) {
        timerResumeBtn.addEventListener('click', resumeTimer);
    }
    if (timerResetBtn) {
        timerResetBtn.addEventListener('click', resetTimer);
    }

    // Update dealer UI whenever game state changes
    wsClient.on('game-state', (message) => {
        updateDealerUI(message.data);
    });
}

function updateDealerUI(state) {
    const dealerControlsSection = document.getElementById('dealerControlsSection');
    const dealBtn = document.getElementById('dealBtn');
    const flipBtn = document.getElementById('flipBtn');

    console.log('updateDealerUI called - state:', state);
    console.log('currentUser:', currentUser);
    console.log('dealerControlsSection exists:', !!dealerControlsSection);

    if (!state || !state.players) {
        console.log('No state or players - hiding controls');
        if (dealerControlsSection) {
            dealerControlsSection.classList.add('hidden');
        }
        return;
    }

    // Check if current user is the dealer
    const currentDealer = state.players.find(p => p.isDealer);
    console.log('Current dealer from state:', currentDealer);

    isDealerNow = currentDealer && currentUser && currentDealer.id === currentUser.id;

    console.log('Is dealer:', isDealerNow, '- currentDealer.id:', currentDealer?.id, 'currentUser.id:', currentUser?.id);

    // Issue #49: Timer controls visibility
    const timerControls = document.getElementById('timerControls');
    const timerPauseBtn = document.getElementById('timerPauseBtn');
    const timerResumeBtn = document.getElementById('timerResumeBtn');
    const timerResetBtn = document.getElementById('timerResetBtn');

    if (isDealerNow) {
        console.log('User IS dealer - showing controls');
        if (dealerControlsSection) {
            dealerControlsSection.classList.remove('hidden');
        }

        // Show timer controls when dealer and timer has started or blindsWillIncrease
        const timerState = state.timerState;
        const showTimerControls = timerState && (timerState.isRunning || timerState.isPaused || timerState.blindsWillIncrease);

        if (timerControls) {
            if (showTimerControls) {
                timerControls.classList.remove('hidden');
            } else {
                timerControls.classList.add('hidden');
            }
        }

        // Toggle pause/resume button visibility based on paused state
        if (timerPauseBtn && timerResumeBtn) {
            if (timerState && timerState.isPaused) {
                timerPauseBtn.classList.add('hidden');
                timerResumeBtn.classList.remove('hidden');
            } else {
                timerPauseBtn.classList.remove('hidden');
                timerResumeBtn.classList.add('hidden');
            }
        }

        // Show reset when timer has started or blindsWillIncrease
        if (timerResetBtn) {
            if (showTimerControls) {
                timerResetBtn.classList.remove('hidden');
            } else {
                timerResetBtn.classList.add('hidden');
            }
        }

        // Update button states based on game phase
        updateButtonStates(state.phase, state.cardsDealt);
    } else {
        console.log('User is NOT dealer - hiding controls');
        if (dealerControlsSection) {
            dealerControlsSection.classList.add('hidden');
        }
        if (timerControls) {
            timerControls.classList.add('hidden');
        }
    }
}

function updateButtonStates(phase, cardsDealt) {
    const dealBtn = document.getElementById('dealBtn');
    const flipBtn = document.getElementById('flipBtn');
    const shuffleBtn = document.getElementById('shuffleBtn');

    console.log('Updating button states - Phase:', phase, 'Cards dealt:', cardsDealt);

    // Deal button: enabled when in 'waiting' or 'complete' phase
    if (phase === 'waiting' || phase === 'complete') {
        dealBtn.disabled = false;
        dealBtn.textContent = 'Deal Cards';
    } else {
        dealBtn.disabled = true;
        dealBtn.textContent = 'Cards Dealt';
    }

    // Issue #29: Shuffle button enabled when cards not dealt
    if (shuffleBtn) {
        shuffleBtn.disabled = cardsDealt;
    }

    // Flip button: enabled based on phase
    switch (phase) {
        case 'pre-flop':
            flipBtn.disabled = false;
            flipBtn.textContent = 'Reveal Flop';
            break;
        case 'flop':
            flipBtn.disabled = false;
            flipBtn.textContent = 'Reveal Turn';
            break;
        case 'turn':
            flipBtn.disabled = false;
            flipBtn.textContent = 'Reveal River';
            break;
        case 'river':
            flipBtn.disabled = false;
            flipBtn.textContent = 'Complete Hand';
            break;
        default:
            flipBtn.disabled = true;
            flipBtn.textContent = 'Flip Community Card';
    }
}

function dealCards() {
    console.log('Dealer dealing cards');

    if (!isDealerNow) {
        showError('Only the dealer can deal cards');
        return;
    }

    wsClient.send('deal-cards');
}

function flipCommunityCard() {
    console.log('Dealer flipping community card');

    if (!isDealerNow) {
        showError('Only the dealer can flip cards');
        return;
    }

    wsClient.send('flip-community-card');
}

// Issue #29: Shuffle deck function
function shuffleDeck() {
    console.log('Dealer shuffling deck');

    if (!isDealerNow) {
        showError('Only the dealer can shuffle the deck');
        return;
    }

    wsClient.send('shuffle-deck');
    showOverlay('Deck has been shuffled!', 'shuffle');
}

// Issue #49: Timer control functions
function pauseTimer() {
    if (!isDealerNow) return;
    wsClient.send('pause-timer');
}

function resumeTimer() {
    if (!isDealerNow) return;
    wsClient.send('resume-timer');
}

function resetTimer() {
    if (!isDealerNow) return;
    wsClient.send('reset-timer');
}

// setupDealerControls() is called directly from game.js init()
// to avoid race conditions with WebSocket game-state messages.
