# Technical Reference

> For developers integrating or extending NoirWire

**For users:** See [DOCS.md](./DOCS.md) | **Quick start:** See [README.md](../README.md)

---

## Quick Overview

- **Circuits:** Circom 2.x → compiled to WASM (proof generation) + on-chain verification keys
- **Proofs:** Groth16 on BN254 curve, SnarkJS generates, Solana program verifies
- **Backend:** NestJS API with in-memory Merkle tree indexer
- **Frontend:** Next.js with local proof generation
- **Storage:** Supabase for encrypted notes, browser localStorage for keys

---

## Circuit Implementation

### Build Flow

```bash
circom shield.circom --r1cs --wasm
snarkjs r1cs info shield.r1cs
snarkjs powersoftau ...     # Trusted setup
snarkjs zkey new ...        # Generate proving key
snarkjs zkey export verificationkey ...  # Export verification key
```

Output:

- `shield.wasm` - Used by SnarkJS for proof generation
- `shield.vkey.json` - Verification key stored on-chain

### Three Circuits

All in `/external/noirwire-contracts/zk-circuits/src/`:

**shield.circom**

- Input: amount, blinding, recipient_pk
- Output: commitment = Poseidon(amount, blinding, recipient_pk)
- Constraints: 50 (amount range check + hash verification)

**transfer.circom**

- Input: secret_key, amount, blinding, merkle_proof, new_recipient
- Output: nullifier, new_commitment, fee
- Constraints: 15000+ (merkle path verification + value conservation)

**unshield.circom**

- Input: secret_key, amount, blinding, merkle_proof, recipient_address
- Output: nullifier, recipient_address (split into lo/hi), amount
- Constraints: Similar to transfer

All use:

- **Poseidon** for hashing (inside ZK)
- **BN254** elliptic curve
- **Groth16** proof system (128-bit security)

---

## Solana Program

**File:** `/external/noirwire-contracts/programs/zk-pool/src/lib.rs`

### Accounts

```rust
#[derive(Accounts)]
pub struct SubmitTransfer<'info> {
    pub payer: Signer<'info>,
    pub program_state: Account<'info, ProgramState>,  // Merkle roots, paused flag
    pub nullifier_set: Account<'info, NullifierSet>,  // Spent notes
    pub treasury: Account<'info, TokenAccount>,       // SOL pool
    // ...
}
```

### Key Functions

**`shield`** - Receive SOL, store commitment

```rust
- Verify proof (using Groth16 verifier)
- Store commitment in Merkle tree
- Transfer SOL to treasury
```

**`transfer`** - Verify transfer proof

```rust
- Verify Groth16 proof
- Check nullifier not spent before
- Store nullifier, emit new commitment
- No SOL moves (internal transfer)
```

**`unshield`** - Send SOL to wallet

```rust
- Verify Groth16 proof
- Check nullifier not spent
- Transfer SOL from treasury to recipient wallet
```

**`update_merkle_root`** - Indexer updates tree state

```rust
- Called by backend after new commitments
- Updates Merkle root
- Maintains window of recent roots (64 blocks)
```

### Security

- **Proof verification:** Anchor's built-in Groth16 verifier
- **Nullifier storage:** BTreeMap, checked on every spend
- **Pause mechanism:** Admin can pause all transfers (emergency)
- **Merkle root window:** Only recent roots accepted (prevent replays)

---

## Backend API

**File:** `apps/api/src/`

### Key Endpoints

```
POST /proof/generate
  Input: circuit name, private inputs
  Output: Groth16 proof + public signals
  Time: ~30sec (CPU-intensive)

GET /indexer/merkle-tree/root
  Output: Current Merkle root for proofs

POST /indexer/merkle-tree/path
  Input: commitment
  Output: Merkle proof (20 levels for 2^20 tree)

GET /blockchain/synced-to-block
  Output: Current on-chain block height indexed
```

### Merkle Tree Indexer

- **In-memory tree:** 20 levels (max 2^20 ≈ 1M notes)
- **Persistency:** Supabase (for recovery)
- **Update mechanism:** Polls Solana RPC every 10 seconds for new commitment events
- **Proof generation:** Given commitment, generates Merkle proof showing inclusion

