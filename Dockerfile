# Multi-stage Dockerfile optimized for Render.com deployment
# Stage 1: Builder
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy project files
COPY . .

# Build client (Vite -> dist) and server (esbuild -> dist-server)
RUN npm run build

# Stage 2: Production Runner
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000
ENV HOST=0.0.0.0

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application & assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/server/fonts ./server/fonts
COPY --from=builder /app/data/masters ./data/masters

# Prepare data directories
RUN mkdir -p /app/data /var/data && chown -R node:node /app /var/data

USER node

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e 'fetch("http://127.0.0.1:" + (process.env.PORT || 10000) + "/healthz").then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))'

CMD ["node", "dist-server/index.js"]

