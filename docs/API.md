# API Reference

> NoirWire backend REST API

**Base:**

- Production: `https://noirwireapi-production.up.railway.app/`
- Local: `http://localhost:3000`

---

## Endpoints

### `POST /proof/generate`

Generate a zero-knowledge proof (30 seconds).

**Request:**

```json
{
  "circuit": "transfer|shield|unshield",
  "input": {
    /* circuit-specific private inputs */
  }
}
```

**Response:**

```json
{
  "proof": "AAB9C2FD...", // Base64 encoded Groth16 proof
  "publicSignals": ["0x1234...", "0x5678..."] // Circuit outputs
}
```

**Circuits:**

| Circuit    | Inputs                                                     | Outputs                        |
| ---------- | ---------------------------------------------------------- | ------------------------------ |
| `shield`   | amount, blinding, recipient_pk                             | commitment                     |
| `transfer` | secret_key, amount, blinding, merkle_proof, new_recipient  | nullifier, new_commitment, fee |
| `unshield` | secret_key, amount, blinding, merkle_proof, wallet_address | nullifier, recipient, amount   |

---

### `GET /indexer/status`

Current indexer status.

**Response:**

```json
{
  "initialized": true,
  "shield_root": "0x1234abcd...",
  "transfer_root": "0x5678efgh...",
  "unshield_root": "0xabcdef...",
  "synced_to_block": 245823
}
```

---

### `POST /indexer/merkle-proof`

Get Merkle proof for a commitment.

**Request:**

```json
{
  "commitment": "0xf7a3b2c1d4e5..."
}
```

**Response:**

```json
{
  "root": "0x1234abcd...",
  "path": ["0xaa...", "0xbb...", ...],        // 20 siblings for depth-20 tree
  "pathPositions": ["0", "1", "0", ...]       // 0=left, 1=right at each level
}
```

---

### `GET /indexer/merkle-root`

Get current Merkle root (use in proofs).

**Response:**

```json
{
  "root": "0x1234abcd..."
}
```

---

### `GET /blockchain/synced-to-block`

Which on-chain block has been indexed.

**Response:**

```json
{
  "block": 245823,
  "blockTime": 1698000000
}
```

---

## Error Handling

Errors return JSON:

```json
{
  "statusCode": 400,
  "message": "Invalid circuit: unknown_circuit",
  "error": "BadRequestException"
}
```

Common codes:

- `400` - Bad request (invalid circuit, missing inputs)
- `500` - Server error (proof generation failed, indexer out of sync)
- `503` - Indexer not ready (wait a moment, then retry)

---

## Examples

### Shield 1 SOL

```bash
curl -X POST http://localhost:3000/proof/generate \
  -H "Content-Type: application/json" \
  -d '{
    "circuit": "shield",
    "input": {
      "amount": "1000000000",
      "blinding": "0x123456...",
      "recipient_pk": "0xabc123..."
    }
  }'
```

### Transfer 0.5 SOL

```bash
# First get Merkle proof
MERKLE_PROOF=$(curl -X POST http://localhost:3000/indexer/merkle-proof \
  -H "Content-Type: application/json" \
  -d '{"commitment": "0xf7a3b2c1d4e5..."}')

# Then generate transfer proof
curl -X POST http://localhost:3000/proof/generate \
  -H "Content-Type: application/json" \
  -d '{
    "circuit": "transfer",
    "input": {
      "secret_key": "0x123456...",
      "old_amount": "1000000000",
      "new_amount": "499900000",
      "fee": "100000",
      "merkle_path": '$(echo $MERKLE_PROOF | jq '.path')',
      "merkle_path_positions": '$(echo $MERKLE_PROOF | jq '.pathPositions')',
      "new_recipient_pk": "0xdef456...",
      "new_blinding": "0xabc789..."
    }
  }'
```

---

**For implementation details, see [TECHNICAL.md](./TECHNICAL.md#backend-api)**

⚠️ **Experimental API** - May change during development.
"transfers": 2891,
"unshields": 127
}
}

````

---

### `GET /indexer/:circuit/root`

Get current Merkle root for a circuit.

**URL Parameters:**
- `:circuit` - `shield` | `transfer` | `unshield`

**Response:**

