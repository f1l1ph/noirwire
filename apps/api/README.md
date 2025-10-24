# NoirWire API

NestJS API server for zero-knowledge private payments on Solana.

Handles proof generation (snarkjs), transaction indexing, encrypted note management, and wallet synchronization.

## Tech Stack

NestJS 11 • Node.js 18+ • snarkjs 0.7.5 • Supabase • Solana

## Local Development

### Option 1: Local (Fast Development)

```bash
yarn install          # Install dependencies
yarn dev              # Start dev server (watch mode, hot-reload)
```

API runs on http://localhost:3000

### Option 2: Docker (Production-like)

```bash
# From project root
docker-compose up -d api

# View logs
docker logs -f noirwire-api

# Rebuild after code changes
docker-compose build api
docker-compose restart api
```

### Build Circuits (Required for Development)

```bash
cd external/noirwire-contracts/zk-circuits
make all
```

---

## API Endpoints

````

---

## � Docker Development & Production

See **[DOCKER.md](./DOCKER.md)** for comprehensive guide covering:

- Local development with Docker
- Production deployment to 6+ platforms
- Environment configuration
- CI/CD pipeline setup
- Monitoring and logging
- Troubleshooting

### Quick Docker Commands

```bash
# From project root

# Build
docker-compose build api

# Start
docker-compose up -d api

# Logs
docker logs -f noirwire-api

# Stop
docker-compose down
````

---

## 🚀 Production Deployment

### Detailed Instructions

👉 **See [DOCKER.md](./DOCKER.md) for complete production guide**

Includes step-by-step instructions for:

- AWS ECS
- Google Cloud Run
- Azure Container Instances
- Railway
- Render
- And more...

### Quick Summary

```bash
# Build Docker image
docker build -f ../../Dockerfile -t noirwire-api:v1.0.0 .

# Push to your registry
docker tag noirwire-api:v1.0.0 YOUR-REGISTRY/noirwire-api:v1.0.0
docker push YOUR-REGISTRY/noirwire-api:v1.0.0

# Deploy using your platform's tools
# (See DOCKER.md for platform-specific instructions)
```

### Environment Variables

```bash
# Supabase (production)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Solana (production or devnet)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NOIRWIRE_PROGRAM_ID=<your-program-id>
SOLANA_COMMITMENT=confirmed

# API
NODE_ENV=production
LOG_LEVEL=info

# CORS (for frontend)
CORS_ORIGINS=https://your-frontend.vercel.app,https://your-domain.com
```

### Platforms Comparison

| Platform         | Startup    | Scaling    | Cost | Maintenance |
| ---------------- | ---------- | ---------- | ---- | ----------- |
| Railway          | ⭐⭐⭐⭐⭐ | ⭐⭐⭐     | $$   | ⭐⭐        |
| Google Cloud Run | ⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐ | $    | ⭐⭐⭐      |
| AWS ECS          | ⭐⭐       | ⭐⭐⭐⭐⭐ | $$   | ⭐⭐⭐⭐    |
| Azure            | ⭐⭐       | ⭐⭐⭐     | $$   | ⭐⭐⭐⭐    |
| Render           | ⭐⭐⭐⭐   | ⭐⭐⭐     | $$   | ⭐⭐        |
| Heroku           | ⭐⭐⭐⭐⭐ | ⭐⭐       | $$$  | ⭐          |

**Recommendation:** Start with Railway (fastest), scale to GCP Cloud Run or AWS ECS

---

## API Endpoints

### Indexer

- `GET /indexer/status` - Status of all merkle trees
- `GET /indexer/:circuit/commitments` - Get commitments for circuit
- `GET /indexer/:circuit/root` - Get merkle root for circuit
- `POST /indexer/:circuit/proof` - Generate proof
- `POST /indexer/:circuit/commit` - Add commitment to tree
- `POST /indexer/:circuit/sync` - Sync with blockchain

### Wallet

- `POST /wallet/add-note` - Store encrypted note
- `POST /wallet/spend-note` - Mark note as spent
- `POST /wallet/select-notes` - Select notes for transaction

### More Details

See source code in `src/` for full API documentation

---

## Error Handling

The API uses semantic error codes instead of generic HTTP status codes:

- `COMMITMENT_NOT_FOUND` - Commitment not in merkle tree
- `EMPTY_TREE` - No commitments in tree yet
- `INVALID_COMMITMENT_FORMAT` - Malformed commitment
- `PROOF_GENERATION_FAILED` - Proof generation error
- `VERIFICATION_KEY_MISSING` - WASM artifact missing
- `WASM_NOT_FOUND` - Proof circuit not found

See `src/common/error-codes.ts` for complete list.

---

## Testing

```bash
# Run tests
yarn test

# Run with coverage
yarn test:cov

# E2E tests
yarn test:e2e

# E2E against production
yarn test:e2e:prod
```

---

## Development Workflow

### Making Changes

1. **Local development (recommended for speed)**:

   ```bash
   yarn dev
   ```

2. **Or with Docker**:

   ```bash
   docker-compose build api
   docker-compose up -d api
   ```

3. **Test your changes**
4. **Commit and push**

## Troubleshooting

### "Cannot find module '@repo/api'"

```bash
# Rebuild workspace
yarn build

# Or in Docker
docker-compose build api --no-cache
```

### "WASM artifact missing"

```bash
# Check dist folder
ls -la dist/apps/api/proofs/

# Rebuild
docker-compose build api --no-cache
```

### "Supabase connection failed"

```bash
# Check environment variables
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_KEY

# Verify they're correct in .env.local
```

### "Port 3000 already in use"

```bash
lsof -i :3000
# Kill the process
kill -9 <PID>
```

## License

UNLICENSED
