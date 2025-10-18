# NoirWire API

NestJS API server for zero-knowledge proof generation and validation.

## Overview

This API provides endpoints for generating zero-knowledge proofs using snarkjs library directly. It handles shield, transfer, and unshield operations without requiring external processes or shell commands.

## Tech Stack

- **Framework**: NestJS (TypeScript)
- **Proof Generation**: snarkjs library
- **Circuits**: Pre-compiled Circom artifacts (WASM + zkey)
- **Port**: 3000

## Architecture

```
Client Request → API Endpoint → ProofService
                                    ↓
                            snarkjs.groth16.fullProve()
                                    ↓
                            Circuit Artifacts (WASM, zkey)
                                    ↓
                            Proof + Public Signals
                                    ↓
                            Serialized Response
```

## Endpoints

### POST /proof/generate

Generate a zero-knowledge proof for shield, transfer, or unshield operations.

**Request Body:**

```json
{
  "circuit": "shield | transfer | unshield",
  "input": {
    // Circuit-specific inputs
    "secretKey": "0x...",
    "amount": "1000000",
    ...
  }
}
```

**Response:**

```json
{
  "proofBase64": "base64-encoded-proof-bytes",
  "publicSignals": ["signal1", "signal2", ...]
}
```

### GET /

Health check endpoint.

**Response:**

```json
{
  "message": "NoirWire API is running"
}
```

## Installation

```bash
# From apps/api directory
npm install

# Install snarkjs
npm install snarkjs
```

## Configuration

The API uses path resolution to locate circuit artifacts in the monorepo:

```typescript
// From apps/api/src/proof, go up to workspace root
private projectRoot = path.resolve(__dirname, '../../../..');

// Circuit artifacts location:
// external/noirwire-contracts/zk-circuits/build/{circuit}/
```

No environment variables required for local development.

## Running

```bash
# Development (watch mode)
npm run dev

# Production
npm run build
npm run start:prod
```

The API will start on http://localhost:3000

## Proof Generation

### How It Works

1. Client sends circuit type and inputs
2. API validates circuit artifacts exist (WASM, zkey)
3. snarkjs library generates proof directly:
   ```typescript
   const { proof, publicSignals } = await snarkjs.groth16.fullProve(
     input,
     wasmPath,
     zkeyPath,
   );
   ```
4. Proof is serialized to base64-encoded bytes (8 x 32 bytes):
   - 2 x 32 bytes for pi_a (G1 point)
   - 4 x 32 bytes for pi_b (G2 point)
   - 2 x 32 bytes for pi_c (G1 point)

### Circuit Artifacts

Required files for each circuit:

```
external/noirwire-contracts/zk-circuits/build/{circuit}/
├── {circuit}_js/
│   └── {circuit}.wasm        # Witness generator
└── {circuit}_final.zkey      # Proving key
```

To build circuits:

```bash
cd external/noirwire-contracts/zk-circuits
make all
```

## Project Structure

```
apps/api/
├── src/
│   ├── main.ts                 # Application bootstrap
│   ├── app.module.ts           # Root module
│   ├── app.controller.ts       # Health check
│   ├── app.service.ts
│   └── proof/
│       ├── proof.module.ts     # Proof generation module
│       ├── proof.controller.ts # /proof/generate endpoint
│       └── proof.service.ts    # snarkjs integration
├── test/                       # E2E tests
├── package.json
└── tsconfig.json
```

## Development

### Testing Proof Generation

```bash
# Using curl
curl -X POST http://localhost:3000/proof/generate \
  -H "Content-Type: application/json" \
  -d '{
    "circuit": "shield",
    "input": {
      "secretKey": "12345...",
      "amount": "1000000",
      "blinding": "67890..."
    }
  }'
```

### Debugging

Enable detailed logging:

```typescript
// In proof.service.ts
console.log('[proof] Generating proof with snarkjs library...');
console.log('[proof] Proof generated successfully');
```

### Memory Management

For large circuits, increase Node.js heap size:

```bash
NODE_OPTIONS=--max-old-space-size=8192 npm run dev
```

## Error Handling

Common errors and solutions:

### "Circuit artifacts missing"

```
Error: Circuit artifacts missing for shield. Run the circuit build...
```

**Solution:** Build circuits first:

```bash
cd external/noirwire-contracts/zk-circuits
make all
```

### "Proof generation failed"

Check:

1. Input format matches circuit constraints
2. WASM and zkey files exist
3. Sufficient memory available
4. Circuit was compiled successfully

## Performance

Approximate proof generation times:

- **Shield**: 2-4 seconds
- **Transfer**: 3-5 seconds
- **Unshield**: 2-4 seconds

Times vary based on:

- CPU performance
- Available memory
- Circuit complexity
- Node.js version

## Security Considerations

⚠️ **Development Build Only**

For production deployment:

- [ ] Add authentication/authorization
- [ ] Implement rate limiting
- [ ] Add request validation
- [ ] Enable HTTPS
- [ ] Add monitoring/logging
- [ ] Implement queue system for concurrent proofs
- [ ] Add input sanitization
- [ ] Set up error tracking (Sentry, etc.)

## CORS Configuration

Current CORS setup (development):

```typescript
app.enableCors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true,
});
```

Update for production deployment.

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Dependencies

Key dependencies:

- `@nestjs/common` - NestJS core
- `@nestjs/core` - NestJS core
- `@nestjs/platform-express` - HTTP adapter
- `snarkjs` - Zero-knowledge proof generation
- `reflect-metadata` - Decorator metadata
- `rxjs` - Reactive extensions

## Troubleshooting

### Port 3000 already in use

```bash
lsof -ti:3000 | xargs kill -9
```

### TypeScript errors after installing snarkjs

snarkjs doesn't have TypeScript definitions, but the import works:

```typescript
import * as snarkjs from 'snarkjs';
```

### Module resolution issues

Ensure `tsconfig.json` has proper path configuration:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

## Contributing

When adding new endpoints:

1. Create a new module in `src/`
2. Add controller and service
3. Import module in `app.module.ts`
4. Update this README

## License

ISC