```json
{
  "circuit": "shield",
  "root": "0x1234abcd...",
  "leafCount": 1543,
  "timestamp": "2024-10-28T14:35:22Z"
}
````

---

### `POST /indexer/:circuit/proof`

Generate a Merkle proof for a commitment.

**Request:**

```json
{
  "commitment": "0xf7a3b2c1d4e5..."
}
```

**Response:**

```json
{
  "commitment": "0xf7a3b2c1d4e5...",
  "leafIndex": 42,
  "root": "0x1234abcd...",
  "path": [
    "0xaa...",
    "0xbb...",
    "0xcc...",
    ...
  ],
  "pathPositions": [0, 1, 0, 1, 0, 1, ...]
}
```

**Error (commitment not found):**

```json
{
  "statusCode": 404,
  "message": "Commitment not found in tree",
  "error": "NotFoundException"
}
```

---

### `GET /indexer/:circuit/commitments`

Get all commitments in a circuit (debug endpoint).

**Response:**

```json
{
  "circuit": "shield",
  "count": 1543,
  "commitments": [
    "0xf7a3b2c1...",
    "0x12abcd34...",
    ...
  ]
}
```

⚠️ **Warning:** This endpoint returns all commitments. Use with caution on production. Consider security implications.

---

### `POST /indexer/:circuit/commit`

Manually add a commitment to the tree (for recovery/debugging).

**Request:**

```json
{
  "commitment": "0xf7a3b2c1d4e5..."
}
```

**Response:**

```json
{
  "commitment": "0xf7a3b2c1d4e5...",
  "leafIndex": 1542,
  "newRoot": "0x5678efgh...",
  "timestamp": "2024-10-28T14:40:15Z"
}
```

---

## Notes Storage

### `GET /notes/:walletAddress`

Retrieve encrypted notes for a wallet.

**URL Parameters:**

- `:walletAddress` - Solana wallet address (base58)

**Response:**

```json
{
  "walletAddress": "...",
  "notes": [
    {
      "commitment": "0xf7a3b2c1d4e5...",
      "blinding": "0x123456...",
      "amount": "1.0",
      "recipient": "0xabc123...",
      "timestamp": 1698000000,
      "txSignature": "...",
      "spent": false
    }
  ],
  "count": 5
}
```

---

### `POST /notes/upload`

Save encrypted notes for a wallet.

**Request:**

```json
{
  "walletAddress": "...",
  "encryptedData": "..."
}
```

**Response:**

```json
{
  "success": true,
  "walletAddress": "...",
  "savedAt": "2024-10-28T14:45:30Z"
}
```

---

## Health & Status

### `GET /health`

Simple health check.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-10-28T14:50:00Z"
}
```

---

### `GET /version`

Get API version information.

**Response:**

```json
{
  "version": "1.0.0",
  "build": "production",
  "solana": {
    "network": "testnet",
    "rpc": "https://api.testnet.solana.com"
  },
  "circuits": {
    "shield": "v1.0",
    "transfer": "v1.0",
    "unshield": "v1.0"
  }
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "statusCode": 400,
  "message": "Invalid input",
  "error": "BadRequestException",
  "timestamp": "2024-10-28T15:00:00Z"
}
```

### Common Error Codes

| Status  | Error                       | Cause                                             |
| ------- | --------------------------- | ------------------------------------------------- |
| **400** | BadRequestException         | Invalid input parameters                          |
| **404** | NotFoundException           | Resource not found (e.g., commitment not in tree) |
| **409** | ConflictException           | Duplicate entry (e.g., commitment already added)  |
| **500** | InternalServerException     | Server error (retry after a few seconds)          |
| **503** | ServiceUnavailableException | Indexer not ready (syncing)                       |

### Retry Logic

For production reliability, implement exponential backoff:

```typescript
async function fetchWithRetry(url: string, options?: any, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) return response;

      // Retry on server errors (5xx)
      if (response.status >= 500) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.log(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Don't retry on client errors (4xx)
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// Usage
const proof = await fetchWithRetry(`${API_URL}/indexer/shield/proof`, {
  method: 'POST',
  body: JSON.stringify({ commitment: '0x...' }),
});
```

---

## Rate Limiting

Current limits (subject to change):

- **Proof generation**: 1 request per 30 seconds per IP
- **Merkle proofs**: 100 requests per minute per IP
- **Indexer status**: 1000 requests per minute per IP

Exceeding limits returns:

```json
{
  "statusCode": 429,
  "message": "Too many requests",
  "retryAfter": 60
}
```

---

## CORS & Authentication

### CORS Headers

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

### Authentication

Currently no authentication required (public API).

Future: API keys for production deployments.

---

## Code Examples

### TypeScript Client

```typescript
import fetch from 'isomorphic-fetch';

class NoirWireClient {
  constructor(private baseUrl: string) {}

  async getMerkleProof(circuit: string, commitment: string) {
    const response = await fetch(`${this.baseUrl}/indexer/${circuit}/proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitment }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  async generateProof(circuit: string, input: Record<string, any>) {
    const response = await fetch(`${this.baseUrl}/proof/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ circuit, input }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }
}

// Usage
const client = new NoirWireClient('https://api.noirwire.com');
const proof = await client.getMerkleProof('shield', '0x...');
```

### cURL

```bash
# Get Merkle proof
curl -X POST https://api.noirwire.com/indexer/shield/proof \
  -H "Content-Type: application/json" \
  -d '{
    "commitment": "0xf7a3b2c1d4e5..."
  }'

# Generate transfer proof (30 seconds)
curl -X POST https://api.noirwire.com/proof/generate \
  -H "Content-Type: application/json" \
  -d '{
    "circuit": "transfer",
    "input": { ... }
  }'

# Get indexer status
curl https://api.noirwire.com/indexer/status
```

---

## Webhooks (Future)

Planned for Phase 2:

```
POST /webhooks/subscribe
{
  "events": ["transfer.submitted", "unshield.completed"],
  "url": "https://your-app.com/webhook"
}
```

---

_Last updated: October 28, 2025_
