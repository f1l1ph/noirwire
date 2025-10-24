# Build stage - compile TypeScript
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace configuration and lock file
COPY package.json yarn.lock ./

# Copy all packages for monorepo resolution
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/

# Install all dependencies (including devDeps needed for build)
RUN yarn install --frozen-lockfile

# Copy source code and circuit artifacts
COPY . .

# Build workspace libraries
RUN yarn --cwd packages/api build

# Build API application
RUN yarn --cwd apps/api build

# Copy proofs folder into dist (not compiled by NestJS)
RUN cp -r /app/apps/api/proofs /app/apps/api/dist/apps/api/ || true

# Production stage - runtime only
FROM node:22-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy workspace configuration
COPY package.json yarn.lock ./
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/

# Install production dependencies only
RUN yarn install --production --frozen-lockfile

# Copy compiled application from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist

# Note: Proofs are already in dist/apps/api/proofs from the builder stage
# The dist folder includes everything needed for the app to run

# Create non-root user for security
RUN addgroup -g 1001 -S appuser && adduser -u 1001 -S appuser -G appuser
USER appuser

EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "apps/api/dist/apps/api/src/main.js"]
