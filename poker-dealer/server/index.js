// Load environment variables from .env file (for local development)
require('dotenv').config();

const express = require('express');
const http = require('http');
const fs = require('fs');
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
app.use(express.static(path.join(__dirname, '..', 'public'), {
    index: false,
    setHeaders(res, filePath) {
        // Vite fingerprints everything under /app/assets, so it can be cached hard.
        if (filePath.includes(`${path.sep}app${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// React client shell
//
// Every page is the same Vite-built bundle (public/app). The server decides
// which page to mount and hands it boot data (page, user, video token) as
// JSON embedded in the shell.
// ---------------------------------------------------------------------------
const MANIFEST_PATH = path.join(__dirname, '..', 'public', 'app', '.vite', 'manifest.json');
let cachedAssets = null;

function getClientAssets() {
    if (cachedAssets && process.env.NODE_ENV === 'production') {
        return cachedAssets;
    }
    try {
        const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
        const entry = Object.values(manifest).find((chunk) => chunk.isEntry);
        cachedAssets = {
            js: `/app/${entry.file}`,
            css: (entry.css || []).map((file) => `/app/${file}`),
            // Preload the Latin UI and display fonts so text doesn't reflow after first paint.
            fonts: (entry.assets || [])
                .filter((file) => /(atkinson-hyperlegible-next|besley)-latin-wght-normal/.test(file))
                .map((file) => `/app/${file}`)
        };
        return cachedAssets;
    } catch (error) {
        return null;
    }
}

const PAGE_TITLES = {
    login: 'Take a seat · MMP Poker',
    game: 'Your seat · MMP Poker',
    community: 'The board · MMP Poker'
};

function renderApp(res, page, boot = {}) {
    const assets = getClientAssets();
    if (!assets) {
        console.error('Client bundle missing. Run "npm run build" in poker-dealer/.');
        return res.status(503).send('The poker client has not been built yet. Run "npm run build" and reload.');
    }

    // Embedded as JSON inside a <script>; escape "<" so no value can close the tag.
    const bootJson = JSON.stringify({ page, ...boot }).replace(/</g, '\\u003c');

    res.set('Cache-Control', 'no-store');
    res.render('app', { title: PAGE_TITLES[page], assets, bootJson });
}

// Sample-data mode for design work: /?demo=1, /game?demo=flop, /community?demo=showdown
function isDemo(req) {
    return typeof req.query.demo === 'string' && req.query.demo.length > 0;
}

// Serve login page as default
app.get('/', (req, res) => {
    renderApp(res, 'login', { demo: isDemo(req) ? req.query.demo : null });
});

// Serve game page (requires authentication)
app.get('/game', (req, res) => {
    if (isDemo(req)) {
        return renderApp(res, 'game', { demo: req.query.demo });
    }

    const token = req.cookies.sessionToken;

    if (!token) {
        console.log('No session token, redirecting to login');
        return res.redirect('/');
    }

    auth.validateSession(token, (err, session) => {
        if (err || !session) {
            console.log('Session validation failed:', err?.message || 'Session not found');
            return res.redirect('/');
        }

        // Video is optional: without a token for this player the table still
        // works and the video drawer explains why it is unavailable.
        const jwtToken = jwtConfig.getJwtForUser(session.user_name);

        renderApp(res, 'game', {
            jwtToken: jwtToken || null,
            user: {
                id: session.user_id,
                display_name: session.display_name,
                user_name: session.user_name
            }
        });
    });
});

// Serve public community cards display (no authentication required)
app.get('/community', (req, res) => {
    renderApp(res, 'community', {
        jwtToken: jwtConfig.getCommunityJwt() || null,
        demo: isDemo(req) ? req.query.demo : null
    });
});

// Create HTTP server
const server = http.createServer(app);

// The WebSocket server (and with it the game manager, which loads the saved
// game) is created in startServer(), after any --reset has cleared the
// database. Created earlier, it would load the old game and write it back.
let wss = null;

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
    wss = initWebSocketServer(server);

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

// Graceful shutdown.
// server.close() only stops new connections; it waits forever for open
// WebSockets. Close them explicitly so players' phones notice straight away
// and reconnect to the new instance instead of idling on a dead one.
let shuttingDown = false;
function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received: closing sockets and HTTP server`);

    const clients = wss ? wss.clients : [];
    for (const client of clients) {
        try { client.close(1001, 'Server restarting'); } catch (error) { /* already gone */ }
    }

    const finish = () => {
        try { db.close(); } catch (error) { /* already closed */ }
        process.exit(0);
    };

    server.close(finish);
    // Don't hang on a socket that never completes its close handshake.
    setTimeout(() => {
        for (const client of clients) client.terminate();
        finish();
    }, 2000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
