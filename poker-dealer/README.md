# Poker Dealer

A digital card dealer for in-person sessions of Texas Hold'em poker games. Players join via their own mobile or desktop devices for a seamless, real-time poker experience.

## Features

- **Multi-Player Support**: Up to 10 players can join simultaneously
- **Real-Time Communication**: WebSocket-based instant updates for all players
- **Automatic Dealer Rotation**: Dealer position rotates clockwise after each hand
- **Minimal Authentication**: Simple login system with test accounts
- **Mobile-Friendly**: Responsive design works on phones, tablets, and desktops
- **Community & Hole Cards**: Separate views for shared community cards and private hole cards
- **Dealer Controls**: Dedicated interface for the dealer to manage the game
- **Docker Support**: Easy deployment with containerization

## Technology Stack

- **Backend**: Node.js with Express
- **WebSocket**: ws library for real-time communication
- **Database**: SQLite (embedded) for lightweight data persistence
- **Frontend**: Plain HTML, CSS, and JavaScript
- **Deployment**: Docker containerization

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm (comes with Node.js)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd poker-dealer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize the database**
   ```bash
   npm run db:init
   ```

4. **Start the server**
   ```bash
   npm start
   ```

   **Optional: Start with reset** (clears game state and logs out all users)
   ```bash
   npm run start:reset
   # or
   node server/index.js --reset
   ```

5. **Open your browser**
   ```
   Navigate to http://localhost:3000
   ```

### Using Docker

1. **Build the Docker image**
   ```bash
   docker build -t poker-dealer .
   ```

2. **Run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **Initialize the database** (first time only)
   ```bash
   docker-compose exec poker-dealer node scripts/init-db.js
   ```

4. **Access the application**
   ```
   Navigate to http://localhost:3000
   ```

## How to Play

1. **Login**: Each player logs in with their own credentials on their device
2. **Join Game**: Click "Join Game" to enter the poker session
3. **Player Order**: Players are seated in the order they join
4. **Dealer Selection**: The first dealer is chosen randomly
5. **Optional**: Display community cards on a shared screen at `/community` (no authentication required)
6. **Deal Cards**: The dealer clicks "Deal Cards" to distribute hole cards and community cards
7. **Reveal Cards**: The dealer uses the "Flip" button to reveal community cards:
   - First flip: Reveals the Flop (3 cards)
   - Second flip: Reveals the Turn (1 card)
   - Third flip: Reveals the River (1 card)
   - Fourth click: Completes the hand and rotates the dealer
8. **Betting**: Handle betting in-person (outside the app)
9. **Next Hand**: Dealer button moves to the next player, repeat from step 6

## Public Community Cards Display

The application includes a public view for displaying community cards on a shared screen:

- **URL**: `http://localhost:3000/community`
- **No Authentication Required**: This view can be accessed without logging in
- **Real-Time Updates**: Automatically updates when cards are dealt or revealed
- **Large Card Display**: Optimized for viewing from a distance
- **Responsive**: Works on TVs, tablets, or any device

This is perfect for displaying the community cards on a TV or shared screen while players use their own devices to view their private hole cards.

## Game Rules

- **Joining**: Players can only join before cards are dealt
- **Hole Cards**: Each player sees only their own 2 hole cards
- **Community Cards**: All players see the same 5 community cards
- **Dealer Rotation**: Dealer position rotates clockwise after each completed hand
- **Phases**: The game progresses through: Waiting → Pre-Flop → Flop → Turn → River → Complete

## Project Structure

```
poker-dealer/
├── server/                 # Backend server code
│   ├── index.js           # Main server entry point
│   ├── auth.js            # Authentication logic
│   ├── db.js              # Database operations
│   ├── websocket.js       # WebSocket server
│   ├── game-manager.js    # Game state management
│   ├── routes/            # API routes
│   └── game/              # Game logic
│       ├── deck.js        # Card deck logic
│       └── poker-game.js  # Texas Hold'em game logic
├── public/                # Frontend static files
│   ├── css/              # Stylesheets
│   ├── js/               # Client-side JavaScript
│   ├── login.html        # Login page
│   └── game.html         # Game interface
├── database/             # Database files
│   └── schema.sql        # Database schema
├── scripts/              # Utility scripts
│   └── init-db.js        # Database initialization
├── Dockerfile            # Docker configuration
├── docker-compose.yml    # Docker Compose configuration
└── package.json          # Node.js dependencies

```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email and password
- `POST /api/auth/logout` - Logout current session
- `GET /api/auth/session` - Check current session status

### Game Management
- `POST /api/game/reset` - Reset game state and log out all users (requires reset phrase authentication)
  - **Request Body**: `{ "phrase": "your-reset-phrase" }`
  - **Response**: `{ "success": true, "message": "Game reset successfully" }`
  - **Configuration**: Set `RESET_CHALLENGE_PHRASE` environment variable (default: "reset game now")

### Health Check
- `GET /api/health` - Server health check

### WebSocket Messages

**Client → Server:**
- `auth` - Authenticate WebSocket connection
- `join-game` - Join the current game
- `deal-cards` - Deal cards (dealer only)
- `flip-community-card` - Reveal next community card (dealer only)
- `get-state` - Request current game state

**Server → Client:**
- `authenticated` - Authentication confirmation
- `game-state` - Complete game state update
- `cards-dealt` - Cards have been dealt notification
- `community-revealed` - Community card revealed notification
- `join-accepted` - Join request accepted
- `join-rejected` - Join request rejected
- `error` - Error message

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=your-random-secret-here
DATABASE_PATH=./database/poker-dealer.db
RESET_CHALLENGE_PHRASE=your-custom-reset-phrase
```

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)
- `SESSION_SECRET` - Secret for session encryption (change in production)
- `DATABASE_PATH` - Path to SQLite database file
- `RESET_CHALLENGE_PHRASE` - Required phrase for game reset API endpoint (default: "reset game now")

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions for Digital Ocean and other cloud platforms.

## Security Considerations

- Sessions expire after 24 hours
- WebSocket connections are authenticated
- HTTPS/WSS should be used in production (via reverse proxy)
- Change `SESSION_SECRET` in production

## Troubleshooting

### Resetting Game State
If you need to clear all active games and log out all users:
```bash
npm run start:reset
```

This will:
- Reset the game state (clear players, cards, dealer position)
- Log out all users (clear all sessions)
- Start the server with a clean slate

Useful when:
- Starting a new game session
- Testing from a fresh state
- Resolving game state corruption issues

### Database Issues
If you encounter database errors:
```bash
rm database/*.db
npm run db:init
```

### Connection Issues
- Ensure port 3000 is not in use by another application
- Check firewall settings if accessing from other devices
- Verify WebSocket connection in browser console

### Docker Issues
```bash
# View logs
docker-compose logs -f

# Restart container
docker-compose restart

# Rebuild image
docker-compose down
docker-compose up --build -d
```

## Development

### Running in Development Mode
```bash
npm run dev
```

This uses Node.js watch mode to automatically restart on file changes.

### Testing Multi-Device
1. Start the server
2. Find your local IP address (e.g., `192.168.1.100`)
3. On mobile devices, navigate to `http://<your-ip>:3000`
4. Login with different test accounts on each device

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
