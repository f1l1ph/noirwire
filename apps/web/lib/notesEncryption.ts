import nacl from 'tweetnacl';
import {
  decodeUTF8,
  encodeBase64,
  decodeBase64,
  encodeUTF8,
} from 'tweetnacl-util';

// Constants for key derivation
const PBKDF2_ITERATIONS = 600000; // OWASP recommended (2023)
const SALT_LENGTH = 32; // 256 bits
const KEY_LENGTH = 32; // 256 bits for XSalsa20

/**
 * Derive encryption key from user password using PBKDF2
 * This provides proper security - key is derived from user's password/PIN, not wallet address
 *
 * @param password - User's password or PIN
 * @param salt - Cryptographic salt (from encrypted data or generated)
 * @returns Derived 32-byte key
 */
export async function deriveEncryptionKey(
  password: string,
  salt?: Uint8Array,
): Promise<{ key: Uint8Array; salt: Uint8Array }> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  // Generate salt if not provided
  const saltBytes = salt || crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  // Import password as key material
  const passwordBuffer = passwordBytes.buffer.slice(
    passwordBytes.byteOffset,
    passwordBytes.byteOffset + passwordBytes.byteLength,
  ) as ArrayBuffer;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  // Derive key using PBKDF2
  const saltBuffer = saltBytes.buffer.slice(
    saltBytes.byteOffset,
    saltBytes.byteOffset + saltBytes.byteLength,
  ) as ArrayBuffer;

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH * 8,
  );

  return {
    key: new Uint8Array(derivedBits),
    salt: saltBytes,
  };
}

/**
 * Encrypt notes data using XSalsa20-Poly1305
 * Format: salt (32 bytes) + nonce (24 bytes) + ciphertext
 *
 * @param notes - Array of notes to encrypt
 * @param password - User's password or PIN
 * @returns Base64-encoded encrypted data
 */
export async function encryptNotes(
  notes: unknown[],
  password: string,
): Promise<string> {
  try {
    const json = JSON.stringify(notes);
    const messageUint8 = decodeUTF8(json);

    // Derive encryption key with new random salt
    const { key, salt } = await deriveEncryptionKey(password);

    // Generate random nonce
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);

    // Encrypt using XSalsa20-Poly1305
    const encrypted = nacl.secretbox(messageUint8, nonce, key);

    // Combine salt + nonce + encrypted data
    const fullMessage = new Uint8Array(
      salt.length + nonce.length + encrypted.length,
    );
    fullMessage.set(salt, 0);
    fullMessage.set(nonce, salt.length);
    fullMessage.set(encrypted, salt.length + nonce.length);

    return encodeBase64(fullMessage);
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt notes');
  }
}

/**
 * Decrypt notes data using XSalsa20-Poly1305
 *
 * @param encryptedData - Base64-encoded encrypted data
 * @param password - User's password or PIN
 * @returns Decrypted array of notes
 */
export async function decryptNotes(
  encryptedData: string,
  password: string,
): Promise<unknown[]> {
  try {
    const fullMessage = decodeBase64(encryptedData);

    // Extract salt, nonce, and encrypted data
    const salt = fullMessage.slice(0, SALT_LENGTH);
    const nonce = fullMessage.slice(
      SALT_LENGTH,
      SALT_LENGTH + nacl.secretbox.nonceLength,
    );
    const encrypted = fullMessage.slice(
      SALT_LENGTH + nacl.secretbox.nonceLength,
    );

    // Derive decryption key using extracted salt
    const { key } = await deriveEncryptionKey(password, salt);

    // Decrypt using XSalsa20-Poly1305
    const decrypted = nacl.secretbox.open(encrypted, nonce, key);
    if (!decrypted) {
      throw new Error('Decryption failed - invalid password or corrupted data');
    }

    const json = encodeUTF8(decrypted);
    return JSON.parse(json);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error(
      'Failed to decrypt notes - invalid password or corrupted data',
    );
  }
}

/**
 * Verify if encrypted data can be decrypted with given password
 *
 * @param encryptedData - Base64-encoded encrypted data
 * @param password - User's password or PIN to test
 * @returns True if password is correct
 */
export async function verifyPassword(
  encryptedData: string,
  password: string,
): Promise<boolean> {
  try {
    await decryptNotes(encryptedData, password);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a random password suggestion for users
 *
 * @returns Random 24-character password
 */
export function generatePassword(): string {
  const randomBytes = nacl.randomBytes(18);
  return encodeBase64(randomBytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
