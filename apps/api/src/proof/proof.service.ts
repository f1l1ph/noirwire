import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as snarkjs from 'snarkjs';

@Injectable()
export class ProofService {
  private readonly logger = new Logger(ProofService.name);
  // From apps/api/src/proof, go up to workspace root
  private projectRoot = path.resolve(__dirname, '../../../..');

  async generateProof(
    circuit: 'shield' | 'transfer' | 'unshield',
    input: Record<string, any>,
  ) {
    const circuitDir = path.join(
      this.projectRoot,
      'external',
      'noirwire-contracts',
      'zk-circuits',
      'build',
      circuit,
    );

    // Ensure build artifacts exist
    const wasmPath = path.join(circuitDir, `${circuit}_js`, `${circuit}.wasm`);
    const zkeyPath = path.join(circuitDir, `${circuit}_final.zkey`);

    if (!(await this.exists(wasmPath)) || !(await this.exists(zkeyPath))) {
      throw new Error(
        `Circuit artifacts missing for ${circuit}. Run the circuit build in external/noirwire-contracts/zk-circuits and ensure ${circuit}_js/${circuit}.wasm and ${circuit}_final.zkey exist.`,
      );
    }

    try {
      // Use snarkjs library directly to generate proof
      this.logger.log(`[proof] Generating ${circuit} proof with snarkjs...`);
      this.logger.log(
        `[proof] Input: ${JSON.stringify(input).slice(0, 200)}...`,
      );
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        wasmPath,
        zkeyPath,
      );

      this.logger.log(`[proof] Proof generated successfully for ${circuit}`);

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

      return { proofBase64, publicSignals };
    } catch (err: any) {
      this.logger.error(`Proof generation failed for ${circuit}`);
      this.logger.error(`Error message: ${err?.message || String(err)}`);
      this.logger.error(`Error type: ${err?.name || 'unknown'}`);
      if (err?.stack) {
        this.logger.error(`Stack trace: ${err.stack.slice(0, 500)}`);
      }
      throw new Error(
        `Proof generation failed: ${err?.message || String(err)}`,
      );
    }
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
