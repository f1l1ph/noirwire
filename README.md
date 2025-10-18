# NoirWire

Zero-knowledge privacy protocol for Solana using Groth16 proofs.

## Prerequisites

- **Node.js** >= 18.x
- **Yarn** 1.22.x
- **Rust** >= 1.70 (for contracts)
- **Solana CLI** >= 1.18.20 (for contracts)
- **Anchor** >= 0.31.1 (for contracts)
- **circom** (for ZK circuits)

## Installation

```bash
# Install dependencies
yarn install

# Install Solana toolchain (if deploying contracts)
cd external/noirwire-contracts
make install-solana
make install-anchor
```

## Configuration

### API Setup

Copy the environment file and configure:

```bash
cd apps/api
cp .env.example .env
```

Edit `.env` with your settings:

- `SOLANA_RPC_URL` - Solana RPC endpoint (devnet/mainnet)
- `NOIRWIRE_PROGRAM_ID` - Deployed program address

### Contracts Setup (Optional)

Only needed if deploying your own instance:

```bash
cd external/noirwire-contracts

# Build ZK circuits
cd zk-circuits
make all

# Deploy to devnet
cd ..
make config-devnet
make airdrop
make build
make deploy-devnet
make init-devnet
make upload-vk-devnet
```

## Running

### Development Mode

Start both web and API servers:

```bash
yarn dev
```

Or run individually:

```bash
# Web app (Next.js) - http://localhost:3001
yarn dev:web

# API server (NestJS) - http://localhost:3000
yarn dev:api
```

### Production Build

```bash
yarn build
```

## Project Structure

```
apps/
  api/          - NestJS backend (proof generation, indexer)
  web/          - Next.js frontend (wallet UI)
external/
  noirwire-contracts/
    programs/   - Solana programs (Rust)
    zk-circuits/ - circom circuits (shield/transfer/unshield)
packages/       - Shared TypeScript packages
```

## Key Commands

```bash
# Development
yarn dev              # Run web + API
yarn dev:web          # Web only
yarn dev:api          # API only

# Build
yarn build            # Build all packages
yarn lint             # Lint all packages
yarn format           # Format code
```

## Ports

- **Web**: http://localhost:3001
- **API**: http://localhost:3000
- **Solana devnet**: https://api.devnet.solana.com

## Troubleshooting

### Port already in use

```bash
lsof -ti:3000 | xargs kill -9  # Kill API
lsof -ti:3001 | xargs kill -9  # Kill web
```

### ZK Circuit issues

```bash
cd external/noirwire-contracts/zk-circuits
node scripts/verify_build.js
```

### Solana connection issues

```bash
# Check Solana CLI config
solana config get

# Test devnet connection
curl https://api.devnet.solana.com -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```
