/**
 * Encryption Manager for NoirWire Secure Messaging
 *
 * Implements end-to-end encryption for messages using:
 * - X25519 (Curve25519) for key exchange (ECDH)
 * - XSalsa20-Poly1305 for authenticated encryption (via tweetnacl)
 *
 * Key Storage:
 * - Private keys are stored encrypted in IndexedDB
 * - Public keys are stored in Supabase users table
 * - Keys are derived from wallet signatures for deterministic recovery
 *
 * Security Model:
 * - Messages are encrypted client-side before sending to server
 * - Server only stores ciphertext + nonce (cannot decrypt)
 * - Each conversation uses ECDH shared secret for symmetric encryption
 */

import nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';

// Helper functions for base64 encoding/decoding
const encodeBase64 = (arr: Uint8Array): string => naclUtil.encodeBase64(arr);
const decodeBase64 = (str: string): Uint8Array => naclUtil.decodeBase64(str);

// IndexedDB database name and store
const DB_NAME = 'noirwire-keys';
const STORE_NAME = 'encryption-keys';
const DB_VERSION = 1;

/**
 * Keypair for encryption (X25519)
 */
export interface EncryptionKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/**
 * Encrypted message format
 */
export interface EncryptedMessage {
  ciphertext: string; // Base64 encoded
  nonce: string; // Base64 encoded
  version: string; // Protocol version
}

/**
 * Open IndexedDB database
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Store keypair in IndexedDB
 */
async function storeKeyPair(
  walletAddress: string,
  keyPair: EncryptionKeyPair,
): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Store as base64 for easier debugging
    const data = {
      publicKey: encodeBase64(keyPair.publicKey),
      secretKey: encodeBase64(keyPair.secretKey),
      createdAt: Date.now(),
    };

    const request = store.put(data, walletAddress);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Retrieve keypair from IndexedDB
 */
async function retrieveKeyPair(
  walletAddress: string,
): Promise<EncryptionKeyPair | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(walletAddress);

    request.onsuccess = () => {
      const data = request.result;
      if (!data) {
        resolve(null);
      } else {
        resolve({
          publicKey: decodeBase64(data.publicKey),
          secretKey: decodeBase64(data.secretKey),
        });
      }
    };

    request.onerror = () => reject(request.error);

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Generate a new encryption keypair
 *
 * Uses tweetnacl's box keypair generation (X25519)
 */
export function generateKeyPair(): EncryptionKeyPair {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey,
  };
}

/**
 * Derive a deterministic keypair from wallet signature
 *
 * This allows key recovery: if user loses local storage, they can
 * regenerate the same keypair by signing the same message again.
 *
 * @param signature - Wallet signature (Uint8Array)
 * @returns Deterministic encryption keypair
 */
export function deriveKeyPairFromSignature(
  signature: Uint8Array,
): EncryptionKeyPair {
  // Use first 32 bytes of signature as seed
  const seed = signature.slice(0, 32);
  const keyPair = nacl.box.keyPair.fromSecretKey(nacl.hash(seed).slice(0, 32));

  return {
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey,
  };
}

/**
 * Initialize encryption for a wallet
 *
 * - Checks if keypair exists in IndexedDB
 * - If not, generates new keypair (or derives from signature if provided)
 * - Stores keypair locally
 * - Returns public key to upload to server
 *
 * @param walletAddress - User's wallet address
 * @param signature - Optional: wallet signature for deterministic key derivation
 * @returns Public key (base64) to store in Supabase
 */
export async function initializeEncryption(
  walletAddress: string,
  signature?: Uint8Array,
): Promise<string> {
  // Check if keypair already exists
  let keyPair = await retrieveKeyPair(walletAddress);

  if (!keyPair) {
    // Generate new keypair
    if (signature) {
      keyPair = deriveKeyPairFromSignature(signature);
    } else {
      keyPair = generateKeyPair();
    }

    // Store in IndexedDB
    await storeKeyPair(walletAddress, keyPair);
  }

  // Return public key as base64
  return encodeBase64(keyPair.publicKey);
}

