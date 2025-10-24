import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as snarkjs from 'snarkjs';
import { existsSync } from 'fs';
import {
  WasmNotFoundException,
  ZkeyNotFoundException,
  ProofGenerationFailedException,
  MissingProofFieldException,
} from '../common/exceptions';

@Injectable()
export class ProofService {
  private readonly logger = new Logger(ProofService.name);
  private proofsRoot: string;

  constructor() {
    // Find proofs directory - handles both dev and prod environments
    // Dev: __dirname = dist/apps/api/src/proof, proofs at dist/apps/api/proofs (../.. from proof dir)
    // Docker/Prod: __dirname = /app/apps/api/dist/apps/api/src/proof, proofs at /app/apps/api/dist/apps/api/proofs
    const possiblePaths = [
      path.resolve(__dirname, '../../proofs'), // From proof/proof.service.js to dist/apps/api/proofs ✓
      path.resolve(__dirname, '../proofs'), // Legacy fallback
      path.resolve(__dirname, '../../../proofs'), // Another legacy fallback
      path.resolve(process.cwd(), 'apps/api/proofs'), // cwd-relative
      path.resolve(process.cwd(), 'proofs'), // root proofs
    ];

    // Try each path in order, use the first one that actually exists
    this.proofsRoot = possiblePaths[0]; // Default fallback

    for (const p of possiblePaths) {
      try {
        if (existsSync(p)) {
          this.proofsRoot = p;
          this.logger.log(`[ProofService] Found proofs at: ${p}`);
          break;
        }
      } catch {
        // Continue to next path
      }
    }

    this.logger.log(`[ProofService] Using proofs from: ${this.proofsRoot}`);
  }

