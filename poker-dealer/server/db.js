const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'database', 'poker-dealer.db');

let db = null;

function getDb() {
    if (!db) {
        console.log(`Opening database at: ${DB_PATH}`);
        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('Error opening database:', err);
            } else {
                db.run('PRAGMA foreign_keys = ON');
            }
        });
    }
    return db;
}

// User operations
const userOps = {
    findById(id, callback) {
        const query = 'SELECT * FROM users WHERE id = ?';
        getDb().get(query, [id], callback);
    },

    findByUserName(userName, callback) {
        const query = 'SELECT * FROM users WHERE user_name = ?';
        getDb().get(query, [userName], callback);
    },

    getAll(callback) {
        const query = 'SELECT id, display_name, user_name FROM users ORDER BY display_name';
        getDb().all(query, [], callback);
    },

    updateDisplayName(id, displayName, callback) {
        const query = 'UPDATE users SET display_name = ? WHERE id = ?';
        getDb().run(query, [displayName, id], callback);
    },

    create(displayName, userName, callback) {
        const query = 'INSERT INTO users (display_name, user_name) VALUES (?, ?)';
        getDb().run(query, [displayName, userName], callback);
    }
};

// Session operations
const sessionOps = {
    create(userId, token, expiresAt, callback) {
        const query = 'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)';
        getDb().run(query, [userId, token, expiresAt], callback);
    },

    findByToken(token, callback) {
        const query = `
            SELECT s.*, u.id as user_id, u.display_name, u.user_name
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ? AND s.expires_at > datetime('now')
        `;
        getDb().get(query, [token], callback);
    },

    getLoggedInUserIds(callback) {
        const query = `
            SELECT DISTINCT user_id
            FROM sessions
            WHERE expires_at > datetime('now')
        `;
        getDb().all(query, [], (err, rows) => {
            if (err) {
                callback(err, null);
            } else {
                callback(null, rows.map(row => row.user_id));
            }
        });
    },

    delete(token, callback) {
        const query = 'DELETE FROM sessions WHERE token = ?';
        getDb().run(query, [token], callback);
    },

    deleteExpired(callback) {
        const query = `DELETE FROM sessions WHERE expires_at <= datetime('now')`;
        getDb().run(query, [], callback);
    },

    deleteByUserId(userId, callback) {
        const query = 'DELETE FROM sessions WHERE user_id = ?';
        getDb().run(query, [userId], callback);
    },

    deleteAll(callback) {
        const query = 'DELETE FROM sessions';
        getDb().run(query, [], callback);
    }
};

// Game state operations
const gameStateOps = {
    get(callback) {
        const query = 'SELECT * FROM game_state WHERE id = 1';
        getDb().get(query, [], (err, result) => {
            if (err) {
                callback(err);
                return;
            }

            if (result) {
                const parsed = {
                    ...result,
                    player_order: JSON.parse(result.player_order || '[]'),
                    community_cards: JSON.parse(result.community_cards || '[]'),
                    deck_state: result.deck_state ? JSON.parse(result.deck_state) : null,
                    cards_dealt: Boolean(result.cards_dealt),
                    timer_start_time: result.timer_start_time || null,
                    timer_duration_seconds: result.timer_duration_seconds || 420,
                    blinds_will_increase: Boolean(result.blinds_will_increase),
                    small_blind: result.small_blind || 1,
                    big_blind: result.big_blind || 2,
                    timer_paused: Boolean(result.timer_paused),
                    timer_remaining_when_paused: result.timer_remaining_when_paused != null ? result.timer_remaining_when_paused : null
                };
                callback(null, parsed);
            } else {
                callback(null, null);
            }
        });
    },

    update(gameState, callback) {
        const query = `
            UPDATE game_state
            SET current_dealer_index = ?,
                player_order = ?,
                deck_state = ?,
                community_cards = ?,
                phase = ?,
                cards_dealt = ?,
                updated_at = datetime('now'),
                timer_start_time = ?,
                timer_duration_seconds = ?,
                blinds_will_increase = ?,
                small_blind = ?,
                big_blind = ?,
                timer_paused = ?,
                timer_remaining_when_paused = ?
            WHERE id = 1
        `;

        getDb().run(
            query,
            [
                gameState.current_dealer_index,
                JSON.stringify(gameState.player_order || []),
                gameState.deck_state ? JSON.stringify(gameState.deck_state) : null,
                JSON.stringify(gameState.community_cards || []),
                gameState.phase,
                gameState.cards_dealt ? 1 : 0,
                gameState.timer_start_time || null,
                gameState.timer_duration_seconds || 420,
                gameState.blinds_will_increase ? 1 : 0,
                gameState.small_blind || 1,
                gameState.big_blind || 2,
                gameState.timer_paused ? 1 : 0,
                gameState.timer_remaining_when_paused != null ? gameState.timer_remaining_when_paused : null
            ],
            callback
        );
    },

    reset(callback) {
        const query = `
            UPDATE game_state
            SET current_dealer_index = 0,
                player_order = '[]',
                deck_state = NULL,
                community_cards = '[]',
                phase = 'waiting',
                cards_dealt = 0,
                updated_at = datetime('now'),
                timer_start_time = NULL,
                timer_duration_seconds = 420,
                blinds_will_increase = 0,
                small_blind = 1,
                big_blind = 2,
                timer_paused = 0,
                timer_remaining_when_paused = NULL
            WHERE id = 1
        `;
        getDb().run(query, [], callback);
    }
};

function close() {
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            }
            db = null;
        });
    }
}

module.exports = {
    getDb,
    users: userOps,
    sessions: sessionOps,
    gameState: gameStateOps,
    close
};
