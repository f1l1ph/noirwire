# NoirWire Protocol

> **Privacy-preserving payments on Solana**

🌐 **Live:** [noirwire.com](https://noirwire.com) (Testnet)

---

## ⚠️ Hackathon MVP - Unaudited

This is an experimental MVP. Not for production use. Testnet only.

---

## How It Works

NoirWire enables private transfers on Solana using zero-knowledge proofs:

1. **Shield** - Deposit SOL into a private pool
2. **Transfer** - Send privately (amounts & recipients hidden via Groth16 proofs on BN254)
3. **Unshield** - Withdraw to any public wallet

**Stack:** Circom circuits, SnarkJS, Solana program, Next.js frontend, Supabase for encrypted notes.

**Security note:** Experimental code, unaudited. Potential bugs in circuit implementation and indexer synchronization. Do not use with real funds.

---

## Quick Start

```bash
# Install
yarn install

# Run locally
yarn dev              # Both web + API
yarn dev:web          # Frontend: http://localhost:3001
yarn dev:api          # Backend: http://localhost:3000
```

### Environment

Create `.env.local` in `apps/api/`:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_role_key
SOLANA_RPC_URL=https://api.testnet.solana.com
NOIRWIRE_PROGRAM_ID=Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz
SOLANA_COMMITMENT=confirmed
SOLANA_ADMIN_KEYPAIR=[your,keypair,bytes]
```

---

## Documentation

Full technical details in `/docs`:

- **[docs/DOCS.md](./docs/DOCS.md)** - Protocol overview
- **[docs/TECHNICAL.md](./docs/TECHNICAL.md)** - Implementation details
- **[docs/API.md](./docs/API.md)** - REST API reference
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System architecture

---

## Contact

ph1l1ph@proton.me
