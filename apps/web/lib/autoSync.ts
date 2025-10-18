/**
 * Automatic Viewing Key Sync System
 *
 * Provides automatic background synchronization of shielded notes
 * using the wallet's viewing key. Professional async patterns, no manual delays.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { Note, saveNote, getNotes } from './notes';
import { computeCommitment, bufferToField } from './crypto';
import * as crypto from 'crypto';
import {
  PROGRAM_ID,
  SYNC_CONFIG,
  EVENT_DISCRIMINATORS,
  COMMON_NOTE_AMOUNTS,
  SCAN_CONFIG,
  UI_CONFIG,
} from './constants';
import type { AutoSyncConfig, SyncResult } from '@noirwire/types';

export class AutoViewingKeySync {
  private config: AutoSyncConfig;
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;

  constructor(config: AutoSyncConfig) {
    this.config = config;
  }

  /**
   * Start automatic background synchronization
   */
  start(): void {
    if (this.syncInterval) return;

    // Initial sync
    this.syncOnce().catch(this.handleError);

    // Periodic sync
    this.syncInterval = setInterval(() => {
      this.syncOnce().catch(this.handleError);
    }, SYNC_CONFIG.INTERVAL_MS);

    console.log(
      `✅ Auto-sync started - checking every ${SYNC_CONFIG.INTERVAL_MS / 1000}s`,
    );
  }

  /**
   * Stop automatic synchronization
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏸️ Auto-sync stopped');
    }
  }

  /**
   * Perform a single sync operation
   */
  async syncOnce(): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('⏭️ Sync already in progress, skipping');
      return { found: 0, total: 0 };
    }

    this.isSyncing = true;
    try {
      console.log('🔄 Syncing notes from blockchain...');
      return await this.syncFromCommitments();
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Scan blockchain for new commitments
   */
  private async syncFromCommitments(): Promise<SyncResult> {
    const walletAddress = this.config.walletPublicKey.toBase58();

    try {
      const signatures = await this.config.connection.getSignaturesForAddress(
        PROGRAM_ID,
        { limit: SYNC_CONFIG.TRANSACTION_SCAN_LIMIT },
        'confirmed',
      );

      console.log(`📊 Found ${signatures.length} transactions to scan`);

      let found = 0;
      const existingCommitments = new Set(
        getNotes(walletAddress).map((n) => n.commitment),
      );

      // Process transactions in parallel
      type SigInfo = { err: unknown; signature: string };
      const results = await Promise.allSettled(
        (signatures as SigInfo[])
          .filter((sig) => !sig.err)
          .map(async (sigInfo) => {
            const tx = await this.config.connection.getTransaction(
              sigInfo.signature,
              {
                maxSupportedTransactionVersion: 0,
              },
            );

            if (!tx?.meta?.logMessages) return [];

            const newNotes: Note[] = [];

            for (const log of tx.meta.logMessages) {
              const commitment = this.parseCommitmentFromLog(log);
              if (!commitment || existingCommitments.has(commitment)) continue;

              const note = await this.tryDecryptCommitment(
                commitment,
                tx.blockTime || Date.now() / 1000,
                sigInfo.signature,
              );

              if (note) {
                newNotes.push(note);
                existingCommitments.add(commitment);
              }
            }

            return newNotes;
          }),
      );

      // Collect all found notes
      type SettledResult = PromiseSettledResult<Note[]>;
      results.forEach((result: SettledResult) => {
        if (result.status === 'fulfilled') {
          result.value.forEach((note: Note) => {
            saveNote(walletAddress, note);
            found++;
            console.log(
              `✅ Found note: ${parseFloat(note.amount).toFixed(UI_CONFIG.NOTE_DISPLAY_DECIMALS)} SOL`,
            );
          });
        }
      });

      this.notifyUpdate();
      console.log(`🎉 Sync complete: found ${found} new note(s)`);
      return { found, total: signatures.length };
    } catch (error) {
      console.error('Sync from commitments failed:', error);
      return { found: 0, total: 0 };
    }
  }

  /**
   * Parse commitment from program log
   */
  private parseCommitmentFromLog(log: string): string | null {
    if (!log.includes('Program data:')) return null;

    const match = log.match(/Program data: (.+)/);
    if (!match?.[1]) return null;

    try {
      const data = Buffer.from(match[1], 'base64');
      const discriminator = data.slice(0, 4).toString('hex');

      if (discriminator === EVENT_DISCRIMINATORS.NEW_COMMITMENT) {
        const commitmentBytes = data.slice(4, 36);
        const commitmentBigInt = bufferToField(new Uint8Array(commitmentBytes));
        return commitmentBigInt.toString(16).padStart(64, '0');
      }
    } catch {
      // Silently skip invalid logs
    }

    return null;
  }

  /**
   * Try to identify if a commitment belongs to this wallet
   */
  private async tryDecryptCommitment(
    commitment: string,
    timestamp: number,
    signature: string,
  ): Promise<Note | null> {
    const walletAddress = this.config.walletPublicKey.toBase58();
    const recipientPk = BigInt(
      this.config.walletPublicKey.toBuffer().readBigUInt64LE(0),
    );

    // Try different note indices and amounts
    for (
      let noteIndex = 0;
      noteIndex < SCAN_CONFIG.MAX_NOTE_INDEX;
      noteIndex++
    ) {
      for (const solAmount of COMMON_NOTE_AMOUNTS) {
        const amountLamports = BigInt(Math.floor(solAmount * 1e9));
        const blinding = this.deriveBlindingFactor(noteIndex);
        const expectedCommitment = await computeCommitment(
          recipientPk,
          amountLamports,
          blinding,
        );
        const expectedHex = expectedCommitment.toString(16).padStart(64, '0');

        if (expectedHex === commitment) {
          return {
            commitment,
            blinding: blinding.toString(),
            amount: solAmount.toString(),
            recipient: walletAddress,
            timestamp: timestamp * 1000,
            txSignature: signature,
            spent: false,
          };
        }
      }
    }

    return null;
  }

  /**
   * Derive deterministic blinding factor from wallet + index
   */
  private deriveBlindingFactor(index: number): bigint {
    const seed = `${this.config.walletPublicKey.toBase58()}_${index}`;
    const hashBuffer = crypto.createHash('sha256').update(seed).digest();

    let blinding = BigInt(0);
    for (let i = 0; i < Math.min(hashBuffer.length, 32); i++) {
      const byte = hashBuffer[i];
      if (byte !== undefined) {
        blinding = (blinding << BigInt(8)) | BigInt(byte);
      }
    }

    return blinding;
  }

  /**
   * Notify listeners of balance update
   */
  private notifyUpdate(): void {
    const walletAddress = this.config.walletPublicKey.toBase58();
    const notes = getNotes(walletAddress);
    const unspent = notes.filter((n) => !n.spent);
    const totalBalance = unspent.reduce(
      (sum, n) => sum + parseFloat(n.amount),
      0,
    );

    this.config.onUpdate?.(unspent.length, totalBalance);
  }

  /**
   * Error handler
   */
  private handleError = (error: Error): void => {
    console.error('Auto-sync error:', error);
    this.config.onError?.(error);
  };
}

/**
 * Global sync manager (singleton per wallet)
 */
const activeSyncs = new Map<string, AutoViewingKeySync>();

/**
 * Start auto-sync for a wallet
 */
export function startAutoSync(config: AutoSyncConfig): AutoViewingKeySync {
  const key = config.walletPublicKey.toBase58();

  // Stop existing sync if any
  stopAutoSync(config.walletPublicKey);

  // Create and start new sync
  const sync = new AutoViewingKeySync(config);
  sync.start();
  activeSyncs.set(key, sync);

  return sync;
}

/**
 * Stop auto-sync for a wallet
 */
export function stopAutoSync(walletPublicKey: PublicKey): void {
  const key = walletPublicKey.toBase58();
  const sync = activeSyncs.get(key);

  if (sync) {
    sync.stop();
    activeSyncs.delete(key);
  }
}

/**
 * Trigger manual sync for a wallet
 */
export async function manualSync(
  connection: Connection,
  walletPublicKey: PublicKey,
): Promise<SyncResult> {
  const sync = new AutoViewingKeySync({ connection, walletPublicKey });
  return await sync.syncOnce();
}
