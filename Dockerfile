# Build stage - compile TypeScript
FROM node:20-slim AS builder

WORKDIR /app

# Copy workspace configuration and lock file
COPY package.json yarn.lock ./

# Copy all packages for monorepo resolution
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/

# Install all dependencies (including devDeps needed for build)
RUN yarn install

# Copy source code
COPY . .

# Build workspace libraries
RUN yarn --cwd packages/api build

# Build API application
RUN yarn --cwd apps/api build

# Production stage - runtime only
FROM node:20-slim

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

# Copy workspace configuration
COPY package.json yarn.lock ./
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/

# Install production dependencies only
RUN yarn install --production

# Copy compiled application from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist

# Create non-root user for security
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "apps/api/dist/apps/api/src/main.js"]
