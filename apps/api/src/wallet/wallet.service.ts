/**
 * Wallet Service - Manages private balance and note tracking automatically
 * Users don't need to worry about notes - everything is handled transparently
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import * as crypto from 'crypto';

export interface Note {
  id: string; // Unique identifier
  commitment: string; // Public commitment hash
  amount: string; // Amount in lamports (as string to handle large numbers)
  recipientPk: string; // Recipient public key
  blinding: string; // Random blinding factor
  spent: boolean; // Whether note has been spent
  createdAt: number; // Unix timestamp
  spentAt?: number; // Unix timestamp when spent
  nullifier?: string; // Nullifier (computed when spending)
}

export interface PrivateBalance {
  total: string; // Total balance in lamports
  spendable: string; // Balance available to spend (unspent notes)
  pending: string; // Balance pending confirmation
  notes: Note[]; // All notes (for advanced users)
}

export interface EncryptedNoteStore {
  version: number;
  notes: Note[];
  encryptedAt: number;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private readonly CURRENT_VERSION = 1;

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Get user's private balance automatically
   * Fetches notes from encrypted storage and calculates balance
   */
  async getPrivateBalance(
    userPublicKey: string,
    encryptionPassword: string,
  ): Promise<PrivateBalance> {
    try {
      const notes = await this.getNotes(userPublicKey, encryptionPassword);

      // Calculate balances
      const unspentNotes = notes.filter((n) => !n.spent);
      const spendableNotes = unspentNotes.filter((n) => n.amount !== '0');

      const total = this.sumAmounts(notes.map((n) => n.amount));
      const spendable = this.sumAmounts(spendableNotes.map((n) => n.amount));
      const pending = '0'; // TODO: Track pending transactions

      return {
        total,
        spendable,
        pending,
        notes: unspentNotes, // Only return unspent notes by default
      };
    } catch (error: any) {
      this.logger.error('Failed to get private balance:', error.message);
      // Return empty balance on error
      return {
        total: '0',
        spendable: '0',
        pending: '0',
        notes: [],
      };
    }
  }

  /**
   * Add a new note to user's encrypted storage
   */
  async addNote(
    userPublicKey: string,
    encryptionPassword: string,
    note: Omit<Note, 'id' | 'createdAt'>,
  ): Promise<void> {
    const notes = await this.getNotes(userPublicKey, encryptionPassword);

    const newNote: Note = {
      ...note,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };

    notes.push(newNote);

    await this.saveNotes(userPublicKey, encryptionPassword, notes);
    this.logger.log(`Added new note for ${userPublicKey.slice(0, 8)}...`);
  }

  /**
   * Mark a note as spent
   */
  async spendNote(
    userPublicKey: string,
    encryptionPassword: string,
    noteId: string,
    nullifier: string,
  ): Promise<void> {
    const notes = await this.getNotes(userPublicKey, encryptionPassword);

    const note = notes.find((n) => n.id === noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    if (note.spent) {
      throw new Error(`Note already spent: ${noteId}`);
    }

    note.spent = true;
    note.spentAt = Date.now();
    note.nullifier = nullifier;

    await this.saveNotes(userPublicKey, encryptionPassword, notes);
    this.logger.log(`Marked note ${noteId} as spent`);
  }

  /**
   * Get all notes for a user (decrypted)
   */
  async getNotes(
    userPublicKey: string,
    encryptionPassword: string,
  ): Promise<Note[]> {
    try {
      const encryptedData =
        await this.supabaseService.downloadNotes(userPublicKey);

      if (!encryptedData) {
        // No notes yet - return empty array
        return [];
      }

      // Decrypt notes
      const decrypted = this.decrypt(encryptedData, encryptionPassword);
      const noteStore: EncryptedNoteStore = JSON.parse(decrypted);

      // Validate version
      if (noteStore.version !== this.CURRENT_VERSION) {
        this.logger.warn(
          `Note store version mismatch: ${noteStore.version} vs ${this.CURRENT_VERSION}`,
        );
      }

      return noteStore.notes;
    } catch (error: any) {
      this.logger.error('Failed to get notes:', error.message);
      throw new Error(`Failed to retrieve notes: ${error.message}`);
    }
  }

  /**
   * Save notes to encrypted storage
   */
  private async saveNotes(
    userPublicKey: string,
    encryptionPassword: string,
    notes: Note[],
  ): Promise<void> {
    const noteStore: EncryptedNoteStore = {
      version: this.CURRENT_VERSION,
      notes,
      encryptedAt: Date.now(),
    };

    const encrypted = this.encrypt(
      JSON.stringify(noteStore),
      encryptionPassword,
    );

    await this.supabaseService.uploadNotes(userPublicKey, encrypted);
  }

  /**
   * Find spendable notes for a given amount
   * Returns optimal note selection for the transaction
   */
  async selectNotesForAmount(
    userPublicKey: string,
    encryptionPassword: string,
    amountLamports: string,
  ): Promise<Note[]> {
    const notes = await this.getNotes(userPublicKey, encryptionPassword);
    const unspentNotes = notes.filter((n) => !n.spent);

    // Sort by amount (descending) for simple greedy selection
    const sortedNotes = unspentNotes.sort((a, b) => {
      const amountA = BigInt(a.amount);
      const amountB = BigInt(b.amount);
      return amountA > amountB ? -1 : amountA < amountB ? 1 : 0;
    });

    const targetAmount = BigInt(amountLamports);
    let accumulated = 0n;
    const selected: Note[] = [];

    // Greedy selection: try to find exact match first, then smallest set
    for (const note of sortedNotes) {
      if (BigInt(note.amount) === targetAmount) {
        return [note]; // Exact match
      }
    }

    // Otherwise, accumulate notes until we have enough
    for (const note of sortedNotes) {
      selected.push(note);
      accumulated += BigInt(note.amount);

      if (accumulated >= targetAmount) {
        return selected;
      }
    }

    throw new Error('Insufficient balance');
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  private encrypt(plaintext: string, password: string): string {
    try {
      // Derive key from password
      const key = crypto.scryptSync(password, 'salt', 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, key, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Format: iv:authTag:encrypted
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error: any) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  private decrypt(ciphertext: string, password: string): string {
    try {
      const parts = ciphertext.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid ciphertext format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      // Derive same key from password
      const key = crypto.scryptSync(password, 'salt', 32);
      const decipher = crypto.createDecipheriv(
        this.ENCRYPTION_ALGORITHM,
        key,
        iv,
      );
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error: any) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Sum amounts (strings) safely
   */
  private sumAmounts(amounts: string[]): string {
    return amounts.reduce((sum, amount) => sum + BigInt(amount), 0n).toString();
  }
}