### Database

Supabase schema:

```sql
notes
  - commitment (primary key)
  - blinding
  - amount
  - recipient_pk
  - created_at
  - nullifier (when spent)
  - tx_signature (when spent)

nullifiers
  - value (primary key)
  - spent_at
  - tx_signature
```

---

## Frontend

**Files:** `apps/web/app/`

### Proof Generation (Local)

```typescript
// Use SnarkJS directly in browser
const proof = await groth16.prove(
  wasmFile, // shield.wasm
  witnessFile, // Private inputs
  zkeyFile, // Proving key (~300MB, downloaded on first use)
);
```

### Key Management

- Secret key derived from wallet signature
- Stored in `localStorage` (encrypted with user password)
- Private notes also encrypted locally before sending to backend

### UI Flow

Shield → Transfer → Unshield (standard progression)

---

## Performance

| Operation            | Location            | Duration | Bottleneck             |
| -------------------- | ------------------- | -------- | ---------------------- |
| Proof generation     | Browser/Backend     | ~30sec   | Constraint computation |
| Groth16 verification | Solana              | 2-5sec   | On-chain compute       |
| Merkle proof gen     | Backend (in-memory) | <100ms   | Tree lookup            |
| Indexer update       | Backend             | Realtime | Supabase writes        |

---

## Testing

```bash
cd /external/noirwire-contracts/
anchor test          # Runs all circuit + program tests

# Specific tests
anchor test -- --features "shield"
anchor test -- --test "merkle_tree"
```

Test files:

- `programs/zk-pool/tests/` - On-chain program tests
- `zk-circuits/tests/` - Circuit witness tests

---

## Common Issues

**Proof generation hangs**

- Check `zkeyFile` loaded correctly
- Verify WASM file not corrupted
- Try restarting backend

**Merkle proof mismatch**

- Indexer out of sync with on-chain
- Wait for indexer to catch up (auto-sync every 10 sec)
- Can manually trigger resync via admin endpoint

**Groth16 verification fails**

- Check proof format (base64 encoding)
- Verify correct verification key used
- Check circuit matches proving key

---

## Deployment

### Local Development

```bash
# Start validator
solana-test-validator

# Deploy program
anchor build
anchor deploy

# Start backend
cd apps/api && npm start

# Start frontend
cd apps/web && npm run dev
```

### Testnet

Automatic CI/CD via GitHub Actions:

- Publishes to noirwire.com

---

⚠️ **Experimental** - Not audited, potential bugs in circuit implementation and indexer synchronization.

Report issues: ph1l1ph@proton.me
snarkjs powersoftau new bn128 12 pot12_0000.ptau
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau
snarkjs zkey new shield.r1cs pot12_0001.ptau shield_0000.zkey
snarkjs zkey verify shield.r1cs pot12_0001.ptau shield_0000.zkey
snarkjs zkey beacon shield_0000.zkey shield_final.zkey
snarkjs zkey export verificationkey shield_final.zkey shield.vkey.json

````

### Shield Circuit

**File:** `zk-circuits/src/shield.circom`

```circom
pragma circom 2.0;

include "circomlib/poseidon.circom";
include "circomlib/rangeproof.circom";

template Shield() {
    // Inputs (private)
    signal input recipient_pk;
    signal input amount;           // In lamports, < 2^64
    signal input blinding;

    // Outputs (public)
    signal output commitment;

    // Compute commitment
    component poseidon = Poseidon(3);  // 3 inputs
    poseidon.inputs[0] <== recipient_pk;
    poseidon.inputs[1] <== amount;
    poseidon.inputs[2] <== blinding;
    commitment <== poseidon.out;

    // Range check: amount < 2^64
    component amountRange = Num2Bits(64);
    amountRange.in <== amount;
}

component main {
    public [recipient_pk]
} = Shield();
````

**Constraints:** ~50 constraints

---

### Transfer Circuit

**File:** `zk-circuits/src/transfer.circom`

```circom
pragma circom 2.0;

include "circomlib/poseidon.circom";
include "circomlib/mux1.circom";
include "merkletree.circom";  // Custom library

