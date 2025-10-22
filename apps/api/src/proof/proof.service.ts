import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as snarkjs from 'snarkjs';

@Injectable()
export class ProofService {
  private readonly logger = new Logger(ProofService.name);
  // Point to the proofs directory bundled with the API
  private proofsRoot = path.resolve(__dirname, '../../proofs');

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
      throw new Error(msg);
    }

    if (!(await this.exists(zkeyPath))) {
      const msg = `ZKEY artifact missing for ${circuit}: ${zkeyPath}`;
      this.logger.error(`[${requestId}] ${msg}`);
      throw new Error(msg);
    }

    this.logger.log(`[${requestId}] ✓ Artifacts found`);

    try {
      // Log input keys but not full values (could be large)
      const inputKeys = Object.keys(input).sort();
      this.logger.log(`[${requestId}] Input keys: ${inputKeys.join(', ')}`);

      // Validate required fields for each circuit
      this.validateInput(circuit, input, requestId);

      this.logger.log(`[${requestId}] Calling snarkjs.groth16.fullProve...`);
      const proofStartTime = Date.now();

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        wasmPath,
        zkeyPath,
      );

      const proofGenTime = Date.now() - proofStartTime;
      this.logger.log(
        `[${requestId}] ✓ Proof generated in ${proofGenTime}ms`,
      );
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

      this.logger.log(`[${requestId}] ✅ ${circuit} proof complete (256 bytes base64)`);

      return { proofBase64, publicSignals };
    } catch (err: any) {
      this.logger.error(
        `[${requestId}] ❌ Proof generation failed for ${circuit}`,
      );
      this.logger.error(`[${requestId}] Error: ${err?.message || String(err)}`);
      this.logger.error(`[${requestId}] Type: ${err?.constructor?.name || 'unknown'}`);

      if (err?.stack) {
        const stackLines = err.stack.split('\n').slice(0, 5);
        this.logger.debug(`[${requestId}] Stack: ${stackLines.join(' | ')}`);
      }

      // Provide more specific error messages
      if (err?.message?.includes('expected')) {
        throw new Error(
          `Proof input validation failed: ${err.message}. ` +
          `Expected fields: ${Object.keys(input).join(', ')}`,
        );
      }

      throw new Error(
        `Proof generation failed for ${circuit}: ${err?.message || String(err)}`,
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
      transfer: ['root', 'nullifier', 'recipient_pk', 'fee', 'blinding', 'path_elements', 'path_index'],
      unshield: ['root', 'nullifier', 'secret', 'amount', 'blinding', 'path_elements', 'path_index'],
    };

    const required = requiredFields[circuit];
    const missing = required.filter((field) => !(field in input));

    if (missing.length > 0) {
      const msg = `Missing required fields for ${circuit}: ${missing.join(', ')}. Got: ${Object.keys(input).join(', ')}`;
      this.logger.warn(`[${requestId}] ${msg}`);
      throw new Error(msg);
    }

    this.logger.debug(`[${requestId}] ✓ All required fields present for ${circuit}`);
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
