# NoirWire

Zero-knowledge privacy protocol for Solana using Groth16 proofs with end-to-end encrypted messaging.

## Features

- 🔒 **Private Payments**: Shield, transfer, and unshield tokens using zero-knowledge proofs
- 💬 **Secure Messaging**: E2E encrypted wallet-to-wallet messaging with realtime updates
- 🎯 **Dashboard**: Modern UI with easy access to all features

## Quick Start

### Prerequisites

- Node.js >= 18.x
- Yarn 1.22.x

### Development

```bash
# Install dependencies
yarn install

# Run web + API together
yarn dev

# Or separately
yarn dev:web      # Web: http://localhost:3001
yarn dev:api      # API: http://localhost:3000

# Build for production
yarn build
```

## Environment Setup

### Required Variables

Create `.env.local` in `apps/api/`:

```bash
# Supabase (get from: https://app.supabase.com/project/_/settings/api)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_role_key

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
NOIRWIRE_PROGRAM_ID=Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz
SOLANA_COMMITMENT=confirmed

# Admin keypair for Merkle root publishing
# Get from: cat ~/.config/solana/devnet-wallet.json
SOLANA_ADMIN_KEYPAIR=[your,keypair,bytes,here]
```

⚠️ **Never commit `.env.local` to git** - it contains secrets!

### Web App Config

Create `.env.local` in `apps/web/`:

```bash
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Railway Deployment

Deploy the API to Railway:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login & init
railway login
railway init

# Add environment variables
railway variables set \
  SUPABASE_URL=your_url \
  SUPABASE_SERVICE_KEY=your_key \
  SOLANA_RPC_URL=https://api.devnet.solana.com \
  NOIRWIRE_PROGRAM_ID=Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz \
  SOLANA_COMMITMENT=confirmed \
  SOLANA_ADMIN_KEYPAIR=[your,keypair,bytes]

# Deploy
railway up
```

Or via Railway Dashboard:

1. Connect GitHub repo
2. Add environment variables
3. Set build: `yarn build`
4. Set start: `yarn start`
5. Deploy

## Troubleshooting

### Merkle Root Timeout (60 seconds)

**Error**: "Merkle root pending on-chain after 60 seconds"

**Solution**: Add `SOLANA_ADMIN_KEYPAIR` to `.env.local` and restart

```bash
docker-compose down api && docker-compose up -d api
docker logs noirwire-api | grep "Admin keypair"
```

### Insufficient SOL

**Error**: "insufficient funds" when publishing roots

```bash
# Get admin address from logs
docker logs noirwire-api | grep "Admin keypair loaded"

# Airdrop SOL (devnet only)
solana airdrop 2 <your_admin_address> --url devnet
```

### Port Already in Use

```bash
lsof -ti:3000 | xargs kill -9  # Kill API
lsof -ti:3001 | xargs kill -9  # Kill web
```

## Local Docker Testing

```bash
# Run API in Docker (web runs locally)
docker-compose up -d api
yarn dev:web
```

## License

See LICENSE file for details.