template Transfer(n_levels) {
    // === OLD NOTE (being spent) ===
    signal input old_secret_key;
    signal input old_recipient_pk;
    signal input old_amount;
    signal input old_blinding;
    signal input note_id;

    // === MERKLE PROOF ===
    signal input merkle_path[n_levels];
    signal input merkle_path_positions[n_levels];

    // === NEW NOTE (recipient) ===
    signal input new_recipient_pk;
    signal input new_amount;
    signal input new_blinding;

    // === FEE ===
    signal input fee;

    // === OUTPUTS (public) ===
    signal output root;
    signal output nullifier;
    signal output new_commitment;
    signal output transfer_fee;

    // 1. Compute old commitment
    component oldHash = Poseidon(3);
    oldHash.inputs[0] <== old_recipient_pk;
    oldHash.inputs[1] <== old_amount;
    oldHash.inputs[2] <== old_blinding;
    signal oldCommitment <== oldHash.out;

    // 2. Compute nullifier (prove you know the secret)
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== old_secret_key;
    nullifierHash.inputs[1] <== note_id;
    nullifier <== nullifierHash.out;

    // 3. Verify Merkle inclusion
    component merkleVerify = MerkleInclusionProof(n_levels);
    merkleVerify.leaf <== oldCommitment;
    for (var i = 0; i < n_levels; i++) {
        merkleVerify.siblings[i] <== merkle_path[i];
        merkleVerify.positions[i] <== merkle_path_positions[i];
    }
    root <== merkleVerify.root;

    // 4. Compute new commitment
    component newHash = Poseidon(3);
    newHash.inputs[0] <== new_recipient_pk;
    newHash.inputs[1] <== new_amount;
    newHash.inputs[2] <== new_blinding;
    new_commitment <== newHash.out;

    // 5. Constraint: value conservation
    old_amount === new_amount + fee;

    // 6. Range checks
    component oldAmountRange = Num2Bits(64);
    oldAmountRange.in <== old_amount;

    component newAmountRange = Num2Bits(64);
    newAmountRange.in <== new_amount;

    component feeRange = Num2Bits(64);
    feeRange.in <== fee;

    // Output fee for public signal
    transfer_fee <== fee;
}

component main {
    public [root, nullifier, new_commitment, transfer_fee]
} = Transfer(20);
```

**Constraints:** ~1,000 constraints (primarily from Merkle proof verification)

---

### Unshield Circuit

**File:** `zk-circuits/src/unshield.circom`

```circom
pragma circom 2.0;

include "circomlib/poseidon.circom";

template Unshield(n_levels) {
    // === OLD NOTE ===
    signal input old_secret_key;
    signal input old_recipient_pk;
    signal input old_amount;
    signal input old_blinding;
    signal input note_id;

    // === MERKLE PROOF ===
    signal input merkle_path[n_levels];
    signal input merkle_path_positions[n_levels];

    // === PUBLIC RECIPIENT ===
    // Split into two 128-bit fields because:
    // - Solana address is 256 bits (32 bytes)
    // - BN254 field elements are ~254 bits
    signal input recipient_lo;      // Lower 128 bits
    signal input recipient_hi;      // Upper 128 bits

    // === AMOUNT & FEE ===
    signal input public_amount;
    signal input unshield_fee;

    // === OUTPUTS ===
    signal output root;
    signal output nullifier;
    signal output out_recipient_lo;
    signal output out_recipient_hi;
    signal output out_amount;
    signal output out_fee;

    // 1-2. Compute old commitment & nullifier (same as transfer)
    component oldHash = Poseidon(3);
    oldHash.inputs[0] <== old_recipient_pk;
    oldHash.inputs[1] <== old_amount;
    oldHash.inputs[2] <== old_blinding;
    signal oldCommitment <== oldHash.out;

    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== old_secret_key;
    nullifierHash.inputs[1] <== note_id;
    nullifier <== nullifierHash.out;

    // 3. Verify Merkle inclusion
    component merkleVerify = MerkleInclusionProof(n_levels);
    merkleVerify.leaf <== oldCommitment;
    for (var i = 0; i < n_levels; i++) {
        merkleVerify.siblings[i] <== merkle_path[i];
        merkleVerify.positions[i] <== merkle_path_positions[i];
    }
    root <== merkleVerify.root;

    // 4. Constraint: value conservation
    old_amount === public_amount + unshield_fee;

    // 5. Encode recipient address (validate split)
    // recipient = recipient_hi * 2^128 + recipient_lo
    component addrRange = AddressEncoding();
    addrRange.lo <== recipient_lo;
    addrRange.hi <== recipient_hi;

    // 6. Output public signals
    out_recipient_lo <== recipient_lo;
    out_recipient_hi <== recipient_hi;
    out_amount <== public_amount;
    out_fee <== unshield_fee;
}

