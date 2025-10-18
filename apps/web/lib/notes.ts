/**
 * Note Management Service
 *
 * Handles storage and sync of shielded notes with Supabase backend.
 * Notes are stored in localStorage for fast access and synced to Supabase.
 *
 * @module notes
 */

import axios from 'axios';
import { Note } from './types';
import { STORAGE_KEYS, API_BASE_URL } from './constants';

// Re-export Note type for backward compatibility
export type { Note };

/**
 * Sync notes to Supabase backend (optional - fails silently if unavailable)
 */
async function syncToSupabase(
  walletAddress: string,
  notes: Note[],
): Promise<void> {
  try {
    const encryptedData = btoa(JSON.stringify(notes)); // Simple base64 encoding

    await axios.post(
      `${API_BASE_URL}/notes/upload`,
      {
        walletAddress,
        encryptedData,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5_000,
      },
    );

    console.log('✅ Notes synced to Supabase');
  } catch (error) {
    // Fail silently - Supabase is optional
    const message = axios.isAxiosError(error)
      ? error.response?.statusText || error.message
      : 'Unknown error';
    console.warn(
      `Supabase sync not available (notes are still saved locally): ${message}`,
    );
  }
}

/**
 * Load notes from Supabase backend (optional - returns null if unavailable)
 */
async function loadFromSupabase(walletAddress: string): Promise<Note[] | null> {
  try {
    const response = await axios.get<{
      success: boolean;
      encryptedData?: string;
    }>(`${API_BASE_URL}/notes/${walletAddress}`, { timeout: 5_000 });

    const data = response.data;

    if (!data.success || !data.encryptedData) {
      return null;
    }

    // Decrypt (simple base64 decoding)
    const decrypted = atob(data.encryptedData);
    const notes = JSON.parse(decrypted);

    console.log(`✅ Loaded ${notes.length} notes from Supabase`);
    return notes;
  } catch {
    // Fail silently - Supabase is optional
    return null;
  }
}

/**
 * Get storage key for a wallet's notes
 * @param walletAddress - Public key of the wallet
 * @returns LocalStorage key
 */
function getStorageKey(walletAddress: string): string {
  return `${STORAGE_KEYS.NOTES_PREFIX}${walletAddress}`;
}

/**
 * Save a new note to localStorage and sync to Supabase
 * @param walletAddress - Public key of the wallet
 * @param note - Note to save
 */
export function saveNote(walletAddress: string, note: Note): void {
  const notes = getNotes(walletAddress);

  // Generate noteId if not provided (using commitment as basis)
  const noteWithId: Note = {
    ...note,
    noteId: note.noteId || note.commitment,
  };

  notes.push(noteWithId);

  try {
    localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(notes));

    // Sync to Supabase in background (don't await)
    syncToSupabase(walletAddress, notes).catch((err) =>
      console.error('Background sync failed:', err),
    );
  } catch (error) {
    console.error('Failed to save note:', error);
    throw new Error('Failed to save note to storage');
  }
}

/**
 * Get all notes for a wallet (loads from Supabase if localStorage is empty)
 * @param walletAddress - Public key of the wallet
 * @returns Array of all notes (spent and unspent)
 */
export function getNotes(walletAddress: string): Note[] {
  const stored = localStorage.getItem(getStorageKey(walletAddress));

  if (!stored) {
    // Try to load from Supabase in background
    loadFromSupabase(walletAddress)
      .then((notes) => {
        if (notes && notes.length > 0) {
          localStorage.setItem(
            getStorageKey(walletAddress),
            JSON.stringify(notes),
          );
          console.log(`Loaded ${notes.length} notes from Supabase`);
        }
      })
      .catch((err) => console.error('Failed to load from Supabase:', err));

    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse notes:', error);
    return [];
  }
}

/**
 * Async version: Get all notes for a wallet (loads from Supabase if localStorage is empty)
 * @param walletAddress - Public key of the wallet
 * @returns Promise<Array of all notes>
 */
export async function getNotesAsync(walletAddress: string): Promise<Note[]> {
  const stored = localStorage.getItem(getStorageKey(walletAddress));

  if (!stored) {
    // Load from Supabase
    const notes = await loadFromSupabase(walletAddress);
    if (notes && notes.length > 0) {
      localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(notes));
      console.log(`Loaded ${notes.length} notes from Supabase`);
      return notes;
    }
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse notes:', error);
    return [];
  }
}