  async generateProof(
    circuit: 'shield' | 'transfer' | 'unshield',
    input: Record<string, any>,
  ) {
    const requestId = Math.random().toString(36).substr(2, 9);
    const circuitDir = path.join(this.proofsRoot, circuit);

    this.logger.log(`[${requestId}] Generating ${circuit} proof`);
    this.logger.debug(`[${requestId}] Circuit dir: ${circuitDir}`);

    // Ensure build artifacts exist
    const wasmPath = path.join(circuitDir, `${circuit}.wasm`);
    const zkeyPath = path.join(circuitDir, `${circuit}_final.zkey`);

    this.logger.debug(`[${requestId}] Looking for WASM: ${wasmPath}`);
    this.logger.debug(`[${requestId}] Looking for ZKEY: ${zkeyPath}`);

    if (!(await this.exists(wasmPath))) {
      const msg = `WASM artifact missing for ${circuit}: ${wasmPath}`;
      this.logger.error(`[${requestId}] ${msg}`);
      throw new WasmNotFoundException(circuit, wasmPath);
    }

    if (!(await this.exists(zkeyPath))) {
      const msg = `ZKEY artifact missing for ${circuit}: ${zkeyPath}`;
      this.logger.error(`[${requestId}] ${msg}`);
      throw new ZkeyNotFoundException(circuit, zkeyPath);
    }

    this.logger.log(`[${requestId}] ✓ Artifacts found`);

    try {
      // Log input keys but not full values (could be large)
      const inputKeys = Object.keys(input).sort();
      this.logger.log(`[${requestId}] Input keys: ${inputKeys.join(', ')}`);

      // Validate required fields for each circuit
      this.validateInput(circuit, input, requestId);

      // Transform input for unshield circuit
      let circuitInput = input;
      if (circuit === 'unshield') {
        circuitInput = this.transformUnshieldInput(input, requestId);
      }

      this.logger.log(`[${requestId}] Calling snarkjs.groth16.fullProve...`);
      const proofStartTime = Date.now();

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        circuitInput,
        wasmPath,
        zkeyPath,
      );

      const proofGenTime = Date.now() - proofStartTime;
      this.logger.log(`[${requestId}] ✓ Proof generated in ${proofGenTime}ms`);
      this.logger.debug(
        `[${requestId}] Public signals count: ${publicSignals.length}`,
      );

      // Serialize proof fields into 32-byte little-endian buffers
      const toLE32 = (value: string) => {
        // value is decimal string
        let v = BigInt(value);
        const buf = Buffer.alloc(32);
        for (let i = 0; i < 32; i++) {
          buf[i] = Number(v & 0xffn);
          v = v >> 8n;
        }
        return buf;
      };

      // snarkjs library returns proof object with pi_a, pi_b, pi_c
      const A = proof.pi_a; // [a0, a1, a2]
      const B = proof.pi_b; // [[b00,b01],[b10,b11],[1,0]]
      const C = proof.pi_c; // [c0, c1, c2]

      this.logger.debug(
        `[${requestId}] Serializing proof (A=${A[0].toString().slice(0, 10)}..., B length=${B.length}, C=${C[0].toString().slice(0, 10)}...)`,
      );

      const parts: Buffer[] = [];
      parts.push(toLE32(String(A[0])));
      parts.push(toLE32(String(A[1])));

      // B is G2 - two pairs
      parts.push(toLE32(String(B[0][0])));
      parts.push(toLE32(String(B[0][1])));
      parts.push(toLE32(String(B[1][0])));
      parts.push(toLE32(String(B[1][1])));

      parts.push(toLE32(String(C[0])));
      parts.push(toLE32(String(C[1])));

      const proofBuf = Buffer.concat(parts);
      const proofBase64 = proofBuf.toString('base64');

      this.logger.log(
        `[${requestId}] ✅ ${circuit} proof complete (256 bytes base64)`,
      );

      return { proofBase64, publicSignals };
    } catch (err: any) {
      this.logger.error(
        `[${requestId}] ❌ Proof generation failed for ${circuit}`,
      );
      this.logger.error(`[${requestId}] Error: ${err?.message || String(err)}`);
      this.logger.error(
        `[${requestId}] Type: ${err?.constructor?.name || 'unknown'}`,
      );

      if (err?.stack) {
        const stackLines = err.stack.split('\n').slice(0, 5);
        this.logger.debug(`[${requestId}] Stack: ${stackLines.join(' | ')}`);
      }

      // Provide more specific error messages
      if (err?.message?.includes('expected')) {
        throw new ProofGenerationFailedException(
          circuit,
          String(err?.message || 'Unknown error'),
          Object.keys(input),
        );
      }

      throw new ProofGenerationFailedException(
        circuit,
        String(err?.message || String(err)),
        Object.keys(input),
      );
    }
  }

  private validateInput(
    circuit: 'shield' | 'transfer' | 'unshield',
    input: Record<string, any>,
    requestId: string,
  ) {
    const requiredFields: Record<string, string[]> = {
      shield: ['recipient_pk', 'amount', 'blinding'],
      transfer: [
        'root',
        'nullifier',
        'recipient_pk',
        'fee',
        'blinding',
        'path_elements',
        'path_index',
      ],
      unshield: [
        'secret',
        'amount',
        'blinding',
        'path_elements',
        'path_index',
        'fee',
      ],
    };

    const required = requiredFields[circuit];
    const missing = required.filter((field) => !(field in input));

    if (missing.length > 0) {
      this.logger.warn(
        `[${requestId}] Missing required fields for ${circuit}: ${missing.join(', ')}`,
      );
      throw new MissingProofFieldException(circuit, missing[0], required);
    }

    this.logger.debug(
      `[${requestId}] ✓ All required fields present for ${circuit}`,
    );
  }

  /**
   * Transform unshield input from API format to circuit format
   *
   * API expects (from web app):
   *   - root, nullifier, secret, amount, blinding, path_elements, path_index, fee
   *
   * Circuit expects (Noir/Circom):
   *   - secret_sk, old_amount, old_blinding, old_recipient_pk, note_id
   *   - merkle_path, merkle_path_positions
   *   - recipient_lo, recipient_hi, public_amount, fee
   *
   * NOTE: root and nullifier are computed by the circuit, not inputs!
   */
  private transformUnshieldInput(
    input: Record<string, any>,
    requestId: string,
  ): Record<string, any> {
    this.logger.log(`[${requestId}] Transforming unshield input...`);

    // The web app needs to provide additional fields for the circuit
    // For now, we'll derive what we can and log what's missing
    const transformed: Record<string, any> = {
      // Map API field names to circuit field names
      secret_sk: input.secret,
      old_amount: input.amount, // Total amount in the note
      old_blinding: input.blinding,
      old_recipient_pk: input.old_recipient_pk || '0', // May need to be provided by web app
      note_id: input.note_id || '0', // May need to be provided by web app
      merkle_path: input.path_elements,
      merkle_path_positions: input.path_index,
      recipient_lo: input.recipient_lo,
      recipient_hi: input.recipient_hi,
      public_amount: input.amount, // Amount to withdraw
      fee: input.fee,
    };

    // Validate required fields after transformation
    const requiredCircuitFields = [
      'secret_sk',
      'old_amount',
      'old_blinding',
      'merkle_path',
      'merkle_path_positions',
      'recipient_lo',
      'recipient_hi',
      'public_amount',
      'fee',
    ];

    const missing = requiredCircuitFields.filter(
      (field) => !(field in transformed),
    );
    if (missing.length > 0) {
      const msg = `Missing required circuit fields for unshield: ${missing.join(', ')}`;
      this.logger.warn(`[${requestId}] ${msg}`);
      throw new Error(msg);
    }

    this.logger.debug(
      `[${requestId}] ✓ Transformed unshield input with fields: ${Object.keys(transformed).join(', ')}`,
    );
    return transformed;
  }

  private async exists(p: string) {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }
}
