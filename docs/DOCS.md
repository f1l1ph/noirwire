# NoirWire Protocol

> **Privacy-preserving payments on Solana using zero-knowledge proofs**

---

## Overview

NoirWire enables private transactions on Solana using Groth16 zero-knowledge proofs.

Three operations:

1. **Shield** - Deposit SOL into private pool (amount hidden)
2. **Transfer** - Send privately (amounts & recipients hidden)
3. **Unshield** - Withdraw to public wallet

Each operation generates a zk-proof that's verified on-chain without revealing details.

---

## How Circuits Work

### Shield

- **Input:** Amount you're depositing
- **Output:** Commitment (on-chain), only you know the amount
- **Constraint:** Amount is valid (0 ≤ amount < 2^64)

### Transfer

- **Input:** Your secret key + original note (amount, blinding)
- **Output:** New commitment (recipient gets), nullifier (prevents double-spend), fee deducted
- **Constraints:** Note exists in tree, amount math checks out, no double-spending

### Unshield

- **Input:** Your secret key + original note + public wallet address
- **Output:** Withdrawal to wallet, amount visible, nullifier recorded
- **Key:** Amount MUST be public (recipient's balance will increase)

All use **Groth16** on **BN254 curve** for fast on-chain verification.

---

## Architecture

**Frontend** (noirwire.com)

- Generate proofs locally (SnarkJS + WASM)
- Manage encrypted notes
- UI for Shield/Transfer/Unshield

**Backend**

- Merkle tree indexer (tracks state)
- Blockchain sync (monitors on-chain)
- Supabase storage (encrypted backups)

**On-Chain** (Solana program)

- Verify Groth16 proofs
- Track nullifiers (prevent double-spend)
- Manage merkle roots

---

## Security Model

**Double-Spending:** Nullifier stored on-chain after first use, any duplicate rejected

**Merkle Replay:** Only recent roots accepted (last 64 blocks), old ones discarded

**Proof Forgery:** Groth16 cryptography makes fake proofs impossible

**Commitment Linking:** Random blinding factors hide which notes belong to same user

**Secret Key Leakage:** User responsibility - use hardware wallets, coming soon: better key derivation

---

## Performance & Costs

| Operation | Duration | Solana Fee | Protocol Fee     | Total      |
| --------- | -------- | ---------- | ---------------- | ---------- |
| Shield    | Backend  | ~0.005 SOL | —                | ~0.005 SOL |
| Transfer  | ~30 sec  | ~0.005 SOL | 0.0001-0.001 SOL | ~0.006 SOL |
| Unshield  | ~30 sec  | ~0.005 SOL | —                | ~0.005 SOL |

Capacity: ~1M notes max (2^20 merkle tree)

---

## Getting Started

**Users:** Visit https://noirwire.com, connect wallet, shield some SOL

**Developers:**

- Check source at `/external/noirwire-contracts/`
- Circuits: `zk-circuits/src/`
- Solana program: `programs/zk-pool/src/`
- Run tests: `anchor test`

**Report bugs:** ph1l1ph@proton.me

---

## Deployments

| Environment | URL                      | Network        | Status   |
| ----------- | ------------------------ | -------------- | -------- |
| **Live**    | https://noirwire.com     | Solana Testnet | 🟢 Live  |
| **API**     | https://api.noirwire.com | Solana Testnet | 🟢 Live  |
| **Local**   | http://localhost:3001    | Testnet RPC    | Dev only |

RPC: https://api.testnet.solana.com  
Program ID: Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz

---

⚠️ **Hackathon MVP - Not Audited**

Experimental code. No security audit completed. Do not use with real funds.

- Potential bugs in circuits, indexer, or key management
- For testing on Solana Testnet only
- No guarantees about security or correctness

**Report security issues:** ph1l1ph@proton.me
