# NoirWire Architecture Documentation

> **A comprehensive guide to how NoirWire works: Zero-Knowledge Proofs, Solana Programs, Indexing, and Full System Flow**

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Zero-Knowledge Circuits](#zero-knowledge-circuits)
3. [Solana Smart Contracts](#solana-smart-contracts)
4. [Backend API & Indexer](#backend-api--indexer)
5. [Frontend Application](#frontend-application)
6. [Full Transaction Flows](#full-transaction-flows)
7. [Security Model](#security-model)
8. [Data Structures](#data-structures)

---

## System Overview

NoirWire is a **privacy-preserving payment protocol** built on Solana. It allows users to:

- 🛡️ **Shield**: Move SOL from public wallet into a private pool
- 🔄 **Transfer**: Send SOL privately within the pool to other users
- 💸 **Unshield**: Withdraw SOL from the private pool back to any public wallet

### High-Level Architecture

```
┌─────────────────────────────────────┐
│      Web Frontend (Next.js)          │
│  ├─ Transfer/Shield/Unshield Pages   │
│  ├─ Dashboard with balance tracking  │
│  └─ QR Code generation               │
└──────────────┬──────────────────────┘
               │ HTTP REST API
               ▼
┌─────────────────────────────────────┐
│      Backend API (NestJS)            │
│  ├─ Proof generation service         │
│  ├─ Merkle tree indexer              │
│  ├─ Blockchain sync listener         │
│  └─ Notes storage (Supabase)         │
└──────────────┬──────────────────────┘
               │ RPC Calls
               ▼
┌─────────────────────────────────────┐
│      Solana Blockchain               │
│  ├─ zk-pool program (verification)   │
│  ├─ Merkle roots on-chain            │
│  ├─ Nullifier set                    │
│  └─ Treasury account                 │
└─────────────────────────────────────┘
```

### Key Components

| Component               | Purpose                                    | Technology                                       |
| ----------------------- | ------------------------------------------ | ------------------------------------------------ |
| **Web Frontend**        | User interface for transactions            | Next.js 15, React 19, TypeScript, Solana Web3.js |
| **ZK Circuits**         | Generate cryptographic proofs              | Circom, SnarkJS, BN254 curve                     |
| **Solana Program**      | Verify proofs & manage state on-chain      | Rust, Anchor framework                           |
| **Indexer**             | Track commitments & generate Merkle proofs | NestJS, In-memory Merkle trees                   |
| **Blockchain Listener** | Sync on-chain state with local indexer     | Solana event listener                            |
| **Notes Storage**       | Persist encrypted user notes               | Supabase PostgreSQL                              |

---

## Zero-Knowledge Circuits

ZK circuits prove facts about transactions **without revealing sensitive information**. All circuits use:

- **Proof system**: Groth16 (fast verification)
- **Curve**: BN254 (battle-tested, supports Solana)
- **Hash function**: Poseidon (efficient in-circuit hashing)

### Circuit 1: Shield (Deposit)

**Purpose**: Prove you created a valid commitment without revealing the underlying data

**Public Outputs** (visible on-chain):

```
commitment = Poseidon(recipient_pk, amount, blinding)
```

**Private Inputs** (kept secret by user):

```
recipient_pk    - Public key of note recipient
amount          - Amount being deposited (in lamports)
blinding        - Random blinding factor for privacy
```

**Constraints Enforced**:

- `0 ≤ amount < 2^64` (prevents overflow attacks)

**Use Case**: Shielding 0.5 SOL

1. User provides: recipient_pk, 0.5 SOL (500_000_000 lamports), random blinding
2. Circuit computes: commitment hash
3. Proof proves: "I know (pk, amount, blinding) that hash to this commitment"
4. User can later spend this commitment in a transfer/unshield transaction

**Why it's needed**: The commitment itself doesn't leak any information. Even if the commitment is on-chain, nobody can reverse-engineer who owns it or how much it contains.

---

### Circuit 2: Transfer (Private Transfer)

**Purpose**: Prove you legitimately own a note AND you're transferring its value correctly

**Public Outputs** (visible on-chain):

```
root              - Current Merkle root (proves the old note exists in the pool)
nullifier         - Unique hash preventing this note from being spent again
new_commitment    - Commitment for the recipient's output note
fee               - Transaction fee (proves you're paying the right amount)
```

**Private Inputs** (kept secret):

```
// Old note (being spent)
secret_sk               - Secret key proving you own the note
old_recipient_pk        - Your public key (from original shield)
old_amount              - Amount in the note
old_blinding            - Original blinding factor
note_id                 - Unique identifier of this note

// Merkle proof proving the old note exists
merkle_path[20]         - Path to root in Merkle tree
merkle_path_positions[20] - Which side (left/right) at each level

// New note (recipient gets this)
new_recipient_pk        - Recipient's public key
new_amount              - Amount to send (old_amount - fee)
new_blinding            - New random blinding factor

// Fee
fee                     - Amount going to protocol (typically 0 for now)
```

**Constraints Enforced**:

```
1. Old commitment exists in tree:
   old_commitment = Poseidon(old_recipient_pk, old_amount, old_blinding)
   Merkle proof verifies: hash(old_commitment, merkle_path) == root

2. Nullifier prevents double-spending:
   nullifier = Poseidon(secret_sk, note_id)
   (This is stored on-chain; duplicate nullifiers are rejected)

3. Value conservation:
   old_amount = new_amount + fee
   (No money is created or destroyed)

4. Secret key proves ownership:
   Only someone who knows secret_sk can compute this nullifier
   (Proves you owned the original note)

5. Range checks:
   0 ≤ old_amount < 2^64
   0 ≤ new_amount < 2^64
   0 ≤ fee < 2^64
```

**Circuit Flow Diagram**:

```
┌─────────────────────────────────┐
│   Private Inputs (Secret)        │
│  ├─ secret_sk                    │
│  ├─ old_recipient_pk             │
│  ├─ old_amount                   │
│  ├─ old_blinding                 │
│  ├─ merkle_path[20]              │
│  ├─ new_recipient_pk             │
│  ├─ new_amount                   │
│  ├─ new_blinding                 │
│  └─ fee                          │
└────────────────┬────────────────┘
                 │
                 ▼
        ┌─────────────────────┐
        │ Poseidon Hashing    │
        ├─────────────────────┤
        │ Hash old note:      │
        │ commitment_old =    │
        │  Poseidon(pk, amt,  │
        │    blind)           │
        │                     │
        │ Hash nullifier:     │
        │ nullifier =         │
        │  Poseidon(sk, id)   │
        │                     │
        │ Hash new note:      │
        │ commitment_new =    │
        │  Poseidon(pk_new,   │
        │    amt_new, blind)  │
        └────────────────────┬┘
                 │
                 ▼
        ┌─────────────────────┐
        │ Merkle Verification │
        │ (Merkle Inclusion)  │
        ├─────────────────────┤
        │ hash(commitment_old,│
        │  merkle_path[20])   │
        │  ==                 │
        │ root                │
        └────────────────────┬┘
                 │
                 ▼
        ┌─────────────────────┐
        │ Constraint Checks   │
        ├─────────────────────┤
        │ ✓ Value conserved   │
        │ ✓ Amounts in range  │
        │ ✓ Fee valid         │
        │ ✓ Commitment valid  │
        └────────────────────┬┘
                 │
                 ▼
┌──────────────────────────────────┐
│   Public Outputs (On-Chain)       │
│  ├─ root                          │
│  ├─ nullifier                     │
│  ├─ new_commitment                │
│  └─ fee                           │
└──────────────────────────────────┘
```

**Use Case**: Transferring 0.25 SOL privately

1. Your note has 0.5 SOL (from shield)
2. You want to send 0.25 SOL to recipient
3. Circuit proves:
   - You own the 0.5 SOL note (via secret_sk)
   - The note exists in the pool (via Merkle proof)
   - You're creating a new 0.25 SOL commitment for recipient
   - The math works out: 0.5 = 0.25 (to recipient) + 0.25 (change to you) + 0 (fee)
4. Proof is sent to Solana
5. On-chain program verifies the proof
6. New commitment is added to the pool
7. Nullifier is stored (so you can't spend this note again)

---

### Circuit 3: Unshield (Withdrawal)

**Purpose**: Prove you own a note AND prove which public wallet should receive the funds

**Public Outputs**:

```
root             - Merkle root (proves the note exists)
nullifier        - Prevents double-spending
recipient_lo     - Lower 128 bits of recipient Solana address
recipient_hi     - Upper 128 bits of recipient Solana address
public_amount    - Amount being withdrawn (to recipient)
fee              - Transaction fee
```

**Private Inputs**:

```
// Same as transfer
secret_sk               - Your secret key
old_recipient_pk        - Your ZK address
old_amount              - Total amount in note
old_blinding            - Original blinding
note_id                 - Note identifier
merkle_path[20]         - Merkle proof
merkle_path_positions[20]

// Public recipient (split into two fields for encoding)
recipient_lo            - Recipient's address (lower 128 bits)
recipient_hi            - Recipient's address (upper 128 bits)
public_amount           - Amount to send out
fee                     - Fee amount
```

**Key Difference from Transfer**:

- Transfer creates a new private note for recipient
- Unshield sends SOL to a **public wallet address**
- The recipient address is encoded in two fields because Solana addresses are 32 bytes (256 bits) and BN254 field elements are ~254 bits

**Constraints**:

```
1. Old note exists in tree (same Merkle proof as transfer)
2. Nullifier prevents double-spending
3. Value conservation: old_amount = public_amount + fee
4. Address encoding: recipient = (recipient_hi << 128) | recipient_lo
5. Range checks on all amounts
```

**Use Case**: Withdrawing 0.3 SOL

1. Your note has 0.5 SOL
2. You want to withdraw 0.3 SOL to a public wallet
3. Circuit proves you can spend the note and you're sending it to the right address
4. Program transfers 0.3 SOL from treasury to recipient wallet
5. Remaining 0.2 SOL is stored as change (or can be transferred to someone else)

---

### Circuit Architecture

```
Circom Circuits
│
├─ shield.circom
│  └─ Constraints:
│     ├─ Commitment = Poseidon(pk, amount, blinding)
│     └─ AmountRangeCheck(amount < 2^64)
│
├─ transfer.circom
│  └─ Constraints:
│     ├─ Old commitment valid
│     ├─ Merkle inclusion proof
│     ├─ Nullifier = Poseidon(sk, note_id)
│     ├─ New commitment valid
│     ├─ Value conservation: old = new + fee
│     └─ Range checks on all amounts
│
└─ unshield.circom
   └─ Constraints:
      ├─ Old commitment valid
      ├─ Merkle inclusion proof
      ├─ Nullifier = Poseidon(sk, note_id)
      ├─ Address encoding valid
      ├─ Value conservation: old = public + fee
      └─ Range checks on all amounts

All circuits use:
├─ Poseidon hash function
├─ Merkle tree components (20 levels)
├─ Range check templates
└─ Field comparison templates
```

---

## Solana Smart Contracts

The Solana program (`zk-pool`) is the **heart of the system**. It:

1. **Verifies ZK proofs** submitted by users
2. **Manages state**: Merkle roots, nullifiers, commitments
3. **Prevents double-spending**: By tracking spent notes (nullifiers)
4. **Handles treasury**: Stores and manages SOL
5. **Enforces security**: Pause mechanisms, admin controls

### Program Structure

```
zk-pool Program (ID: Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz)

├── State Accounts
│  ├─ PoolConfig
│  │  ├─ admin (Pubkey)
│  │  ├─ paused (bool)
│  │  ├─ merkle_depth (u8) = 20
│  │  ├─ root_window (u16) = 64 (recent roots stored)
│  │  ├─ abi_hash ([u8; 32])
│  │  └─ initialized (bool)
│  │
│  ├─ RootsAccount
│  │ ├─ ring_buffer[64] of Merkle roots
│  │ └─ Used to prevent old-root replay attacks
│  │
│  ├─ NullifiersAccount
│  │ ├─ Set of spent nullifiers
│  │ ├─ Max capacity: 100,000 entries
│  │ └─ Used to prevent double-spending
│  │
│  └─ VerificationKeyAccounts (3 total)
│     ├─ VK for shield circuit
│     ├─ VK for transfer circuit
│     └─ VK for unshield circuit
│
├── Instructions (Public Methods)
│  ├─ initialize
│  │  └─ Setup pool with merkle_depth, root_window
│  │
│  ├─ set_verification_key (admin only)
│  │  └─ Upload VK for a circuit (shield/transfer/unshield)
│  │
│  ├─ add_root (admin only)
│  │  └─ Add new Merkle root from indexer
│  │
│  ├─ set_paused (admin only)
│  │  └─ Pause/unpause all submit_* operations
│  │
│  ├─ submit_shield
│  │  ├─ Input: proof + commitment
│  │  ├─ Verify proof
│  │  └─ Action: Add commitment to local tree
│  │
│  ├─ submit_transfer
│  │  ├─ Input: proof + [root, nullifier, new_commitment, fee]
│  │  ├─ Verify proof
│  │  ├─ Check root is recent
│  │  ├─ Check nullifier not spent
│  │  └─ Action: Record nullifier, add new_commitment
│  │
│  └─ submit_unshield
│     ├─ Input: proof + [root, nullifier, recipient_lo, recipient_hi, amount, fee]
│     ├─ Verify proof
│     ├─ Check root is recent
│     ├─ Check nullifier not spent
│     └─ Action: Transfer SOL from treasury to recipient
│
└── Helper Functions
   ├─ Groth16 Verification
   │  └─ Verify(vk, proof, public_inputs)
   │
   ├─ Merkle Tree Management
   │  ├─ Add commitment to tree
   │  ├─ Get current root
   │  └─ Validate old roots (within window)
   │
   └─ Nullifier Management
      ├─ Record spent nullifier
      └─ Check if nullifier already spent
```

### Key Accounts

#### PoolConfig Account

```rust
pub struct PoolConfig {
    pub admin: Pubkey,              // Only admin can set VKs and roots
    pub paused: bool,                // Can pause all operations
    pub merkle_depth: u8,           // 20 (supports ~1M notes)
    pub root_window: u16,           // 64 (accept roots from last 64 blocks)
    pub abi_hash: [u8; 32],        // SHA256 of ABI specification
    pub initialized: bool,          // Prevents reinitialization
}
```

#### RootsAccount (Ring Buffer)

```rust
pub struct RootsAccount {
    pub roots: [Option<[u8; 32]>; 64],  // Last 64 roots
    pub root_index: usize,              // Current position in ring
    pub root_count: usize,              // Total roots added (useful for debugging)
}

// Why ring buffer?
// 1. Prevents old-root replay attacks
//    (only accept proofs using recent roots)
// 2. Bounded storage (always 64 roots, max ~2KB)
// 3. Efficient: O(1) add, O(1) lookup
```

#### NullifiersAccount (Set of Spent Notes)

```rust
pub struct NullifiersAccount {
    pub nullifiers: Vec<[u8; 32]>,     // All spent nullifiers
}

// Why store this?
// 1. Each nullifier uniquely identifies a note
// 2. If you try to spend the same note twice, nullifier will be duplicate
// 3. On-chain checks prevent duplicate nullifiers
// 4. Prevents double-spending attacks
```

### Security Features

#### 1. **Root Replay Protection**

```
Problem: Attacker could use an old root from long ago
Solution: Only accept proofs using roots from last 64 blocks
```

#### 2. **Double-Spend Prevention**

```
Problem: Attacker could spend same note twice
Solution:
  - Each note has a unique nullifier
  - Nullifier stored on-chain after first spend
  - Second spend attempt gets rejected (duplicate nullifier)
```

#### 3. **VK Hash Validation**

```
Problem: Someone could swap out the verification key
Solution:
  - Store SHA256(verification_key) on-chain
  - Verify hash before using VK
  - Makes VK tampering detectable
```

#### 4. **ABI Hash Checking**

```
Problem: Circuit encoding could change, breaking compatibility
Solution:
  - Hash the ABI specification
  - Store on-chain
  - Enforces that all proofs use the same encoding
```

#### 5. **Pause Mechanism**

```
Problem: Emergency security issue discovered
Solution:
  - Admin can pause all submit_* operations
  - No new transactions processed
  - Existing notes remain safe
  - Gives time for hotfix
```

### Program Instructions in Detail

#### Initialize

```rust
pub fn initialize(
    ctx: Context<Initialize>,
    merkle_depth: u8,           // 20
    root_window: u16,           // 64
    abi_hash: [u8; 32],        // SHA256 of ABI spec
) -> Result<()> {
    // Only called once during deployment
    // Sets up the PoolConfig account
    // Initializes empty roots and nullifiers accounts
}
```

#### Submit Shield

```rust
pub fn submit_shield(
    ctx: Context<SubmitShield>,
    proof: Vec<u8>,                         // 256 bytes
    public_inputs: Vec<[u8; 32]>,          // [commitment]
    amount: u64,                            // In lamports
) -> Result<()> {
    // 1. Verify the Groth16 proof
    //    - Checks that the commitment was computed correctly
    //    - Checks that amount is in valid range

    // 2. Transfer SOL from user to treasury
    //    - User sends SOL to treasury account
    //    - Program keeps it safe

    // 3. Store commitment locally
    //    - Program maintains a local tree of commitments
    //    - (Not on-chain, to save storage)
    //    - Later used for Merkle proofs
}
```

#### Submit Transfer

```rust
pub fn submit_transfer(
    ctx: Context<SubmitTransfer>,
    proof: Vec<u8>,                         // 256 bytes
    public_inputs: Vec<[u8; 32]>,          // [root, nullifier, new_commitment, fee]
) -> Result<()> {
    // 1. Verify the Groth16 proof
    //    - Proves you own the old note (via secret_sk)
    //    - Proves old note exists in tree (via Merkle proof)
    //    - Proves value conservation: old = new + fee

    // 2. Check root is recent (within window)
    //    - Prevent replay attacks using old roots

    // 3. Check nullifier not already spent
    //    - Prevent double-spending same note

    // 4. Record nullifier as spent
    //    - Add to set of spent nullifiers

    // 5. Store new commitment
    //    - Add to local tree for next proofs
}
```

#### Submit Unshield

```rust
pub fn submit_unshield(
    ctx: Context<SubmitUnshield>,
    proof: Vec<u8>,                         // 256 bytes
    public_inputs: Vec<[u8; 32]>,          // [root, nullifier, recipient_lo/hi, amount, fee]
) -> Result<()> {
    // 1-4. Same as submit_transfer (verify proof, check root/nullifier)

    // 5. Reconstruct recipient address
    //    - Combine recipient_lo and recipient_hi
    //    - Validate it's a proper Solana address

    // 6. Transfer SOL from treasury to recipient
    //    - Uses CPI (Cross-Program Invocation)
    //    - PDA signs the transaction (treasury can spend)
    //    - Sends public_amount SOL to recipient wallet
}
```

---

## Backend API & Indexer

The backend serves three critical roles:

### 1. Proof Generation Service

Generates ZK proofs for shield/transfer/unshield operations.

```
Frontend
   │ HTTP POST /proof/generate
   │ { circuit: "transfer", input: {...} }
   ▼
Proof Service
   ├─ Load circuit artifacts (from zk-circuits/build/)
   ├─ Load proving key (from zk-circuits/pot/)
   ├─ Call SnarkJS to generate proof
   └─ Return proof as base64
   │
   ▲ { proof: "AAB9C2...", publicSignals: [...] }
   │ HTTP 200
   │
Frontend
```

**Why backend handles this?**

- Proof generation is computationally expensive (~30-60 seconds)
- Requires large proving keys (hundreds of MB)
- Better to do server-side than client-side
- Can batch proofs for multiple users

**Circuit artifacts needed** (in `zk-circuits/build/`):

```
shield/
  ├─ shield.wasm           (circuit bytecode)
  ├─ shield_final.zkey     (proving key ~300MB)
  └─ shield.vkey.json      (verification key)

transfer/
  ├─ transfer.wasm
  ├─ transfer_final.zkey
  └─ transfer.vkey.json

unshield/
  ├─ unshield.wasm
  ├─ unshield_final.zkey
  └─ unshield.vkey.json
```

### 2. Merkle Tree Indexer

The indexer maintains an **in-memory copy** of the commitment trees and generates Merkle proofs.

```
IndexerService

├─ Trees (in-memory)
│  ├─ Shield tree (all deposits)
│  ├─ Transfer tree (new notes from transfers)
│  └─ Unshield tree (not really used, but tracked)
│
├─ Capabilities
│  ├─ addCommitment(circuit, commitment)
│  │  └─ Add to tree, compute new root
│  │
│  ├─ getProof(circuit, commitment)
│  │  ├─ Find leaf index
│  │  ├─ Compute path to root
│  │  └─ Return [root, path, positions]
│  │
│  ├─ getRoot(circuit)
│  │  └─ Return current root
│  │
│  └─ getCommitments(circuit)
│     └─ Return all commitments (for debugging)
│
└─ Data Structure: Merkle Tree
   ├─ Leaves: Commitment hashes
   ├─ Depth: 20
   ├─ Max nodes: 1,048,576 (2^20)
   └─ Hash: Poseidon(left, right)
```

**Why in-memory?**

- Fast proof generation (~100ms vs ~10s on blockchain)
- Doesn't require on-chain storage (would be expensive)
- Supabase provides persistence (recovery on restart)

### 3. Blockchain Sync Listener

A background service that **listens to Solana blockchain** and syncs the indexer.

```
BlockchainSyncService

├─ WebSocket Connection
│  └─ Connects to Solana RPC (e.g., https://api.devnet.solana.com)
│
├─ Event Listeners
│  ├─ "shield" transactions
│  │  ├─ Detect when submit_shield is called
│  │  ├─ Extract commitment from logs
│  │  └─ Add to shield tree
│  │
│  ├─ "transfer" transactions
│  │  ├─ Detect when submit_transfer is called
│  │  ├─ Extract new_commitment from logs
│  │  └─ Add to transfer tree
│  │
│  └─ "add_root" transactions
│     ├─ Detect when add_root is called (by admin)
│     ├─ Extract new root from logs
│     └─ Track for root replay protection
│
└─ Synchronization
   ├─ On startup: Load all historical commitments
   ├─ On event: Add new commitments
   └─ On error: Log and retry
```

**Root Publishing Flow**:

```
1. User submits transfer proof to Solana
2. Program records new_commitment locally
3. Blockchain sync detects the transaction
4. Indexer adds new_commitment to tree
5. New root is computed from updated tree
6. Admin (or relayer) calls program.addRoot(newRoot)
7. Blockchain sync detects add_root
8. Root is stored in on-chain ring buffer (for root replay protection)
9. Frontend can now use this root in next transfer proof
```

### API Endpoints

```
POST /proof/generate
├─ Input: { circuit, input }
├─ Output: { proof, publicSignals }
└─ Purpose: Generate ZK proof

GET /indexer/status
├─ Output: { initialized, trees }
└─ Purpose: Check indexer health

GET /indexer/sync-status
├─ Output: { isListening, rootsPublished, ... }
└─ Purpose: Check blockchain sync status

GET /indexer/:circuit/root
├─ Output: { root }
└─ Purpose: Get current Merkle root for circuit

POST /indexer/:circuit/proof
├─ Input: { commitment }
├─ Output: { root, path, pathPositions }
└─ Purpose: Get Merkle proof for spending a note

POST /indexer/:circuit/commit
├─ Input: { commitment }
├─ Output: { success, root, index }
└─ Purpose: Manually add commitment (for debugging)

GET /notes/:walletAddress
├─ Output: Encrypted notes for this wallet
└─ Purpose: Load user's notes from Supabase

POST /notes/upload
├─ Input: { walletAddress, encryptedData }
└─ Purpose: Save encrypted notes to Supabase
```

---

## Frontend Application

The frontend is a **Next.js application** that provides the user interface for all privacy operations.

### Architecture

```
Next.js Frontend (React 19 + TypeScript)

├─ Pages
│  ├─ /shield
│  │  ├─ User enters amount
│  │  ├─ Frontend calls /proof/generate for shield proof
│  │  ├─ Sends proof to Solana program
│  │  └─ Receives commitment
│  │
│  ├─ /transfer
│  │  ├─ User selects note to spend
│  │  ├─ User enters recipient ZK address
│  │  ├─ Fee is auto-deducted from amount
│  │  ├─ Frontend generates transfer proof
│  │  ├─ Creates change note automatically
│  │  └─ Sends proof to Solana
│  │
│  ├─ /unshield
│  │  ├─ User selects note to spend
│  │  ├─ User enters recipient (public) address
│  │  ├─ Frontend generates unshield proof
│  │  └─ Funds are withdrawn to public address
│  │
│  ├─ /dashboard
│  │  ├─ Shows private balance
│  │  ├─ Lists all unspent notes
│  │  ├─ Shows transaction history
│  │  └─ Displays Aave-inspired layout
│  │
│  └─ /receive
│     ├─ Shows user's ZK address
│     ├─ Displays QR code
│     └─ Allows copying address for receiving transfers
│
├─ Context (State Management)
│  └─ WalletDataContext
│     ├─ Stores user's notes in memory
│     ├─ Tracks spent vs unspent notes
│     ├─ Calculates total balance
│     └─ Syncs with Supabase periodically
│
├─ Libraries
│  ├─ crypto.ts
│  │  ├─ Poseidon hashing
│  │  ├─ Commitment computation
│  │  └─ Blinding factor generation
│  │
│  ├─ privacyUtils.ts
│  │  ├─ Secret key derivation
│  │  ├─ Nullifier computation
│  │  ├─ Merkle proof fetching
│  │  └─ Note ID generation
│  │
│  ├─ proofService.ts
│  │  ├─ Calls /proof/generate endpoint
│  │  ├─ Decodes proof from base64
│  │  └─ Handles proof generation errors
│  │
│  ├─ indexerClient.ts
│  │  ├─ Fetches Merkle proofs from /indexer/proof
│  │  ├─ Gets current roots from /indexer/root
│  │  ├─ Auto-retries on network errors
│  │  └─ Smart API URL detection (production/local)
│  │
│  ├─ notesApi.ts
│  │  ├─ Uploads encrypted notes to Supabase
│  │  ├─ Downloads user's notes
│  │  └─ Handles note storage
│  │
│  └─ errorHandler.ts
│     ├─ User-friendly error messages
│     ├─ Logs detailed errors for debugging
│     └─ Provides recovery suggestions
│
└─ Styling
   ├─ globals.css (design system with CSS variables)
   ├─ CSS modules per page
   └─ Apple-inspired glassmorphism design
```

### Key Flows

#### Shield Flow (Deposit into Privacy Pool)

```
1. User enters amount: 0.5 SOL
   └─ Frontend: Compute commitment
      recipient_pk = userPublicKey
      amount = 0.5 SOL (500_000_000 lamports)
      blinding = random
      commitment = Poseidon(pk, amount, blinding)

2. Frontend calls POST /proof/generate
   └─ Backend: Generate shield proof
      Input: { circuit: "shield", input: { recipient_pk, amount, blinding } }
      Output: { proof, publicSignals: [commitment] }

3. Frontend saves note locally
   └─ Note = { commitment, blinding, amount, spent: false }

4. Frontend calls program.submitShield()
   └─ Solana: Verify proof
      - commitment == Poseidon(pk, amount, blinding)
      - amount in valid range
   └─ Solana: Transfer 0.5 SOL from user to treasury
   └─ Solana: Store commitment in local tree

5. User sees: "0.5 SOL shielded successfully"
   └─ This commitment can now be transferred or unshielded
```

#### Transfer Flow (Private Transfer)

```
1. User selects a note to spend (e.g., 0.5 SOL)
   └─ User enters recipient ZK address
   └─ User enters amount: 0.25 SOL
   └─ Fee is auto-deducted: 0.0001 SOL
   └─ Actual transfer: 0.25 - 0.0001 = 0.2499 SOL to recipient
   └─ Change: 0.5 - 0.25 = 0.25 SOL back to user

2. Frontend fetches Merkle proof
   └─ Calls POST /indexer/shield/proof { commitment: old_commitment }
   └─ Returns: { root, path[20], pathPositions[20] }

3. Frontend generates transfer proof
   └─ Calls POST /proof/generate
   └─ Input includes:
      - secret_sk (derived from wallet address)
      - old_recipient_pk, old_amount, old_blinding
      - merkle_path[20], merkle_path_positions[20]
      - new_recipient_pk, new_amount (0.2499 SOL)
      - new_blinding (random)
      - fee (0.0001 SOL)
   └─ Output: proof + [root, nullifier, new_commitment, fee]

4. Frontend creates change note
   └─ change_commitment = Poseidon(my_pk, 0.25 SOL, random_blinding)

5. Frontend calls program.submitTransfer()
   └─ Solana: Verify proof
   └─ Solana: Check root is recent (within 64-block window)
   └─ Solana: Check nullifier not already spent
   └─ Solana: Record nullifier as spent (prevents double-spend)

6. Backend sync listener detects transfer
   └─ Adds new_commitment to transfer tree
   └─ Computes new root

7. Frontend saves notes
   └─ Mark old note as spent
   └─ Add new commitment (recipient got 0.2499 SOL)
   └─ Add change note (you got 0.25 SOL back)

8. User sees: "Transfer successful!"
   └─ Recipient's balance increased by 0.2499 SOL
   └─ Your balance updated: 0.5 → 0.25 SOL
```

#### Unshield Flow (Withdrawal to Public Wallet)

```
1. User selects a note to unshield (e.g., 0.25 SOL)
   └─ User enters recipient (public Solana address)
   └─ User enters amount: 0.2 SOL
   └─ Fee: 0.0 SOL (current limitation)

2. Frontend fetches Merkle proof
   └─ Calls POST /indexer/shield/proof { commitment: old_commitment }

3. Frontend generates unshield proof
   └─ Calls POST /proof/generate
   └─ Input includes:
      - secret_sk (proves ownership)
      - old_recipient_pk, old_amount, old_blinding
      - merkle_path[20], merkle_path_positions[20]
      - recipient_lo, recipient_hi (split recipient address)
      - public_amount (0.2 SOL)
      - fee (0.0 SOL)
   └─ Output: proof + [root, nullifier, recipient_lo, recipient_hi, public_amount, fee]

4. Frontend calls program.submitUnshield()
   └─ Solana: Verify proof (similar to transfer)
   └─ Solana: Reconstruct recipient address from (recipient_lo, recipient_hi)
   └─ Solana: Transfer 0.2 SOL from treasury to recipient wallet
   └─ Solana: Record nullifier (prevent double-spend)

5. User sees: "0.2 SOL withdrawn to [recipient address]"
   └─ Recipient wallet now has 0.2 SOL (public)
   └─ Your private balance reduced by 0.2 SOL
   └─ Remaining in pool: 0.05 SOL (change)
```

---

## Full Transaction Flows

### Complete Shield + Transfer + Unshield Cycle

```
Day 1: Shield
├─ User: "I want to shield 1 SOL"
├─ Frontend: Generate shield proof
├─ Solana: Verify, transfer 1 SOL to treasury
├─ User: Now has 1 SOL private balance
└─ Note: { commitment: "0xabc123", amount: 1 SOL, spent: false }

Day 2: Transfer to Alice
├─ User: "Send 0.6 SOL to Alice"
├─ Frontend:
│  ├─ Fetch Merkle proof for commitment: "0xabc123"
│  ├─ Generate transfer proof
│  │  ├─ Input note: 1 SOL
│  │  ├─ Send to Alice: 0.6 SOL
│  │  ├─ Fee: 0.0001 SOL
│  │  └─ Change: 0.3999 SOL (back to user)
│  ├─ Submit proof to Solana
│  └─ Create change note for self
│
├─ Solana:
│  ├─ Verify proof
│  ├─ Record nullifier (prevent double-spend)
│  ├─ Store new commitments in tree
│
├─ Results:
│  ├─ Nullifier of user's 1 SOL note: recorded (can't spend again)
│  ├─ Alice's new note: 0.6 SOL (private)
│  ├─ User's change note: 0.3999 SOL (private)
│  └─ Protocol fee: 0.0001 SOL (treasury)
│
└─ User balance: 1 SOL → 0.3999 SOL

Day 3: Alice transfers to Bob
├─ Alice: "Send 0.3 SOL to Bob, keep 0.3 SOL"
├─ Same process as Day 2
├─ Results:
│  ├─ Bob gets 0.3 SOL (new note)
│  ├─ Alice gets change: 0.2999 SOL
│  └─ Fee: 0.0001 SOL
└─ Alice's balance: 0.6 → 0.2999 SOL

Day 4: User unshields to public wallet
├─ User: "Withdraw 0.3999 SOL to my address"
├─ Frontend:
│  ├─ Fetch Merkle proof for change note
│  ├─ Generate unshield proof
│  └─ Submit to Solana
│
├─ Solana:
│  ├─ Verify proof
│  ├─ Record nullifier
│  ├─ Transfer 0.3999 SOL from treasury to user's public address
│
├─ User's public wallet: receives 0.3999 SOL
└─ User's private balance: 0.3999 SOL → 0 SOL

Total effect:
├─ User shielded 1 SOL
├─ Transferred privately multiple times
├─ Unshielded 0.3999 SOL (0.0001 SOL in fees)
├─ Nobody can see the private transaction history
└─ Only on-chain records: commitments, nullifiers (no amounts)
```

### Privacy Guarantees

At each step:

```
SHIELD: Input amount → Output commitment
        Nobody can reverse the commitment hash
        Cannot see how much is in the note

TRANSFER: Spending a note → Creating new note
          Old note: commitment (hidden amount)
          New note: commitment (hidden amount, hidden recipient)
          Merkle proof proves: old note existed, but...
          ...nobody can see which old note was spent!
          (Unless they know your commitment)

UNSHIELD: Spending a note → Public recipient
          Recipient address is in proof, but...
          ...cannot be linked to commitment
          (Zero-knowledge proof hides the connection)
          Only know: "Some note was unshielded to address X"
          Not: "This specific note went to address X"
```

---

## Security Model

### Threat Model

#### 1. **Double-Spending Attack**

**Threat**: Attacker spends the same note twice
**Defense**:

```
- Each note has unique nullifier: Poseidon(secret_sk, note_id)
- Nullifier stored on-chain after first spend
- Second attempt: duplicate nullifier → rejected
- Prevents double-spending even if:
  - Network latency causes out-of-order transactions
  - Same proof is submitted multiple times
  - Attacker bribes validator (front-running)
```

#### 2. **Merkle Root Replay Attack**

**Threat**: Attacker uses an ancient root (from long ago)
**Defense**:

```
- Only recent roots accepted (last 64 blocks)
- Ring buffer stores roots in LIFO order
- Old roots are discarded
- Prevents:
  - Spending from "pruned" tree state
  - Forging old proofs
  - Reorgs causing tree inconsistency
```

#### 3. **Merkle Proof Forgery**

**Threat**: Attacker generates fake Merkle proof
**Defense**:

```
- Merkle tree is deterministic:
  Hash(left, right) always same for same inputs
- Cannot forge proof without:
  - Knowing a commitment in tree (requires ownership)
  - Computing correct Merkle path (requires tree data)
- Proof verification is on-chain:
  hash(commitment, proof_path) == root_on_chain
- Any error in path → verification fails
```

#### 4. **Secret Key Compromise**

**Threat**: Attacker gets user's secret key (from wallet compromise)
**Defense**:

```
- Currently derived from wallet address (weak)
- Better: BIP32/44 key derivation with wallet entropy
- If compromised:
  - Attacker can spend user's notes
  - Private notes become effectively public
  - Unshield funds to attacker's address
- Mitigation:
  - Use hardware wallets for key storage
  - Multiple signatures for high-value transfers
  - Implement note "freezing" (mark as untouchable)
```

#### 5. **Verification Key Swap**

**Threat**: Attacker replaces verification key with malicious one
**Defense**:

```
- VK hash stored on-chain
- SHA256(verification_key) must match
- VK upload requires admin signature
- Any tampering → hash mismatch → rejected
- Admin can set pause() to emergency-stop updates
```

#### 6. **Nullifier Extraction**

**Threat**: Attacker tries to extract nullifier from proof
**Defense**:

```
- Nullifier is public signal (visible on-chain)
- But it's just a hash: Poseidon(secret_sk, note_id)
- Cannot reverse hash:
  - Unknown secret_sk
  - Unknown note_id
  - Poseidon is cryptographically secure
- Even with nullifier, cannot:
  - Compute secret_sk
  - Spend the note again (duplicate nullifier rejected)
```

#### 7. **Commitment Linking**

**Threat**: Attacker links user's commitments
**Defense**:

```
- Each transfer creates new commitment with random blinding
- Even if same recipient appears twice:
  - commitment_1 = Poseidon(pk, amount1, blinding1)
  - commitment_2 = Poseidon(pk, amount2, blinding2)
  - commitments are completely different (due to blinding)
  - Cannot tell they're from same owner
- Without blinding, could see:
  - Same public key in multiple transfers
  - Deduce social network/payment graph
```

#### 8. **Amount Inference**

**Threat**: Attacker infers transaction amounts
**Defense**:

```
- Transfer: Amount not visible on-chain
  - Only nullifier and new_commitment shown
  - Attacker knows value was conserved:
    old_amount = new_amount + fee
  - But doesn't know any of these values
- Unshield: Amount is public (because it goes to public address)
  - This is intentional (must match recipient's balance increase)
  - Privacy only for transfers within pool
```

### Cryptographic Assumptions

All security depends on:

```
1. GROTH16 PROOF SECURITY
   └─ Assumption: Cannot forge valid proof without knowledge
   └─ Verified by: Light Protocol's proven implementation
   └─ Failure mode: Attacker generates fake proofs

2. POSEIDON HASH SECURITY
   └─ Assumption: Cannot reverse hash or find collisions
   └─ Used for: Commitments, nullifiers, Merkle tree
   └─ Verified by: Academic peer review
   └─ Failure mode: Attacker forges commitments/nullifiers

3. BN254 CURVE SECURITY
   └─ Assumption: ECDLP (elliptic curve discrete log) is hard
   └─ Used for: Proof verification mathematics
   └─ Verified by: 15+ years of cryptanalysis
   └─ Failure mode: Quantum computer breaks curve

4. SOLANA BLOCKCHAIN SECURITY
   └─ Assumption: Cannot modify past transactions
   └─ Used for: Storing roots, nullifiers, commitments
   └─ Verified by: Solana's Proof-of-History
   └─ Failure mode: 51% attack on Solana (unlikely)
```

---

## Data Structures

### Note Structure

```typescript
interface Note {
  // Identifying
  commitment: string; // 0x...64 hex chars

  // Secrets (kept locally, never sent to chain)
  blinding: string; // Random value used in commitment

  // Metadata
  amount: string; // In SOL (e.g., "0.5")
  recipient: string; // ZK address of owner/recipient
  timestamp: number; // When note was created
  txSignature: string; // Solana tx hash (for debugging)

  // State
  spent: boolean; // Has this note been spent?
  spentBy?: {
    // Optional: info about spending
    txSignature: string;
    timestamp: number;
  };
}
```

### Merkle Proof Structure

```typescript
interface MerkleProof {
  root: string; // Current root (hex)
  path: string[]; // 20 elements, one per tree level
  pathPositions: string[]; // 20 elements, 0=left, 1=right
}

// Example for a leaf at index 42:
// path[0] = sibling at level 0
// path[1] = sibling at level 1
// ...
// path[19] = sibling at level 19
// pathPositions[i] indicates which side (left or right)
```

### ZK Proof Structure

```typescript
interface Proof {
  pi_a: [string, string]; // First component of proof
  pi_b: [[string, string], [string, string]]; // Second component
  pi_c: [string, string]; // Third component
  protocol: string; // "groth16"
}

// These are the 3 components of Groth16 proof (A, B, C points)
```

### Public Signals (per circuit)

```typescript
// SHIELD
interface ShieldPublicSignals {
  commitment: string;
}

// TRANSFER
interface TransferPublicSignals {
  root: string;
  nullifier: string;
  newCommitment: string;
  fee: string;
}

// UNSHIELD
interface UnshieldPublicSignals {
  root: string;
  nullifier: string;
  recipientLo: string;
  recipientHi: string;
  publicAmount: string;
  fee: string;
}
```

---

## Performance Metrics

### Latency

| Operation                   | Time     | Notes                      |
| --------------------------- | -------- | -------------------------- |
| Proof generation (shield)   | ~10s     | Backend, ~50 constraints   |
| Proof generation (transfer) | ~30s     | Backend, ~1000 constraints |
| Proof generation (unshield) | ~30s     | Backend, ~1000 constraints |
| On-chain proof verification | ~200k CU | Depends on VK size         |
| Merkle proof generation     | ~100ms   | In-memory index            |
| Merkle proof computation    | ~50ms    | 20-level tree              |

### Storage

| Item             | Size      | Notes                |
| ---------------- | --------- | -------------------- |
| Proof (A+B+C)    | 256 bytes | Fixed size           |
| Merkle root      | 32 bytes  | Fixed size           |
| Nullifier        | 32 bytes  | One per spent note   |
| Commitment       | 32 bytes  | One per note         |
| Verification key | ~1-2 MB   | Stored on-chain once |

### Transaction Costs

| Transaction      | Lamports  | SOL       | Notes                         |
| ---------------- | --------- | --------- | ----------------------------- |
| Shield (deposit) | 5,000,000 | 0.005 SOL | Varies by amount              |
| Transfer         | 5,000,000 | 0.005 SOL | Including proof verification  |
| Unshield         | 5,000,000 | 0.005 SOL | Including treasure withdrawal |

---

## Deployment Architecture

### Development (Localhost)

```
Frontend: http://localhost:3001
├─ Next.js dev server
├─ Hot reload enabled
└─ Connects to backend API

Backend: http://localhost:3000
├─ NestJS dev server
├─ In-memory indexer
├─ Supabase for notes storage
└─ Listens to Solana RPC

Solana: https://api.testnet.solana.com
├─ Solana Testnet
├─ For testing
└─ Anyone can deploy programs

Circuit artifacts: zk-circuits/build/
├─ Pre-built and committed to git
├─ Shield, transfer, unshield
└─ Loaded at startup
```

### Production (Live)

```
Frontend: https://noirwire.com
├─ Next.js static build
├─ CDN-cached assets
└─ Environment: NEXT_PUBLIC_API_URL

Backend: https://api.noirwire.com
├─ NestJS production build
├─ Persistent database (Supabase)
├─ Environment: SOLANA_RPC_URL, SUPABASE_URL
└─ Running on Solana Testnet

Solana: https://api.testnet.solana.com
├─ Solana Testnet
├─ For testing before mainnet
└─ Testnet SOL from faucet

Environment Variables:
├─ NEXT_PUBLIC_API_URL (frontend → backend)
├─ SOLANA_RPC_URL (backend → testnet)
├─ SUPABASE_URL (backend → database)
└─ SUPABASE_SERVICE_KEY (auth)
```

## Conclusion

NoirWire achieves privacy on Solana by combining:

1. **Zero-Knowledge Proofs** - Prove facts without revealing data
2. **Merkle Trees** - Efficiently prove note ownership
3. **Nullifier System** - Prevent double-spending
4. **Solana Programs** - Verify proofs on-chain
5. **Indexer** - Generate Merkle proofs efficiently

The result: Users can transfer SOL privately while maintaining full on-chain auditability and Solana's finality guarantees.

---
