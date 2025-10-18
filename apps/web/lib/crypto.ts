// @ts-expect-error - circomlibjs doesn't have types
import { buildPoseidon } from 'circomlibjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let poseidonInstance: any = null;

async function getPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }
  return poseidonInstance;
}

/**
 * Convert a field element to a 32-byte buffer in little-endian format
 */
export function fieldToBuffer(field: string | number | bigint): Uint8Array {
  const bn = BigInt(field);
  const buf = new Uint8Array(32);
  let value = bn;
  for (let i = 0; i < 32; i++) {
    buf[i] = Number(value & 0xffn);
    value = value >> 8n;
  }
  return buf;
}

/**
 * Convert a buffer to a field element (little-endian)
 */
export function bufferToField(buf: Uint8Array): bigint {
  let value = 0n;
  for (let i = 31; i >= 0; i--) {
    value = (value << 8n) | BigInt(buf[i] || 0);
  }
  return value;
}

/**
 * Compute Poseidon hash of inputs
 */
export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
  const poseidon = await getPoseidon();
  const hash = poseidon(inputs);
  return poseidon.F.toObject(hash);
}

/**
 * Generate a random field element
 */
export function randomField(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // Ensure we're within the BN254 scalar field
  const BN254_MODULUS = BigInt(
    '21888242871839275222246405745257275088548364400416034343698204186575808495617',
  );
  return bufferToField(bytes) % BN254_MODULUS;
}

/**
 * Compute commitment: Poseidon(recipient_pk, amount, blinding)
 */
export async function computeCommitment(
  recipientPk: bigint,
  amount: bigint,
  blinding: bigint,
): Promise<bigint> {
  return await poseidonHash([recipientPk, amount, blinding]);
}

/**
 * Parse public inputs from proof response
 */
export function parsePublicInputs(publicInputs: string[]): number[][] {
  return publicInputs.map((input) => {
    const buf = fieldToBuffer(input);
    return Array.from(buf);
  });
}

/**
 * Serialize proof bytes from JSON
 */
export function serializeProof(proofJson: {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
}): Uint8Array {
  // Serialize proof as: A (64) + B (128) + C (64) = 256 bytes
  // All field elements in LITTLE-ENDIAN
  const parts: Uint8Array[] = [];

  // A (G1)
  parts.push(fieldToBuffer(proofJson.pi_a[0]!));
  parts.push(fieldToBuffer(proofJson.pi_a[1]!));

  // B (G2)
  parts.push(fieldToBuffer(proofJson.pi_b[0]![0]!));
  parts.push(fieldToBuffer(proofJson.pi_b[0]![1]!));
  parts.push(fieldToBuffer(proofJson.pi_b[1]![0]!));
  parts.push(fieldToBuffer(proofJson.pi_b[1]![1]!));

  // C (G1)
  parts.push(fieldToBuffer(proofJson.pi_c[0]!));
  parts.push(fieldToBuffer(proofJson.pi_c[1]!));

  // Concatenate all parts
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}