component main {
    public [root, nullifier, recipient_lo, recipient_hi, public_amount, unshield_fee]
} = Unshield(20);
```

---

## Solana Program Architecture

### Program Structure

```
programs/zk-pool/
├── src/
│   ├── lib.rs                      # Entry point
│   ├── state.rs                    # Account structures
│   ├── instructions/
│   │   ├── initialize.rs
│   │   ├── set_verification_key.rs
│   │   ├── add_root.rs
│   │   ├── set_paused.rs
│   │   ├── submit_shield.rs
│   │   ├── submit_transfer.rs
│   │   └── submit_unshield.rs
│   ├── verifier/
│   │   ├── mod.rs                 # Groth16 verification
│   │   └── constants.rs           # Pairing parameters
│   ├── errors.rs
│   └── events.rs
└── Cargo.toml
```

### State Accounts

```rust
// File: state.rs

#[account]
pub struct PoolConfig {
    pub admin: Pubkey,
    pub paused: bool,
    pub merkle_depth: u8,
    pub root_window: u16,
    pub abi_hash: [u8; 32],        // SHA256 of ABI spec
    pub initialized: bool,
    pub bump: u8,
}

#[account]
pub struct RootsAccount {
    // Ring buffer: last 64 roots
    pub roots: [Option<[u8; 32]>; 64],
    pub root_index: usize,
    pub root_count: usize,
    pub bump: u8,
}

#[account]
pub struct NullifiersAccount {
    // Set of all spent nullifiers
    pub nullifiers: Vec<[u8; 32]>,
    pub bump: u8,
}

#[account]
pub struct VerificationKeyAccount {
    pub circuit_type: u8,           // 0=shield, 1=transfer, 2=unshield
    pub vk_hash: [u8; 32],         // SHA256(vk_data)
    pub vk_data: Vec<u8>,          // Actual VK (~1-2 MB)
    pub bump: u8,
}
```

### Instruction: Submit Transfer

```rust
// File: instructions/submit_transfer.rs

#[derive(Accounts)]
pub struct SubmitTransfer<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"roots"],
        bump
    )]
    pub roots_account: Account<'info, RootsAccount>,

    #[account(
        mut,
        seeds = [b"nullifiers"],
        bump
    )]
    pub nullifiers_account: Account<'info, NullifiersAccount>,

    #[account(
        seeds = [b"pool_config"],
        bump
    )]
    pub pool_config: Account<'info, PoolConfig>,

    pub system_program: Program<'info, System>,
}

pub fn submit_transfer(
    ctx: Context<SubmitTransfer>,
    proof_data: Vec<u8>,
    public_inputs: [u8; 128],      // [root, nullifier, new_commitment, fee]
) -> Result<()> {
    let config = &ctx.accounts.pool_config;

    // 1. Check not paused
    require!(!config.paused, ErrorCode::PoolPaused);

    // 2. Parse public signals
    let root = extract_signal(&public_inputs, 0);
    let nullifier = extract_signal(&public_inputs, 32);
    let new_commitment = extract_signal(&public_inputs, 64);
    let fee = extract_signal(&public_inputs, 96);

    // 3. Verify root is recent
    let roots_account = &mut ctx.accounts.roots_account;
    require!(
        is_root_valid(roots_account, &root),
        ErrorCode::InvalidRoot
    );

    // 4. Check nullifier not already spent
    let nullifiers_account = &mut ctx.accounts.nullifiers_account;
    require!(
        !nullifiers_account.nullifiers.contains(&nullifier),
        ErrorCode::NullifierAlreadySpent
    );

    // 5. Verify Groth16 proof
    let vk_account = ctx.remaining_accounts[0].clone();
    verify_groth16_proof(
        &proof_data,
        &public_inputs,
        &vk_account,
        1,  // circuit_type: 1 = transfer
    )?;

    // 6. Record nullifier as spent
    nullifiers_account.nullifiers.push(nullifier);

    // 7. Emit event
    emit!(TransferSubmitted {
        user: ctx.accounts.user.key(),
        root: root,
        nullifier: nullifier,
        new_commitment: new_commitment,
    });

    Ok(())
}
```

### Groth16 Verification

```rust
// File: verifier/mod.rs

