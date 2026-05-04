# Deployment Guide

This guide covers deploying the Poker Dealer application to Digital Ocean and other cloud platforms.

## Digital Ocean Deployment

### Prerequisites

- A Digital Ocean account
- Basic knowledge of SSH and Linux commands
- A domain name (optional, but recommended)

### Step 1: Create a Droplet

1. Log in to your Digital Ocean account
2. Click "Create" → "Droplets"
3. Choose an image:
   - **Distribution**: Ubuntu 22.04 LTS
   - **Plan**: Basic ($6/month is sufficient for small groups)
   - **CPU options**: Regular Intel with SSD
4. Choose a datacenter region close to your users
5. **Authentication**: Add your SSH key or use password
6. **Hostname**: Choose a memorable name (e.g., "poker-dealer")
7. Click "Create Droplet"

### Step 2: Initial Server Setup

SSH into your droplet:
```bash
ssh root@your_droplet_ip
```

Update the system:
```bash
apt update && apt upgrade -y
```

Install Docker and Docker Compose:
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Verify installation
docker --version
docker-compose --version
```

### Step 3: Deploy the Application

Create application directory:
```bash
mkdir -p /opt/poker-dealer
cd /opt/poker-dealer
```

Clone your repository or upload files:
```bash
# Option 1: Clone from Git
git clone <your-repository-url> .

# Option 2: Upload files via SCP from your local machine
# (Run this from your local machine, not the server)
# scp -r /path/to/poker-dealer root@your_droplet_ip:/opt/poker-dealer/
```

Create environment file:
```bash
cp .env.example .env
nano .env
```

Update the `.env` file:
```env
PORT=3000
NODE_ENV=production
SESSION_SECRET=<generate-a-random-secret-here>
DATABASE_PATH=/app/database/poker-dealer.db
```

To generate a random secret:
```bash
openssl rand -base64 32
```

### Step 4: Build and Run with Docker

Build the Docker image:
```bash
docker-compose build
```

Start the application:
```bash
docker-compose up -d
```

Initialize the database (first time only):
```bash
docker-compose exec poker-dealer node scripts/init-db.js
```

Check that it's running:
```bash
docker-compose ps
docker-compose logs -f
```

### Step 5: Configure Firewall

Enable UFW firewall:
```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Step 6: Set Up Nginx Reverse Proxy (Recommended)

Install Nginx:
```bash
apt install nginx -y
```

Create Nginx configuration:
```bash
nano /etc/nginx/sites-available/poker-dealer
```

Add the following configuration:
```nginx
server {
    listen 80;
    server_name your_domain.com;  # Replace with your domain or droplet IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable the site:
```bash
ln -s /etc/nginx/sites-available/poker-dealer /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Step 7: Set Up SSL with Let's Encrypt (Optional but Recommended)

Install Certbot:
```bash
apt install certbot python3-certbot-nginx -y
```

Obtain SSL certificate:
```bash
certbot --nginx -d your_domain.com
```

Follow the prompts. Certbot will automatically configure Nginx for HTTPS.

Auto-renewal is set up automatically. Test it with:
```bash
certbot renew --dry-run
```

### Step 8: Access Your Application

Your application should now be accessible at:
- HTTP: `http://your_domain.com` or `http://your_droplet_ip`
- HTTPS: `https://your_domain.com` (if SSL is configured)

## Maintenance

### Viewing Logs
```bash
docker-compose logs -f
```

### Restarting the Application
```bash
docker-compose restart
```

### Updating the Application
```bash
cd /opt/poker-dealer
git pull  # If using Git
docker-compose down
docker-compose build
docker-compose up -d
```

### Backup Database
```bash
# Create backup
docker-compose exec poker-dealer sqlite3 /app/database/poker-dealer.db ".backup '/app/database/backup.db'"

# Copy backup to host
docker cp poker-dealer:/app/database/backup.db ./backup-$(date +%Y%m%d).db
```

### Restore Database
```bash
# Copy backup to container
docker cp backup.db poker-dealer:/app/database/poker-dealer.db

# Restart application
docker-compose restart
```

## Alternative Deployment Methods

### Direct Node.js Installation (Without Docker)

Install Node.js:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
```

Clone and setup:
```bash
cd /opt/poker-dealer
npm install --production
npm run db:init
```

Install PM2 for process management:
```bash
npm install -g pm2
```

Start the application:
```bash
pm2 start server/index.js --name poker-dealer
pm2 save
pm2 startup
```

### Using Other Cloud Providers

#### AWS EC2
Follow similar steps as Digital Ocean, but:
1. Launch an EC2 instance (Ubuntu 22.04 LTS)
2. Configure Security Groups to allow ports 80, 443, and 3000
3. Use Elastic IP for a static IP address

#### Google Cloud Platform
1. Create a Compute Engine instance
2. Configure firewall rules for HTTP/HTTPS
3. Follow the same Docker deployment steps

#### Heroku
1. Create a `Procfile`:
   ```
   web: node server/index.js
   ```
2. Deploy:
   ```bash
   heroku create
   git push heroku main
   ```

## Monitoring

### Health Checks
The application includes a health check endpoint at `/api/health`.

Set up monitoring with:
- UptimeRobot (free)
- Pingdom
- Digital Ocean Monitoring (built-in)

### Resource Monitoring
```bash
# View container stats
docker stats poker-dealer

# View system resources
htop
```

## Security Best Practices

1. **Change Default Credentials**: Update all test account passwords
2. **Use HTTPS**: Always use SSL in production
3. **Firewall**: Only open necessary ports
4. **Regular Updates**: Keep the system and dependencies updated
5. **Backup**: Regularly backup the database
6. **Session Secret**: Use a strong, random session secret
7. **Rate Limiting**: Consider adding rate limiting for login attempts

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs

# Check container status
docker-compose ps
```

### WebSocket connection fails
- Ensure Nginx is configured for WebSocket (Upgrade header)
- Check firewall rules
- Verify SSL certificate if using HTTPS

### Database locked errors
```bash
# Stop the application
docker-compose down

# Restart
docker-compose up -d
```

### Out of memory
- Upgrade to a larger droplet
- Monitor with `docker stats`
- Check for memory leaks in logs

## Scaling Considerations

For larger deployments:
- Use a managed database service (PostgreSQL on Digital Ocean)
- Implement Redis for session storage
- Load balance across multiple instances
- Use a CDN for static assets
- Implement connection pooling for WebSockets

## Support

For issues or questions:
1. Check the application logs
2. Review the README.md
3. Open an issue on GitHub
4. Contact the development team
