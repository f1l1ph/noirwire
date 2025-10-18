// Privacy pool utilities for secret keys, nullifiers, and merkle proofs

import { poseidonHash } from './crypto';
import {
  getMerkleProofFromIndexer,
  logIndexerDiagnostics,
  type MerkleProof,
} from './indexerClient';

/**
 * Derive a secret key from wallet seed
 * In production, this would use proper key derivation (BIP32/44)
 * For demo, we hash the wallet address
 */
export async function deriveSecretKey(walletAddress: string): Promise<bigint> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`secret_${walletAddress}`);
  const arrayBufferForDigest = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  );
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    arrayBufferForDigest as ArrayBuffer,
  );
  const hashBytes = new Uint8Array(hashBuffer);

  let sk = 0n;
  for (let i = 0; i < Math.min(hashBytes.length, 31); i++) {
    const byte = hashBytes[i];
    if (byte !== undefined) {
      sk = (sk << 8n) | BigInt(byte);
    }
  }

  return sk;
}

/**
 * Generate a unique note ID for nullifier generation
 * In production, this would be deterministically derived from note commitment
 */
export function generateNoteId(commitment: string): bigint {
  // Use the commitment hash as the note ID
  const commitmentBigInt = BigInt('0x' + commitment);
  return commitmentBigInt;
}

/**
 * Compute nullifier from secret key and note ID
 * nullifier = Poseidon(secret_sk, note_id)
 */
export async function computeNullifier(
  secretKey: bigint,
  noteId: bigint,
): Promise<bigint> {
  return poseidonHash([secretKey, noteId]);
}

/**
 * Get merkle proof for a commitment
 *
 * Queries the indexer service for Merkle proofs of commitments
 * The indexer maintains Merkle trees for shield/transfer/unshield circuits
 *
 * @param commitment - The commitment hash to get proof for
 * @param circuit - Circuit type: 'shield' | 'transfer' | 'unshield' (default: 'unshield')
 * @returns Merkle proof with root, path, and pathPositions
 */
export async function getMerkleProof(
  commitment: string,
  circuit: 'shield' | 'transfer' | 'unshield' = 'unshield',
): Promise<{
  root: Buffer;
  rootHex: string;
  path: string[];
  pathPositions: string[];
}> {
  console.log(
    `[getMerkleProof] Querying indexer for ${circuit}: ${commitment.slice(0, 16)}...`,
  );

  // Query the backend indexer service
  let proof: MerkleProof;
  try {
    proof = await getMerkleProofFromIndexer(circuit, commitment);
  } catch (error) {
    console.error(
      `[getMerkleProof] Failed to fetch proof for ${circuit}:`,
      error,
    );
    await logIndexerDiagnostics(circuit, commitment);
    throw error;
  }

  // Convert root to Buffer for circuit compatibility
  const rootBuffer = Buffer.from(proof.root, 'hex');
  const normalizedPath = proof.path.map((value) => {
    const clean = value.startsWith('0x') ? value : `0x${value}`;
    return BigInt(clean).toString(10);
  });

  console.log(
    `[getMerkleProof] Got proof: root=${proof.root.slice(0, 16)}..., path_length=${proof.path.length}`,
  );

  return {
    root: rootBuffer,
    rootHex: proof.root,
    path: normalizedPath,
    pathPositions: proof.pathPositions,
  };
}

/**
 * Split a Solana address (32 bytes) into two 128-bit limbs for circuit input
 */
export function splitAddressToLimbs(address: Buffer): {
  lo: bigint;
  hi: bigint;
} {
  const loBytes = address.slice(0, 16);
  const hiBytes = address.slice(16, 32);

  let lo = 0n;
  let hi = 0n;

  for (let i = 0; i < 16; i++) {
    const loByte = loBytes[i];
    const hiByte = hiBytes[i];
    if (loByte !== undefined) {
      lo |= BigInt(loByte) << BigInt(i * 8);
    }
    if (hiByte !== undefined) {
      hi |= BigInt(hiByte) << BigInt(i * 8);
    }
  }

  return { lo, hi };
}
