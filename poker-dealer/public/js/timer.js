// Blind Level Timer Module
class BlindTimer {
    constructor() {
        this.timerState = null;
        this.localInterval = null;
        this.localRemainingSeconds = 0;
        this.onExpireCallback = null;
    }

    // Update timer with state from server
    update(timerState) {
        console.log('Timer update:', timerState);
        this.timerState = timerState;

        if (timerState && timerState.isPaused) {
            // Timer is paused - show frozen remaining time
            this.localRemainingSeconds = timerState.remainingSeconds;
            this.stopLocalCountdown();
        } else if (timerState && timerState.isRunning) {
            // Calculate local remaining time from server start time
            const startTime = new Date(timerState.startTime);
            const now = new Date();
            const elapsedSeconds = Math.floor((now - startTime) / 1000);
            this.localRemainingSeconds = Math.max(0, timerState.durationSeconds - elapsedSeconds);

            // Start local countdown if not already running
            if (!this.localInterval) {
                this.startLocalCountdown();
            }
        } else {
            // Timer not running, show default state
            this.localRemainingSeconds = timerState ? timerState.durationSeconds : 420;
            this.stopLocalCountdown();
        }

        this.updateDisplay();
    }

    startLocalCountdown() {
        if (this.localInterval) return;

        this.localInterval = setInterval(() => {
            if (this.localRemainingSeconds > 0) {
                this.localRemainingSeconds--;
                this.updateDisplay();

                // Check for warning thresholds
                if (this.localRemainingSeconds === 60) {
                    this.showWarning('1 minute remaining!');
                } else if (this.localRemainingSeconds === 30) {
                    this.showWarning('30 seconds remaining!');
                } else if (this.localRemainingSeconds === 10) {
                    this.showWarning('10 seconds remaining!');
                }
            } else {
                // Timer expired locally
                this.stopLocalCountdown();
            }
        }, 1000);
    }

    stopLocalCountdown() {
        if (this.localInterval) {
            clearInterval(this.localInterval);
            this.localInterval = null;
        }
    }

    updateDisplay() {
        const timerCountdown = document.getElementById('timerCountdown');
        const timerSection = document.getElementById('timerSection');
        const timerAlert = document.getElementById('timerAlert');

        if (!timerCountdown || !timerSection) {
            return;
        }

        // Format time as M:SS
        const minutes = Math.floor(this.localRemainingSeconds / 60);
        const seconds = this.localRemainingSeconds % 60;
        const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        timerCountdown.textContent = formattedTime;

        // Update timer section classes based on state
        timerSection.classList.remove('timer-warning', 'timer-critical', 'timer-expired', 'timer-paused');

        // Handle paused state
        if (this.timerState && this.timerState.isPaused) {
            timerSection.classList.add('timer-paused');
            timerSection.classList.remove('timer-idle');
            if (timerAlert) {
                timerAlert.classList.add('hidden');
            }
            return;
        }

        if (this.timerState && this.timerState.blindsWillIncrease) {
            timerSection.classList.add('timer-expired');
            if (timerAlert) {
                timerAlert.classList.remove('hidden');
            }
        } else if (this.localRemainingSeconds <= 30) {
            timerSection.classList.add('timer-critical');
            if (timerAlert) {
                timerAlert.classList.add('hidden');
            }
        } else if (this.localRemainingSeconds <= 60) {
            timerSection.classList.add('timer-warning');
            if (timerAlert) {
                timerAlert.classList.add('hidden');
            }
        } else {
            if (timerAlert) {
                timerAlert.classList.add('hidden');
            }
        }

        // Show/hide timer based on whether it's running
        if (this.timerState && this.timerState.isRunning) {
            timerSection.classList.remove('timer-idle');
        } else {
            timerSection.classList.add('timer-idle');
        }
    }

    showWarning(message) {
        console.log(`Timer warning: ${message}`);
        // You could add visual/audio notifications here
    }

    showExpiredAlert() {
        const timerAlert = document.getElementById('timerAlert');
        if (timerAlert) {
            timerAlert.classList.remove('hidden');
        }
    }

    hideExpiredAlert() {
        const timerAlert = document.getElementById('timerAlert');
        if (timerAlert) {
            timerAlert.classList.add('hidden');
        }
    }

    // Set callback for when timer expires
    onExpire(callback) {
        this.onExpireCallback = callback;
    }

    destroy() {
        this.stopLocalCountdown();
    }
}

// Global timer instance
const blindTimer = new BlindTimer();
