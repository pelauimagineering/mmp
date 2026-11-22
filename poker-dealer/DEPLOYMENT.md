# Deployment Guide

This guide covers running the Poker Dealer app in production: first the DigitalOcean App Platform deployment at `poker.pelau.com`, then a self-hosted Docker setup on a droplet.

The app lives in the `poker-dealer/` folder of the [pelauimagineering/mmp](https://github.com/pelauimagineering/mmp) repository. All commands below run from that folder.

## What the app needs in production

- **HTTPS.** With `NODE_ENV=production` the login cookie is marked `Secure`, so logging in over plain HTTP does not stick. Browsers also refuse camera and microphone access on plain HTTP.
- **A built client.** The pages are a React bundle that `npm run build` writes to `public/app`. Without it every page answers "The poker client has not been built yet". The Dockerfile runs the build for you.
- **A seeded database.** `node scripts/init-db.js` creates the SQLite file and the player list. The Dockerfile runs this too.
- **Jitsi (8x8 JaaS) tokens, for video only.** The table works without them. A player with no token sees the video drawer explain that video is unavailable.

There are no passwords. Players log in by picking their name from a list, so anyone who can reach the site can sit down as any player. Share the URL only with your group.

## Environment variables

| Variable | Needed | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Yes, `production` | Turns on the `Secure` login cookie and caches the client asset list |
| `PORT` | No (default `3000`) | Port the server listens on |
| `DATABASE_PATH` | No | SQLite file location. Default is `database/poker-dealer.db` |
| `RESET_PHRASE` | Recommended | Phrase a player types to reset the game. Write it in lower case: the app lower-cases what the player types before comparing. If unset, a default that is visible in the source code applies |
| `JWT_<USERNAME>` | For video | One 8x8 JaaS token per player, for example `JWT_GARY`. The name is the player's user name in upper case |
| `JWT_COMMUNITY` | For video | Token for the public `/community` display |

The current players are `gary`, `neave`, `harish`, `chris`, `tony`, `seymour`, `kerwin`, `wayne`, `dee`, `lorenzo`, `jb` and `evan`.

On startup the server logs `WARNING: Missing JWT env vars: ...` and lists every token it could not find. Check for that line after each deploy.

`SESSION_SECRET` appears in `docker-compose.yml` and older notes, but the app does not read it.

**Adding a player** takes two code changes and one token: add them to the list in `scripts/init-db.js`, add a matching entry in `server/jwt-config.js`, and set their `JWT_<USERNAME>`. Without the last two the player can still play, without video.

## DigitalOcean App Platform (production)

The live app runs on DigitalOcean App Platform. Its build and run settings are kept in the DigitalOcean dashboard, not in this repository; `.do/dev-config.yaml` at the repository root only records the app ID.

What the platform has to do, however it is configured:

- Use `poker-dealer/` as the source directory
- Install dependencies, run `npm run build`, run `node scripts/init-db.js`, then start `node server/index.js`. Building from `poker-dealer/Dockerfile` does all four
- Route HTTP to port `3000`
- Use `/api/health` as the health check

Set the environment variables from the table above under the app's **Settings → App-Level Environment Variables**, and mark the tokens as encrypted. `docker-compose.yml` is not used on App Platform, so nothing in that file affects production.

HTTPS and the certificate for the custom domain are handled by the platform.

**The filesystem is temporary.** Every deploy or restart starts from a freshly seeded database: a game in progress, everyone's login and any edited display names are gone, and the seeded players are back. Deploy between game nights, not during one.

To deploy, push to the branch the app tracks, or use **Actions → Deploy** in the dashboard. Then:

1. Open **Runtime Logs** and confirm there is no `Missing JWT env vars` warning
2. Load `https://poker.pelau.com/api/health` and expect `{"status":"ok",...}`
3. Log in as one player and open the video drawer

## Self-hosted with Docker (droplet)

Use this to run the app on your own server. The database is kept in a Docker volume, so it survives restarts and updates.

### Prerequisites

- An Ubuntu LTS server with SSH access
- A domain name pointed at the server (needed for HTTPS)
- 8x8 JaaS tokens if you want video

### Step 1: Install Docker

```bash
ssh root@your_server_ip
apt update && apt upgrade -y

curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

docker --version
docker compose version
```

This guide uses `docker compose` (with a space). The older standalone `docker-compose` command is no longer maintained.

### Step 2: Get the code and configure it

```bash
mkdir -p /opt/mmp
git clone https://github.com/pelauimagineering/mmp.git /opt/mmp
cd /opt/mmp/poker-dealer
```

Create `.env`. There is no `.env.example` in the repository:
```bash
nano .env
chmod 600 .env
```

```env
RESET_PHRASE=<choose-your-own-phrase-in-lower-case>

JWT_GARY=<token>
JWT_NEAVE=<token>
JWT_HARISH=<token>
JWT_CHRIS=<token>
JWT_TONY=<token>
JWT_SEYMOUR=<token>
JWT_KERWIN=<token>
JWT_WAYNE=<token>
JWT_DEE=<token>
JWT_LORENZO=<token>
JWT_JB=<token>
JWT_EVAN=<token>

JWT_COMMUNITY=<token>
```

`PORT`, `NODE_ENV` and `DATABASE_PATH` are already set by `docker-compose.yml`. Never commit `.env`; it is listed in `.gitignore` and `.dockerignore`.

Create `docker-compose.override.yml` next to `docker-compose.yml`. Compose picks it up automatically:
```yaml
services:
  poker-dealer:
    # Pass everything in .env (the tokens and RESET_PHRASE) to the app
    env_file: .env
    # Only listen on localhost; Nginx is the public entry point
    ports: !override
      - "127.0.0.1:3000:3000"
```

Why this file is needed:

- `docker-compose.yml` passes only `NODE_ENV`, `PORT`, `SESSION_SECRET` and `DATABASE_PATH` to the container, and `.env` is not copied into the image. Without `env_file` the app runs, with no video and the default reset phrase.
- Docker publishes ports straight through the firewall, bypassing UFW. Without the `ports` line, port 3000 is reachable from the internet. `!override` needs Docker Compose 2.24 or newer.

### Step 3: Build and run

```bash
docker compose build
docker compose up -d
```

The image build compiles the client and creates the seeded database, and the first start copies that database into the `poker-dealer-data` volume. You do not need to initialize the database by hand on a new install.

Check that it is running:
```bash
docker compose ps
docker compose logs --tail 50
curl http://localhost:3000/api/health
```

The health check should return `{"status":"ok",...}`, and the logs should not contain the `Missing JWT env vars` warning.

### Step 4: Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Step 5: Nginx reverse proxy

```bash
apt install nginx -y
nano /etc/nginx/sites-available/poker-dealer
```

The app opens its WebSocket on the site root, so one `location /` block with the upgrade headers covers both pages and WebSocket traffic:
```nginx
server {
    listen 80;
    server_name your_domain.com;  # Replace with your domain

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/poker-dealer /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Step 6: SSL with Let's Encrypt (required)

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your_domain.com
```

Certbot configures Nginx for HTTPS and sets up renewal. Test renewal with:
```bash
certbot renew --dry-run
```

### Step 7: Check it

- Players: `https://your_domain.com`
- Shared TV display (no login): `https://your_domain.com/community`

Log in as one player and confirm the table loads before game night.

### Maintenance

View logs:
```bash
docker compose logs -f
```

Restart:
```bash
docker compose restart
```

Players can also clear the table and log everyone out from inside the app; it asks for `RESET_PHRASE`.

Update:
```bash
cd /opt/mmp
git pull
cd poker-dealer
docker compose build
docker compose up -d

# Apply database changes to the existing database
docker compose exec poker-dealer node scripts/init-db.js
docker compose restart
```

Do not skip the `init-db.js` step. The database lives in a volume that survives updates, so new columns and newly added players only reach it when this script runs. It is safe to run repeatedly: it adds what is missing and leaves existing players, sessions and game state alone.

Back up the database. The container does not include the `sqlite3` command-line tool, so copy the file while the app is stopped:
```bash
docker compose stop
docker cp poker-dealer:/app/database/poker-dealer.db ./backup-$(date +%Y%m%d).db
docker compose start
```

Restore the database:
```bash
docker compose stop

# Copy the backup into the container
docker cp backup.db poker-dealer:/app/database/poker-dealer.db

# Hand the file back to the app's user, otherwise the database is read-only
docker compose run --rm --no-deps --user root --entrypoint chown poker-dealer node:node /app/database/poker-dealer.db

docker compose start
```

## Without Docker

Install a current Node.js LTS release (the app needs Node 18 or newer; Node 18 itself is end-of-life), then:

```bash
git clone https://github.com/pelauimagineering/mmp.git /opt/mmp
cd /opt/mmp/poker-dealer
npm install
npm run build
npm run db:init
```

`npm install` needs the development dependencies, because the client build uses them.

Create `.env` as in Step 2 and add:
```env
PORT=3000
NODE_ENV=production
```

Run it under a process manager, for example PM2:
```bash
npm install -g pm2
pm2 start server/index.js --name poker-dealer
pm2 save
pm2 startup
```

Then set up the firewall, Nginx and SSL as in Steps 4 to 6. To update, run `git pull`, `npm install`, `npm run build`, `npm run db:init` and `pm2 restart poker-dealer`.

## Monitoring

The health check endpoint is `/api/health`. Docker runs it itself; `docker compose ps` shows the result. Point an uptime monitor (UptimeRobot, Pingdom, DigitalOcean Monitoring) at the same URL.

```bash
docker stats poker-dealer
```

## Security checklist

1. **Keep the URL private**: there are no passwords
2. **Use HTTPS**: login does not work without it in production
3. **Set `RESET_PHRASE`**: otherwise the default phrase from the source code applies
4. **Protect the tokens**: encrypted variables on App Platform, `chmod 600 .env` on a server
5. **Self-hosted**: open only ports 80 and 443, keep port 3000 bound to localhost, and back up the database

## Troubleshooting

### "The poker client has not been built yet"
Run `npm run build` in `poker-dealer/`, or rebuild the Docker image.

### Video is unavailable for a player
- Their `JWT_<USERNAME>` is missing. Check the startup logs for `Missing JWT env vars`
- Docker: confirm `docker-compose.override.yml` exists and contains `env_file: .env`, then run `docker compose up -d`
- If the variable is set and video is still unavailable, the player has no entry in `server/jwt-config.js`

### Login returns to the login page
The site is being used over plain HTTP, or the certificate is invalid. In production the login cookie is only sent over HTTPS.

### Everyone was logged out and the game is gone
On App Platform this happens on every deploy or restart, because the filesystem is temporary.

### WebSocket connection fails
- Ensure the Nginx `location /` block has the `Upgrade` and `Connection` headers
- Check firewall rules and the SSL certificate

### Game state stops saving after an update (self-hosted)
Run the `init-db.js` step from the update procedure; the database is missing columns added in a newer version.

### Database locked or read-only errors (self-hosted)
```bash
docker compose down
docker compose up -d
```
If the error started after a restore, re-run the `chown` step from the restore procedure.

### Container won't start
```bash
docker compose logs
docker compose ps
```

## Scaling

The app keeps one game in memory in one process, backed by one SQLite file. It is built for a single table of friends: run exactly one instance. It cannot be run as multiple instances behind a load balancer without code changes.