pub fn verify_groth16_proof(
    proof_data: &[u8],
    public_inputs: &[u8; 128],
    vk_account: &AccountInfo,
    circuit_type: u8,
) -> Result<()> {
    // 1. Deserialize proof: (A, B, C) points
    let (proof_a, proof_b, proof_c) = deserialize_proof(proof_data)?;

    // 2. Load verification key
    let vk_data = &vk_account.data.borrow();
    let vk = deserialize_vk(&vk_data[..])?;

    // 3. Check VK hash matches
    let computed_hash = sha256(&vk_data[..]);
    require!(
        computed_hash == vk.expected_hash,
        ErrorCode::VerificationKeyMismatch
    );

    // 4. Parse public inputs based on circuit type
    let pub_inputs = match circuit_type {
        0 => parse_shield_inputs(public_inputs)?,
        1 => parse_transfer_inputs(public_inputs)?,
        2 => parse_unshield_inputs(public_inputs)?,
        _ => return Err(ErrorCode::InvalidCircuitType.into()),
    };

    // 5. Verify pairing equation
    // e(A, B) * e(C, -gamma) * e(proof_outputs, -delta) == 1
    verify_pairing(
        &proof_a,
        &proof_b,
        &proof_c,
        &pub_inputs,
        &vk,
    )?;

    Ok(())
}
```

---

## Backend Services

### Indexer Service

```typescript
// File: src/indexer/indexer.service.ts

@Injectable()
export class IndexerService {
  private trees: Map<string, MerkleTree> = new Map();

  constructor(private supabase: SupabaseService) {}

  // Add commitment to tree
  addCommitment(circuit: string, commitment: string): void {
    if (!this.trees.has(circuit)) {
      this.trees.set(circuit, new MerkleTree(20));
    }

    const tree = this.trees.get(circuit)!;
    const index = tree.addLeaf(commitment);

    Logger.debug(
      `Added commitment to ${circuit} at index ${index}, new root: ${tree.getRoot()}`,
    );
  }

  // Get Merkle proof for a commitment
  getMerkleProof(circuit: string, commitment: string) {
    const tree = this.trees.get(circuit);
    if (!tree) throw new Error(`Tree not found: ${circuit}`);

    const leafIndex = tree.findLeafIndex(commitment);
    if (leafIndex === -1) {
      throw new Error(`Commitment not found: ${commitment}`);
    }

    return {
      root: tree.getRoot(),
      path: tree.getPath(leafIndex),
      pathPositions: tree.getPathPositions(leafIndex),
    };
  }

  // Get current root
  getRoot(circuit: string): string {
    const tree = this.trees.get(circuit);
    if (!tree) throw new Error(`Tree not found: ${circuit}`);
    return tree.getRoot();
  }

  // Get all commitments (for debugging)
  getCommitments(circuit: string): string[] {
    const tree = this.trees.get(circuit);
    if (!tree) return [];
    return tree.getAllLeaves();
  }
}
```

### Merkle Tree Implementation

```typescript
// In-memory Merkle tree with Poseidon hashing

class MerkleTree {
  depth: number;
  tree: string[][]; // tree[level][index]

  constructor(depth: number) {
    this.depth = depth;
    this.tree = [];

    // Initialize all levels with zeros
    for (let level = 0; level <= depth; level++) {
      const levelSize = Math.pow(2, depth - level);
      this.tree[level] = Array(levelSize).fill(ZERO_HASH);
    }
  }

