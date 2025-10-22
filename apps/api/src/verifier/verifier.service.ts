/**
 * Production-ready ZK Proof Verifier Service
 * Handles verification of Groth16 proofs for shield/transfer/unshield operations
 */

import { Injectable, Logger } from '@nestjs/common';
import * as snarkjs from 'snarkjs';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface VerificationResult {
  valid: boolean;
  error?: string;
  timing?: {
    verificationMs: number;
  };
}

export interface ProofData {
  proof: string; // base64 encoded
  publicSignals: string[];
}

@Injectable()
export class VerifierService {
  private readonly logger = new Logger(VerifierService.name);
  // Point to the proofs directory bundled with the API
  private proofsRoot = path.resolve(__dirname, '../../proofs');

  // Cache verification keys in memory for performance
  private vkCache: Map<string, any> = new Map();

  /**
   * Verify a Groth16 proof against the circuit's verification key
   */
  async verifyProof(
    circuit: 'shield' | 'transfer' | 'unshield',
    proofData: ProofData,
  ): Promise<VerificationResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`Verifying ${circuit} proof...`);

      // Get verification key (cached)
      const vKey = await this.getVerificationKey(circuit);

      // Decode proof from base64
      const proof = this.decodeProof(proofData.proof);

      // Validate public signals format
      this.validatePublicSignals(circuit, proofData.publicSignals);

      // Verify with snarkjs
      const valid = await snarkjs.groth16.verify(
        vKey,
        proofData.publicSignals,
        proof,
      );

      const verificationMs = Date.now() - startTime;

      if (valid) {
        this.logger.log(
          `✅ ${circuit} proof verified successfully (${verificationMs}ms)`,
        );
      } else {
        this.logger.warn(`❌ ${circuit} proof verification failed`);
      }

      return {
        valid,
        timing: { verificationMs },
      };
    } catch (error: any) {
      const verificationMs = Date.now() - startTime;
      this.logger.error(`Verification error for ${circuit}:`, error.message);

      return {
        valid: false,
        error: error.message || 'Unknown verification error',
        timing: { verificationMs },
      };
    }
  }

  /**
   * Get verification key for a circuit (with caching)
   */
  private async getVerificationKey(
    circuit: 'shield' | 'transfer' | 'unshield',
  ): Promise<any> {
    // Check cache
    if (this.vkCache.has(circuit)) {
      return this.vkCache.get(circuit);
    }

    // Load from proofs directory
    const vkPath = path.join(this.proofsRoot, circuit, 'vk.json');

    try {
      const vkJson = await fs.readFile(vkPath, 'utf-8');
      const vKey = JSON.parse(vkJson);

      // Cache for future use
      this.vkCache.set(circuit, vKey);

      this.logger.log(`Loaded verification key for ${circuit} circuit`);
      return vKey;
    } catch (error: any) {
      throw new Error(
        `Failed to load verification key for ${circuit}: ${error.message}`,
      );
    }
  }

  /**
   * Decode base64 proof to snarkjs format
   */
  private decodeProof(proofBase64: string): any {
    try {
      const proofBuffer = Buffer.from(proofBase64, 'base64');

      // Expected: 8 * 32 = 256 bytes (A[2] + B[4] + C[2])
      if (proofBuffer.length !== 256) {
        throw new Error(
          `Invalid proof size: expected 256 bytes, got ${proofBuffer.length}`,
        );
      }

      // Parse proof components (little-endian 32-byte field elements)
      const fromLE32 = (offset: number): string => {
        let value = 0n;
        for (let i = 31; i >= 0; i--) {
          value = (value << 8n) | BigInt(proofBuffer[offset + i]);
        }
        return value.toString();
      };

      // snarkjs expects: { pi_a: [a0, a1, a2], pi_b: [[b00, b01], [b10, b11], [1, 0]], pi_c: [c0, c1, c2] }
      const proof = {
        pi_a: [fromLE32(0), fromLE32(32), '1'], // A point (projective, z=1)
        pi_b: [
          [fromLE32(64), fromLE32(96)], // B point x
          [fromLE32(128), fromLE32(160)], // B point y
          ['1', '0'], // B point z (projective)
        ],
        pi_c: [fromLE32(192), fromLE32(224), '1'], // C point (projective, z=1)
        protocol: 'groth16',
        curve: 'bn128',
      };

      return proof;
    } catch (error: any) {
      throw new Error(`Failed to decode proof: ${error.message}`);
    }
  }

  /**
   * Validate public signals format based on circuit type
   */
  private validatePublicSignals(
    circuit: 'shield' | 'transfer' | 'unshield',
    publicSignals: string[],
  ): void {
    const expectedCounts: Record<string, number> = {
      shield: 1, // commitment
      transfer: 4, // root, nullifier, new_commitment, fee
      unshield: 6, // root, nullifier, recipient_lo, recipient_hi, amount, fee
    };

    const expected = expectedCounts[circuit];
    if (publicSignals.length !== expected) {
      throw new Error(
        `Invalid public signal count for ${circuit}: expected ${expected}, got ${publicSignals.length}`,
      );
    }

    // Validate each signal is a valid field element
    for (const signal of publicSignals) {
      try {
        const value = BigInt(signal);
        // BN254 field modulus (approximate)
        const fieldModulus =
          21888242871839275222246405745257275088548364400416034343698204186575808495617n;
        if (value < 0n || value >= fieldModulus) {
          throw new Error('Signal out of field range');
        }
      } catch {
        throw new Error(`Invalid public signal format: ${signal}`);
      }
    }
  }

  /**
   * Clear verification key cache (useful for testing)
   */
  clearCache(): void {
    this.vkCache.clear();
    this.logger.log('Verification key cache cleared');
  }
}
