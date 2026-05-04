-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT NOT NULL,
    user_name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Game state table
CREATE TABLE IF NOT EXISTS game_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    current_dealer_index INTEGER DEFAULT 0,
    player_order TEXT DEFAULT '[]',
    deck_state TEXT DEFAULT NULL,
    community_cards TEXT DEFAULT '[]',
    phase TEXT DEFAULT 'waiting',
    cards_dealt BOOLEAN DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- Timer fields for blind level tracking
    timer_start_time TEXT DEFAULT NULL,
    timer_duration_seconds INTEGER DEFAULT 420,
    blinds_will_increase INTEGER DEFAULT 0,
    -- Blind amounts
    small_blind INTEGER DEFAULT 1,
    big_blind INTEGER DEFAULT 2
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Initialize game state with single row
INSERT OR IGNORE INTO game_state (id) VALUES (1);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_name ON users(user_name);
