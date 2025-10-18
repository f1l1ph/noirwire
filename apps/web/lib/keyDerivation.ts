/**
 * HD Wallet Key Derivation for NoirWire
 *
 * Implements BIP32-style hierarchical deterministic key derivation
 *
 * Key hierarchy:
 * - Master seed (from wallet mnemonic/private key)
 * - Spending keys (Baby Jubjub, for creating/spending notes)
 * - Viewing keys (Ed25519, for scanning notes)
 *
 * @module keyDerivation
 */

import { poseidonHash } from './crypto';

// BIP32 path constants (following SLIP-44)
const PURPOSE = 44; // BIP44 purpose
const COIN_TYPE = 501; // Solana coin type
const ACCOUNT = 0; // Default account
const CHANGE = 0; // External chain

/**
 * Derive master seed from wallet private key or mnemonic
 * In production, this should use BIP39 mnemonic -> seed conversion
 *
 * @param walletPrivateKey - Solana wallet private key (32 bytes) or mnemonic phrase
 * @returns Master seed (64 bytes)
 */
export async function deriveMasterSeed(
  walletPrivateKey: Uint8Array | string,
): Promise<Uint8Array> {
  const encoder = new TextEncoder();

  let seedMaterial: Uint8Array;
  if (typeof walletPrivateKey === 'string') {
    // Mnemonic phrase
    seedMaterial = encoder.encode(walletPrivateKey);
  } else {
    // Private key bytes
    seedMaterial = walletPrivateKey;
  }

  // HMAC-SHA512 with "NoirWire seed" as key
  const keyBytes = encoder.encode('NoirWire seed');
  const keyBuffer = keyBytes.buffer.slice(
    keyBytes.byteOffset,
    keyBytes.byteOffset + keyBytes.byteLength,
  ) as ArrayBuffer;

  const key = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );

  const seedMaterialBuffer = seedMaterial.buffer.slice(
    seedMaterial.byteOffset,
    seedMaterial.byteOffset + seedMaterial.byteLength,
  ) as ArrayBuffer;

  const signature = await crypto.subtle.sign('HMAC', key, seedMaterialBuffer);
  return new Uint8Array(signature);
}

/**
 * Derive a child key using HMAC-based key derivation (BIP32-style)
 *
 * @param parentKey - Parent key (32 bytes)
 * @param chainCode - Chain code (32 bytes)
 * @param index - Derivation index
 * @returns Child key and chain code
 */
export async function deriveChildKey(
  parentKey: Uint8Array<ArrayBuffer>,
  chainCode: Uint8Array<ArrayBuffer>,
  index: number,
): Promise<{
  key: Uint8Array<ArrayBuffer>;
  chainCode: Uint8Array<ArrayBuffer>;
}> {
  // Prepare data: 0x00 + parentKey + index (big-endian)
  const data = new Uint8Array(1 + 32 + 4);
  data[0] = 0x00; // Hardened derivation
  data.set(parentKey, 1);
  new DataView(data.buffer).setUint32(33, index | 0x80000000, false); // Hardened index

  // HMAC-SHA512(chainCode, data)
  const key = await crypto.subtle.importKey(
    'raw',
    chainCode.buffer.slice(
      chainCode.byteOffset,
      chainCode.byteOffset + chainCode.byteLength,
    ) as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );

  const dataBuffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;

  const hmac = await crypto.subtle.sign('HMAC', key, dataBuffer);
  const hmacBytes = new Uint8Array(hmac);

  // Split into left (new key) and right (new chain code)
  const childKey = new Uint8Array(
    hmacBytes.slice(0, 32).buffer,
  ) as Uint8Array<ArrayBuffer>;
  const childChainCode = new Uint8Array(
    hmacBytes.slice(32, 64).buffer,
  ) as Uint8Array<ArrayBuffer>;

  return { key: childKey, chainCode: childChainCode };
}

/**
 * Derive spending key for NoirWire (Baby Jubjub compatible)
 * Path: m/44'/501'/0'/0/{index}
 *
 * @param masterSeed - Master seed from deriveMasterSeed
 * @param index - Address index (default: 0)
 * @returns Spending secret key (scalar for Baby Jubjub)
 */
export async function deriveSpendingKey(
  masterSeed: Uint8Array,
  index: number = 0,
): Promise<bigint> {
  // Split master seed into key and chain code
  let key = masterSeed.slice(0, 32);
  let chainCode = masterSeed.slice(32, 64);

  // Derive along BIP44 path: m/44'/501'/0'/0/{index}
  const path = [PURPOSE, COIN_TYPE, ACCOUNT, CHANGE, index];

  for (const pathIndex of path) {
    const child = await deriveChildKey(key, chainCode, pathIndex);
    key = child.key;
    chainCode = child.chainCode;
  }

  // Convert to bigint for Baby Jubjub scalar
  let secretKey = 0n;
  for (let i = 0; i < 32; i++) {
    const byte = key[i];
    if (byte !== undefined) {
      secretKey = (secretKey << 8n) | BigInt(byte);
    }
  }

  // Mod by Baby Jubjub curve order (2^251 + 27742317777372353535851937790883648493)
  // For simplicity, we use the full 256-bit value (field checks in circuit)
  return secretKey;
}

/**
 * Derive viewing key for note scanning (Ed25519 compatible)
 * Path: m/44'/501'/0'/1/{index}
 *
 * @param masterSeed - Master seed from deriveMasterSeed
 * @param index - Address index (default: 0)
 * @returns Viewing secret key
 */
export async function deriveViewingKey(
  masterSeed: Uint8Array,
  index: number = 0,
): Promise<Uint8Array> {
  // Split master seed into key and chain code
  let key = masterSeed.slice(0, 32);
  let chainCode = masterSeed.slice(32, 64);

  // Derive along path: m/44'/501'/0'/1/{index} (change=1 for viewing keys)
  const path = [PURPOSE, COIN_TYPE, ACCOUNT, 1, index];

  for (const pathIndex of path) {
    const child = await deriveChildKey(key, chainCode, pathIndex);
    key = child.key;
    chainCode = child.chainCode;
  }

  return key;
}

/**
 * Compute recipient public key from spending secret key
 * In a full implementation, this would use Baby Jubjub point multiplication
 * For now, we hash the secret key (compatible with circuit)
 *
 * @param secretKey - Spending secret key
 * @returns Recipient public key (Baby Jubjub point)
 */
export async function computeRecipientPublicKey(
  secretKey: bigint,
): Promise<bigint> {
  // In production: publicKey = secretKey * G (Baby Jubjub generator point)
  // For compatibility with existing circuit, we use Poseidon hash
  return poseidonHash([secretKey, 1n]); // Domain separation: 1 for public key
}

/**
 * Derive complete wallet keys from Solana wallet
 *
 * @param walletPrivateKey - Solana wallet private key
 * @param addressIndex - Address index for HD wallet (default: 0)
 * @returns Complete key set
 */
export async function deriveWalletKeys(
  walletPrivateKey: Uint8Array | string,
  addressIndex: number = 0,
): Promise<{
  masterSeed: Uint8Array;
  spendingKey: bigint;
  recipientPk: bigint;
  viewingKey: Uint8Array;
}> {
  const masterSeed = await deriveMasterSeed(walletPrivateKey);
  const spendingKey = await deriveSpendingKey(masterSeed, addressIndex);
  const recipientPk = await computeRecipientPublicKey(spendingKey);
  const viewingKey = await deriveViewingKey(masterSeed, addressIndex);

  return {
    masterSeed,
    spendingKey,
    recipientPk,
    viewingKey,
  };
}
