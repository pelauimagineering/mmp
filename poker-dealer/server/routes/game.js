const express = require('express');
const router = express.Router();
const db = require('../db');

// Challenge phrase for reset (case-insensitive) - loaded from environment variable
const RESET_CHALLENGE_PHRASE = process.env.RESET_PHRASE || 'milliken mills posse';

// Reset game endpoint (protected by challenge phrase)
router.post('/reset', (req, res) => {
    console.log('Reset game request received');

    const { challengePhrase } = req.body;

    if (!challengePhrase) {
        return res.status(400).json({
            error: 'Challenge phrase is required',
            success: false
        });
    }

    // Verify challenge phrase (case-insensitive)
    if (challengePhrase.trim().toLowerCase() !== RESET_CHALLENGE_PHRASE) {
        console.log('Invalid challenge phrase attempt:', challengePhrase);
        return res.status(403).json({
            error: 'Incorrect challenge phrase. Please try again.',
            success: false
        });
    }

    console.log('Valid challenge phrase, resetting game...');

    // Reset game state
    db.gameState.reset((err) => {
        if (err) {
            console.error('Error resetting game state:', err);
            return res.status(500).json({
                error: 'Failed to reset game state',
                success: false
            });
        }

        console.log('✓ Game state reset');

        // Clear all active sessions
        db.sessions.deleteAll((err) => {
            if (err) {
                console.error('Error clearing sessions:', err);
                return res.status(500).json({
                    error: 'Failed to clear sessions',
                    success: false
                });
            }

            console.log('✓ All sessions cleared');
            console.log('✓ All users logged out');

            // Notify via WebSocket that game has been reset
            const { notifyGameReset } = require('../websocket');
            notifyGameReset();

            res.json({
                success: true,
                message: 'Game has been reset successfully. All players have been logged out.'
            });
        });
    });
});

module.exports = router;