  addLeaf(leaf: string): number {
    // Find next empty index
    const leafIndex = this.tree[0].findIndex((l) => l === ZERO_HASH);

    // Add leaf
    this.tree[0][leafIndex] = leaf;

    // Recompute parents
    for (let level = 1; level <= this.depth; level++) {
      const parentIndex = Math.floor(leafIndex / 2 ** level);
      const leftIndex = parentIndex * 2;
      const rightIndex = leftIndex + 1;

      const left = this.tree[level - 1][leftIndex] ?? ZERO_HASH;
      const right = this.tree[level - 1][rightIndex] ?? ZERO_HASH;

      this.tree[level][parentIndex] = poseidon([left, right]);
    }

    return leafIndex;
  }

  getPath(leafIndex: number): string[] {
    const path: string[] = [];

    for (let level = 0; level < this.depth; level++) {
      const isRight = (leafIndex >> level) & 1;
      const siblingIndex = leafIndex ^ (1 << level);

      path.push(this.tree[level][siblingIndex]);
    }

    return path;
  }

  getPathPositions(leafIndex: number): number[] {
    const positions: number[] = [];

    for (let level = 0; level < this.depth; level++) {
      positions.push((leafIndex >> level) & 1);
    }

    return positions;
  }

  getRoot(): string {
    return this.tree[this.depth][0];
  }

  findLeafIndex(leaf: string): number {
    return this.tree[0].findIndex((l) => l === leaf);
  }

  getAllLeaves(): string[] {
    return this.tree[0].filter((l) => l !== ZERO_HASH);
  }
}
```

### Blockchain Sync Listener

```typescript
// File: src/indexer/blockchain.listener.ts

@Injectable()
export class BlockchainSyncService implements OnModuleInit {
  constructor(
    private indexer: IndexerService,
    private solana: SolanaService,
  ) {}

  async onModuleInit() {
    await this.startListening();
  }

  private async startListening() {
    const connection = new Connection(SOLANA_RPC_URL);

    // Listen for transactions to zk-pool program
    connection.onProgramAccountChange(POOL_PROGRAM_ID, async (accountInfo) => {
      await this.processProgramAccountChange(accountInfo);
    });

    Logger.log('Blockchain sync listener started');
  }

  private async processProgramAccountChange(accountInfo: any) {
    // Parse logs from recent transactions
    // Extract commitments and update indexer
    // Example: detect when submit_shield is called
    // ├─ Parse ShieldSubmitted event
    // ├─ Extract commitment
    // └─ Call indexer.addCommitment('shield', commitment)
  }
}
```

---

## Frontend Integration

### Transfer Flow Implementation

```typescript
// File: pages/transfer.tsx

