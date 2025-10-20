# NoirWire API

NestJS API server for zero-knowledge private payments on Solana.

Handles proof generation (snarkjs), transaction indexing, encrypted note management, and wallet synchronization.

## Tech Stack

NestJS 11 • Node.js 18+ • snarkjs 0.7.5 • Supabase • Solana

## Local Development

```bash
npm install          # Install dependencies
npm run dev         # Start dev server (watch mode)
```

API runs on http://localhost:3000

### Build Circuits (Required)

```bash
cd external/noirwire-contracts/zk-circuits
make all
```

---

## 🚀 Production Deployment

### Quick Start (Railway)

```bash
cd apps/api

# Option 1: Makefile
make quick-deploy

# Option 2: npm
npm run railway:deploy
```

### Environment Variables

```bash
NODE_ENV=production
SOLANA_RPC_URL=https://api.devnet.solana.com
NOIRWIRE_PROGRAM_ID=Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz
SOLANA_COMMITMENT=confirmed
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
CORS_ORIGINS=https://your-frontend.vercel.app
```

### Deploy to Railway

**Dashboard (Easiest):**
1. Go to https://railway.app
2. Create project from GitHub repo
3. Add environment variables
4. Deploy automatically

**CLI:**
```bash
cd apps/api

# Makefile commands
make railway-login
make railway-link
make railway-vars      # Sets basic vars
make railway-deploy

# Or npm scripts
npm run railway:deploy
npm run railway:logs
npm run railway:status
```

**Railway auto-detects the monorepo** and builds from root using `npm workspaces`.

### Why Railway?

✅ Long-running server support (proof generation takes 2-4s)  
✅ Auto PORT assignment  
✅ Built-in monitoring  
✅ ~$5-10/month  

⚠️ **Don't use Vercel** - 10s timeout, designed for serverless

### Monorepo Notes

This API is part of a monorepo. Railway:
- Builds from root (resolves `@repo/api` workspace)
- Uses `nixpacks.toml` and `railway.toml` in root
- Starts with `node apps/api/dist/main.js`

Commands run from `apps/api`, but Railway finds root config automatically.

### Troubleshooting

**Build fails:** Check Railway logs, ensure `tsconfig.json` not ignored  
**Crashes:** Verify all env vars set, check Supabase credentials  
**CORS errors:** Add frontend URL to `CORS_ORIGINS`  
**Proof timeout:** Increase Railway memory (up to 8GB available)

### Mainnet

```bash
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NOIRWIRE_PROGRAM_ID=<your-mainnet-program-id>
```

Consider paid RPC: Helius, QuickNode, or Alchemy

---

## License

UNLICENSED
