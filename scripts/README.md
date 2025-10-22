# Scripts

Utility scripts for development and testing.

## Available Scripts

### Check Indexer Status

Diagnostic tool to verify the indexer is working correctly.

```bash
node scripts/check-indexer.mjs
```

**What it does:**

- Checks if the API is running
- Displays current indexer status
- Shows shield tree commitment count
- Provides next steps based on current state

### Test Merkle Root Publishing

Tests the complete merkle root publishing flow.

```bash
node scripts/test-merkle-root-publishing.mjs
```

**What it tests:**

- Adds a test commitment to the indexer
- Verifies root is published on-chain
- Generates and validates merkle proof
- Confirms root consistency

## Requirements

- Node.js 20+
- API running on `http://localhost:3000`
- (Optional) Database for persistent testing

## Tips

- Run `yarn dev:api` in another terminal to start the API
- Run scripts from the root directory
- Scripts output colored terminal messages for easy reading
- All scripts are exit with code 1 on failure for CI/CD integration
