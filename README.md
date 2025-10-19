# NoirWire

Zero-knowledge privacy protocol for Solana using Groth16 proofs with end-to-end encrypted messaging.

## Features

- **🔒 Private Payments**: Shield, transfer, and unshield tokens using zero-knowledge proofs
- **💬 Secure Messaging**: End-to-end encrypted wallet-to-wallet messaging with realtime updates
- **🎯 Dashboard**: Modern glass-effect UI with easy access to all features
- **🔐 Client-Side Encryption**: Messages encrypted locally using X25519 + XSalsa20-Poly1305
- **⚡ Realtime**: Instant message delivery using Supabase Realtime subscriptions
- **📱 Responsive**: Mobile-friendly interface with progressive enhancement

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

### Web App Setup

Copy the environment file and configure:

```bash
cd apps/web
cp .env.local.example .env.local
```

Edit `.env.local` with your settings:

```bash
# Solana Configuration
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz

# API URL
NEXT_PUBLIC_API_URL=http://localhost:3000

# Supabase Configuration (Required for messaging)
# Get these from: https://app.supabase.com/project/_/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**Important**:

- Use the **anon (public)** key, NOT the service_role key
- The `NEXT_PUBLIC_` prefix exposes these to the browser (which is safe for anon key)
- See [ENV-SETUP.md](./ENV-SETUP.md) for detailed security explanation

### API Setup

Copy the environment file and configure:

```bash
cd apps/api
cp .env.example .env
```

Edit `.env` with your settings:

```bash
PORT=3000
NODE_ENV=development

# Supabase Configuration (Server-side only)
# ⚠️ Use service_role key here, NOT anon key!
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here

# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
NOIRWIRE_PROGRAM_ID=Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz
SOLANA_COMMITMENT=confirmed

# Admin keypair for Merkle root publishing
SOLANA_ADMIN_KEYPAIR=[your,keypair,bytes,here]
```

**Important**:

- Use the **service_role (secret)** key, NOT the anon key
- Never commit this `.env` file to git
- See [ENV-SETUP.md](./ENV-SETUP.md) for the difference between anon and service_role keys

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

## Secure Messaging Architecture

### Overview

NoirWire implements end-to-end encrypted messaging between Solana wallets using a hybrid encryption approach:

1. **Key Generation**: Each wallet generates an X25519 keypair for encryption
2. **Key Storage**: Private keys stored locally in IndexedDB, public keys in Supabase
3. **Message Encryption**: Uses ECDH to derive shared secret, then encrypts with XSalsa20-Poly1305
4. **Storage**: Only ciphertext + nonce stored in Supabase (server cannot decrypt)
5. **Realtime**: Supabase Realtime subscriptions for instant message delivery

### Encryption Details

```
Client Side:
1. Generate X25519 keypair (or derive from wallet signature)
2. Store private key in IndexedDB
3. Upload public key to Supabase users table

Sending Message:
1. Fetch recipient's public key from Supabase
2. Perform ECDH: shared_secret = ECDH(my_private_key, their_public_key)
3. Encrypt message: ciphertext = XSalsa20-Poly1305(plaintext, shared_secret, nonce)
4. Store {ciphertext, nonce, version} in Supabase

