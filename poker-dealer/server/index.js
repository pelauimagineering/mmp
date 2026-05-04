// Load environment variables from .env file (for local development)
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const auth = require('./auth');
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const { initWebSocketServer } = require('./websocket');
const db = require('./db');
const jwtConfig = require('./jwt-config');

const PORT = process.env.PORT || 3000;
const app = express();

// Check for --reset flag
const resetFlag = process.argv.includes('--reset');

if (resetFlag) {
    console.log('\n===========================================');
    console.log('RESET MODE: Clearing game state and sessions');
    console.log('===========================================\n');
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Configure view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Validate JWT configuration
const jwtValidation = jwtConfig.validateJwtConfig();
if (!jwtValidation.valid) {
    console.warn('⚠️  WARNING: Missing JWT env vars:', jwtValidation.missing.join(', '));
}

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve login page as default
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// Serve game page (requires authentication)
app.get('/game', (req, res) => {
    const token = req.cookies.sessionToken;

    console.log('GET /game - Cookie present:', !!token);
    if (token) {
        console.log('Token:', token.substring(0, 8) + '...');
    }

    if (!token) {
        console.log('No session token, redirecting to login');
        return res.redirect('/');
    }

    auth.validateSession(token, (err, session) => {
        if (err || !session) {
            console.log('Session validation failed:', err?.message || 'Session not found');
            return res.redirect('/');
        }

        console.log('Session valid, rendering game.ejs for user:', session.display_name);

        const jwtToken = jwtConfig.getJwtForUser(session.user_name);

        if (!jwtToken) {
            console.error('No JWT configured for user:', session.user_name);
            return res.status(500).send('Video conferencing not configured for your account. Please contact support.');
        }

        res.render('game', {
            jwtToken: jwtToken,
            userName: session.display_name,
            userId: session.user_id
        });
    });
});

// Serve public community cards display (no authentication required)
app.get('/community', (req, res) => {
    const jwtToken = jwtConfig.getCommunityJwt();

    if (!jwtToken) {
        console.error('No JWT_COMMUNITY environment variable configured');
        return res.status(500).send('Video conferencing not configured. Please contact support.');
    }

    res.render('community', { jwtToken: jwtToken });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
initWebSocketServer(server);

// Cleanup expired sessions periodically (every hour)
setInterval(() => {
    console.log('Cleaning up expired sessions...');
    auth.cleanupExpiredSessions();
}, 60 * 60 * 1000);

// Perform reset if --reset flag is present
if (resetFlag) {
    console.log('Resetting game state...');
    db.gameState.reset((err) => {
        if (err) {
            console.error('Error resetting game state:', err);
        } else {
            console.log('✓ Game state reset');
        }

        console.log('Clearing all active sessions...');
        db.sessions.deleteAll((err) => {
            if (err) {
                console.error('Error clearing sessions:', err);
            } else {
                console.log('✓ All sessions cleared');
                console.log('✓ All users logged out\n');
            }

            startServer();
        });
    });
} else {
    startServer();
}

// Start server function
function startServer() {
    server.listen(PORT, () => {
        console.log(`\n===========================================`);
        console.log(`Poker Dealer Server Started`);
        console.log(`===========================================`);
        console.log(`Server running on: http://localhost:${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        if (resetFlag) {
            console.log(`Reset Mode: Game state and sessions cleared`);
        }
        console.log(`===========================================\n`);
    });
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        const db = require('./db');
        db.close();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nSIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        const db = require('./db');
        db.close();
        process.exit(0);
    });
});
