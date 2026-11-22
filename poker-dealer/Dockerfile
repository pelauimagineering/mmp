# Use Node.js 18 LTS as base image
#FROM node:18-alpine
FROM node:latest

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install everything (the React client needs its build tools)
RUN npm install --ignore-scripts && npm rebuild

# Copy application files
COPY server/ ./server/
COPY public/ ./public/
COPY views/ ./views/
COPY database/ ./database/
COPY scripts/ ./scripts/
COPY client/ ./client/
COPY vite.config.js ./

# Build the React client into public/app, then drop the build tools
RUN npm run build && npm prune --omit=dev

# Create database directory with proper permissions
RUN mkdir -p /app/database && \
    chown -R node:node /app

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Load the initial data into the database
RUN node scripts/init-db.js

# Start the application
# CMD ["node", "server/index.js"]
ENTRYPOINT ["node", "server/index.js"]