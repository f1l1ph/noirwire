/**
 * Zero-Knowledge Proof Generation Service
 * Professional async API communication with Zod validation
 */

import { post } from './httpClient';
import { PROOF_ENDPOINT } from './constants';
import {
  ProofResponseSchema,
  type ProofResponse,
  type ShieldInput,
  type TransferInput,
  type UnshieldInput,
} from '@noirwire/types';

type ProofInput = ShieldInput | TransferInput | UnshieldInput;

/**
 * Generate zero-knowledge proof via API with validation
 */
export async function generateProof(
  circuit: 'shield' | 'transfer' | 'unshield',
  input: ProofInput,
): Promise<ProofResponse> {
  const response = await post<unknown>(PROOF_ENDPOINT, { circuit, input });
  return ProofResponseSchema.parse(response);
}

/**
 * Decode base64 proof to bytes (browser and Node.js compatible)
 */
export function decodeProof(proofBase64: string): Uint8Array {
  if (typeof window !== 'undefined' && typeof atob === 'function') {
    // Browser
    const binaryString = atob(proofBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } else {
    // Node.js
    return new Uint8Array(Buffer.from(proofBase64, 'base64'));
  }
}