/**
 * Get unspent notes for a wallet
 * @param walletAddress - Public key of the wallet
 * @returns Array of unspent notes
 */
export function getUnspentNotes(walletAddress: string): Note[] {
  return getNotes(walletAddress).filter((note) => !note.spent);
}

/**
 * Get the next note index for deterministic blinding factor derivation
 * @param walletAddress - Public key of the wallet
 * @returns Next available note index
 */
export function getNextNoteIndex(walletAddress: string): number {
  return getNotes(walletAddress).length;
}

/**
 * Derive deterministic blinding factor from wallet address and note index.
 * Uses SHA-256 for deterministic, reproducible blinding factors.
 * This allows the viewing key to reconstruct all notes from the blockchain.
 *
 * @param walletPublicKey - Public key of the wallet
 * @param index - Note index for derivation
 * @returns Blinding factor as bigint
 */
export async function deriveBlindingFactor(
  walletPublicKey: string,
  index: number,
): Promise<bigint> {
  const seed = `${walletPublicKey}_${index}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(seed);

  // Use Web Crypto API for SHA-256
  const arrayBufferForDigest = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  );

  const hashArrayBuffer = await globalThis.crypto.subtle.digest(
    'SHA-256',
    arrayBufferForDigest as ArrayBuffer,
  );

  const hashBytes = new Uint8Array(hashArrayBuffer);

  // Convert hash bytes to bigint
  let blinding = 0n;
  for (let i = 0; i < Math.min(hashBytes.length, 32); i++) {
    const byte = hashBytes[i] as number;
    blinding = (blinding << 8n) | BigInt(byte);
  }

  return blinding;
}

/**
 * Mark a note as spent (used in unshield/transfer) and sync to Supabase
 * @param walletAddress - Public key of the wallet
 * @param commitment - Commitment hash of the note to mark as spent
 */
export function markNoteAsSpent(
  walletAddress: string,
  commitment: string,
): void {
  const notes = getNotes(walletAddress);
  const updated = notes.map((note) =>
    note.commitment === commitment ? { ...note, spent: true } : note,
  );

  try {
    localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(updated));

    // Sync to Supabase in background
    syncToSupabase(walletAddress, updated).catch((err) =>
      console.error('Background sync failed:', err),
    );
  } catch (error) {
    console.error('Failed to mark note as spent:', error);
    throw new Error('Failed to update note status');
  }
}

/**
 * Calculate total unspent balance across all notes
 * @param walletAddress - Public key of the wallet
 * @returns Total SOL balance in unspent notes
 */
export function getTotalUnspentBalance(walletAddress: string): number {
  const unspent = getUnspentNotes(walletAddress);
  return unspent.reduce((sum, note) => {
    const amount = parseFloat(note.amount);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);
}

/**
 * Export notes as backup string
 * TODO: Encrypt with user password in production
 * @param walletAddress - Public key of the wallet
 * @returns Base64-encoded backup string
 */
export function exportNotes(walletAddress: string): string {
  const notes = getNotes(walletAddress);
  const json = JSON.stringify(notes);
  // In production, encrypt with user's password before encoding
  return btoa(json);
}

/**
 * Import notes from backup string
 * @param walletAddress - Public key of the wallet
 * @param backup - Base64-encoded backup string
 * @throws Error if backup format is invalid
 */
export function importNotes(walletAddress: string, backup: string): void {
  try {
    const json = atob(backup);
    const notes = JSON.parse(json);

    // Validate notes structure
    if (!Array.isArray(notes)) {
      throw new Error('Invalid backup format: not an array');
    }

    localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(notes));
  } catch (error) {
    console.error('Failed to import notes:', error);
    throw new Error('Invalid backup format');
  }
}

/**
 * Clear all notes for a wallet (use with caution) - clears both local and Supabase
 * @param walletAddress - Public key of the wallet
 */
export function clearNotes(walletAddress: string): void {
  try {
    localStorage.removeItem(getStorageKey(walletAddress));

    // Clear from Supabase by uploading empty array
    syncToSupabase(walletAddress, []).catch((err) =>
      console.error('Failed to clear Supabase:', err),
    );
  } catch (error) {
    console.error('Failed to clear notes:', error);
  }
}