Receiving Message:
1. Fetch encrypted message from Supabase
2. Fetch sender's public key
3. Perform ECDH: shared_secret = ECDH(my_private_key, their_public_key)
4. Decrypt: plaintext = XSalsa20-Poly1305_decrypt(ciphertext, shared_secret, nonce)
```

### Database Schema

The messaging system uses three main tables:

**users**

- Stores wallet addresses and public encryption keys
- Each user must register before sending/receiving messages

**conversations**

- Tracks message threads between two participants
- Maintains unread counts and last message metadata

**messages**

- Stores encrypted message payloads
- Only ciphertext + nonce stored (zero-knowledge storage)

See `supabase-schema.sql` for full schema with RLS policies.

### Supabase Free Tier Considerations

NoirWire is designed to work within Supabase Free Plan limits:

- **Database Size**: 500 MB limit
  - Messages are text-only (no attachments in MVP)
  - Automatic cleanup function available (`archive_old_messages()`)
  - Pagination limits history loads

- **Bandwidth**: 5 GB egress/month
  - Realtime subscriptions instead of polling
  - Limited message fetch (50 per load)
  - Efficient query patterns

- **Monitoring Storage Usage**:

  ```sql
  SELECT * FROM get_messaging_storage_size();
  ```

- **Cleanup Old Messages** (run as needed):
  ```sql
  SELECT archive_old_messages(90); -- Delete messages older than 90 days
  ```

### Security Model

- **Zero-Knowledge Storage**: Server never sees plaintext messages
- **Forward Secrecy**: Not yet implemented (roadmap item)
- **Key Recovery**: Keys can be derived from wallet signature
- **No Metadata Leakage**: Timestamps and participants visible (not encrypted)
- **Client-Side Only**: All encryption/decryption happens in browser

## Dashboard Features

The dashboard provides a unified interface for all NoirWire features:

### Available Now

- **Secure Messages**: E2E encrypted messaging with realtime updates
- **Shield Funds**: Deposit tokens into privacy pool
- **Unshield Funds**: Withdraw tokens from privacy pool
- **Private Transfer**: Transfer within shielded pool
- **Send Tokens**: Standard Solana token transfers (placeholder)
- **Receive Tokens**: Display wallet address and QR code (placeholder)

### Coming Soon

- **DeFi**: Private DeFi integrations (swaps, lending, staking)
- **Email Client**: Full email functionality built on messaging infrastructure

All features use the same glass-effect UI design for consistency.

## Development Guide

### Adding a New Feature

1. Create route in `apps/web/app/[feature]/page.tsx`
2. Add feature card to `apps/web/app/dashboard/page.tsx`
3. Use glass-effect styling from existing pages
4. Link from dashboard grid

### Testing Messaging

1. Set up Supabase project and run `supabase-schema.sql`
2. Configure environment variables
3. Connect two wallets (e.g., Phantom + Backpack)
4. Start conversation from one wallet to the other
5. Messages appear in realtime on both sides

### Encryption Testing

```typescript
import {
  generateKeyPair,
  encryptMessage,
  decryptMessage,
} from './lib/encryptionManager';

// Test encryption roundtrip
const alice = generateKeyPair();
const bob = generateKeyPair();

const encrypted = await encryptMessage(
  'Hello Bob!',
  'alice-wallet',
  encodeBase64(bob.publicKey),
);

const decrypted = await decryptMessage(
  encrypted,
  'bob-wallet',
  encodeBase64(alice.publicKey),
);

console.assert(decrypted === 'Hello Bob!');
```

## Troubleshooting

### Port already in use

```bash
lsof -ti:3000 | xargs kill -9  # Kill API
lsof -ti:3001 | xargs kill -9  # Kill web
```

### Messaging not working

1. Check Supabase environment variables are set
2. Verify Supabase tables exist (`supabase-schema.sql`)
3. Check browser console for encryption errors
4. Ensure wallets are connected on devnet
5. Try clearing IndexedDB and reconnecting wallet

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

### Supabase Connection Issues

```bash
# Test Supabase connection
curl https://your-project.supabase.co/rest/v1/users \
  -H "apikey: your-anon-key" \
  -H "Authorization: Bearer your-anon-key"
```

## Roadmap

- [ ] Forward secrecy for messages
- [ ] Group chat support
- [ ] File attachments via IPFS
- [ ] Email integration
- [ ] DeFi privacy features
- [ ] Mobile app (React Native)
- [ ] Desktop app (Electron)
- [ ] Message reactions and threading
- [ ] Voice/video calls (WebRTC + encryption)
- [ ] DAO governance integration

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (especially encryption!)
5. Submit a pull request

## License

See LICENSE file for details.

## Acknowledgments

- Groth16 implementation from snarkjs
- Solana blockchain and Anchor framework
- Supabase for realtime database
- TweetNaCl for encryption primitives