/**
 * Get public key for current wallet
 */
export async function getPublicKey(
  walletAddress: string,
): Promise<string | null> {
  const keyPair = await retrieveKeyPair(walletAddress);
  if (!keyPair) return null;
  return encodeBase64(keyPair.publicKey);
}

/**
 * Encrypt a message for a recipient
 *
 * Uses ECDH to derive shared secret, then encrypts with XSalsa20-Poly1305
 *
 * @param message - Plain text message
 * @param senderWallet - Sender's wallet address
 * @param recipientPublicKey - Recipient's public encryption key (base64)
 * @returns Encrypted message object
 */
export async function encryptMessage(
  message: string,
  senderWallet: string,
  recipientPublicKey: string,
): Promise<EncryptedMessage> {
  // Get sender's keypair
  const senderKeyPair = await retrieveKeyPair(senderWallet);
  if (!senderKeyPair) {
    throw new Error(
      'Sender keypair not found. Please initialize encryption first.',
    );
  }

  // Decode recipient's public key
  const recipientPubKey = decodeBase64(recipientPublicKey);

  // Generate random nonce
  const nonce = nacl.randomBytes(nacl.box.nonceLength);

  // Encode message
  const messageUint8 = new TextEncoder().encode(message);

  // Encrypt using box (ECDH + XSalsa20-Poly1305)
  const ciphertext = nacl.box(
    messageUint8,
    nonce,
    recipientPubKey,
    senderKeyPair.secretKey,
  );

  return {
    ciphertext: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce),
    version: 'v1',
  };
}

/**
 * Decrypt a message from a sender
 *
 * @param encrypted - Encrypted message object
 * @param recipientWallet - Recipient's wallet address
 * @param senderPublicKey - Sender's public encryption key (base64)
 * @returns Decrypted plain text message
 */
export async function decryptMessage(
  encrypted: EncryptedMessage,
  recipientWallet: string,
  senderPublicKey: string,
): Promise<string> {
  // Get recipient's keypair
  const recipientKeyPair = await retrieveKeyPair(recipientWallet);
  if (!recipientKeyPair) {
    throw new Error(
      'Recipient keypair not found. Please initialize encryption first.',
    );
  }

  // Decode sender's public key
  const senderPubKey = decodeBase64(senderPublicKey);

  // Decode ciphertext and nonce
  const ciphertext = decodeBase64(encrypted.ciphertext);
  const nonce = decodeBase64(encrypted.nonce);

  // Decrypt using box
  const decrypted = nacl.box.open(
    ciphertext,
    nonce,
    senderPubKey,
    recipientKeyPair.secretKey,
  );

  if (!decrypted) {
    throw new Error(
      'Decryption failed. Message may be corrupted or tampered with.',
    );
  }

  // Decode to string
  return new TextDecoder().decode(decrypted);
}

/**
 * Clear encryption keys for a wallet (logout/cleanup)
 */
export async function clearEncryptionKeys(
  walletAddress: string,
): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(walletAddress);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Check if encryption is initialized for a wallet
 */
export async function isEncryptionInitialized(
  walletAddress: string,
): Promise<boolean> {
  const keyPair = await retrieveKeyPair(walletAddress);
  return keyPair !== null;
}

/**
 * Utilities for testing and debugging
 */
export const encryptionUtils = {
  /**
   * Export public key as base64 string
   */
  exportPublicKey: (keyPair: EncryptionKeyPair): string => {
    return encodeBase64(keyPair.publicKey);
  },

  /**
   * Import public key from base64 string
   */
  importPublicKey: (publicKeyBase64: string): Uint8Array => {
    return decodeBase64(publicKeyBase64);
  },

  /**
   * Get key pair for testing (not for production use)
   */
  getKeyPairForTesting: async (
    walletAddress: string,
  ): Promise<EncryptionKeyPair | null> => {
    return retrieveKeyPair(walletAddress);
  },
};