export default function TransferPage() {
    const [amount, setAmount] = useState('');
    const [recipient, setRecipient] = useState('');
    const [isGeneratingProof, setIsGeneratingProof] = useState(false);

    const handleTransfer = async () => {
        try {
            setIsGeneratingProof(true);

            // 1. Get user's unspent notes
            const notes = await loadUserNotes(walletAddress);
            const selectedNote = notes.find(n => !n.spent && n.amount >= amount);
            if (!selectedNote) throw new Error('Insufficient funds');

            // 2. Calculate amounts
            const amountLamports = toBN(amount, 9);
            const feeLamports = calculateFee(amountLamports);
            const transferAmount = amountLamports.minus(feeLamports);
            const changeAmount = selectedNote.amountLamports.minus(amountLamports);

            // 3. Fetch Merkle proof
            const merkleProof = await indexerClient.getMerkleProof(
                'shield',
                selectedNote.commitment
            );

            // 4. Generate transfer proof
            const proofData = await proofService.generateTransferProof({
                secret_key: deriveSecretKey(walletAddress),
                old_recipient_pk: walletPublicKey,
                old_amount: selectedNote.amountLamports.toString(),
                old_blinding: selectedNote.blinding,
                note_id: selectedNote.noteId,
                merkle_path: merkleProof.path,
                merkle_path_positions: merkleProof.pathPositions,
                new_recipient_pk: recipient,
                new_amount: transferAmount.toString(),
                new_blinding: generateRandomBlinding(),
                fee: feeLamports.toString(),
            });

            // 5. Submit to Solana
            const tx = await program.methods
                .submitTransfer(proofData.proof, proofData.publicSignals)
                .rpc();

            // 6. Create notes locally
            const recipientNote = {
                commitment: proofData.publicSignals[2],  // new_commitment
                amount: transferAmount.toString(),
                recipient: recipient,
                spent: false,
            };

            const changeNote = {
                commitment: deriveCommitment(walletPublicKey, changeAmount),
                amount: changeAmount.toString(),
                recipient: walletPublicKey,
                spent: false,
            };

            // 7. Mark original note as spent
            selectedNote.spent = true;
            selectedNote.spentBy = { txSignature: tx, timestamp: Date.now() };

            // 8. Save notes
            await saveUserNotes(walletAddress, [
                ...notes,
                recipientNote,
                changeNote,
            ]);

            showSuccess('Transfer complete!');
        } finally {
            setIsGeneratingProof(false);
        }
    };

    return (
        <div>
            <input
                placeholder="Amount (SOL)"
                value={amount}
                onChange={e => setAmount(e.target.value)}
            />
            <input
                placeholder="Recipient ZK address"
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
            />
            <button onClick={handleTransfer} disabled={isGeneratingProof}>
                {isGeneratingProof ? 'Generating proof...' : 'Transfer'}
            </button>
        </div>
    );
}
```

---

## Data Structures

### Circuit Input/Output Encoding

```typescript
// Shield
interface ShieldInput {
  recipient_pk: string; // Field element
  amount: string; // Field element (0 to 2^64-1)
  blinding: string; // Field element
}

interface ShieldOutput {
  commitment: string; // Field element
}

// Transfer
interface TransferInput {
  old_secret_key: string;
  old_recipient_pk: string;
  old_amount: string;
  old_blinding: string;
  note_id: string;
  merkle_path: string[]; // 20 field elements
  merkle_path_positions: string[]; // 20 bits (0 or 1)
  new_recipient_pk: string;
  new_amount: string;
  new_blinding: string;
  fee: string;
}

interface TransferOutput {
  root: string;
  nullifier: string;
  new_commitment: string;
  fee: string;
}

// Unshield
interface UnshieldInput {
  old_secret_key: string;
  old_recipient_pk: string;
  old_amount: string;
  old_blinding: string;
  note_id: string;
  merkle_path: string[];
  merkle_path_positions: string[];
  recipient_lo: string; // Lower 128 bits of address
  recipient_hi: string; // Upper 128 bits of address
  public_amount: string;
  fee: string;
}

interface UnshieldOutput {
  root: string;
  nullifier: string;
  recipient_lo: string;
  recipient_hi: string;
  public_amount: string;
  fee: string;
}
```

---

## Security Analysis

### Cryptographic Assumptions

| Component    | Assumption         | Attack if broken            |
| ------------ | ------------------ | --------------------------- |
| **Groth16**  | SNARK soundness    | Forge invalid proofs        |
| **Poseidon** | Cryptographic hash | Reverse commitments         |
| **BN254**    | ECDLP hardness     | Break curve security        |
| **Solana**   | No 51% attacks     | Rewrite transaction history |

## Testing & Verification

### Unit Tests

```bash
# Frontend
npm run test:web

# Backend
npm run test:api

# Circuits
npm run test:circuits

# End-to-end
npm run test:e2e
```

---

## Debugging & Troubleshooting

### Enable Diagnostics

```typescript
// Frontend
import { logIndexerDiagnostics } from '@/lib/privacyUtils';

await logIndexerDiagnostics(commitment);
// Logs:
// ├─ Commitment found: YES/NO
// ├─ Merkle proof valid: YES/NO
// ├─ Tree root matches: YES/NO
// └─ Suggested fixes
```

### Verify Proof Locally

```bash
# Use SnarkJS to verify proof
snarkjs groth16 verify \
    shield.vkey.json \
    public.json \
    proof.json
```

---
