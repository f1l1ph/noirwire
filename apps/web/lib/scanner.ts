// Blockchain scanner for commitments
// Scans on-chain events to rebuild your notes from your viewing key

import { Connection, PublicKey } from '@solana/web3.js';
import { Note, saveNote, getNotes } from './notes';
import { computeCommitment } from './crypto';

const PROGRAM_ID = new PublicKey(
  'Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz',
);

// Event discriminators for parsing logs
const NEW_COMMITMENT_EVENT_DISCRIMINATOR = '4b55cb15';

export interface ScannedCommitment {
  commitment: string;
  timestamp: number;
  signature: string;
  slot: number;
}

/**
 * Scan blockchain for NewCommitment events
 * This finds all shielded deposits in the privacy pool
 */
export async function scanForCommitments(
  connection: Connection,
): Promise<ScannedCommitment[]> {
  const commitments: ScannedCommitment[] = [];

  try {
    // Get recent signatures for the program
    const signatures = await connection.getSignaturesForAddress(
      PROGRAM_ID,
      { limit: 100 },
      'confirmed',
    );

    console.log(`Found ${signatures.length} transactions to scan`);

    // Fetch and parse each transaction
    for (const sigInfo of signatures) {
      if (sigInfo.err) continue; // Skip failed transactions

      const tx = await connection.getTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx || !tx.meta?.logMessages) continue;

      // Look for program data in logs (emitted events)
      for (const log of tx.meta.logMessages) {
        if (log.includes('Program data:')) {
          // Extract base64 data
          const match = log.match(/Program data: (.+)/);
          if (!match || !match[1]) continue;

          try {
            const data = Buffer.from(match[1], 'base64');

            // Check if it's a NewCommitment event (first 4 bytes are discriminator)
            const discriminator = data.slice(0, 4).toString('hex');
            if (discriminator === NEW_COMMITMENT_EVENT_DISCRIMINATOR) {
              // Parse commitment (next 32 bytes after discriminator)
              const commitmentBytes = data.slice(4, 36);
              const commitment = commitmentBytes.toString('hex');

              commitments.push({
                commitment,
                timestamp: tx.blockTime || Date.now() / 1000,
                signature: sigInfo.signature,
                slot: sigInfo.slot,
              });

              console.log('Found commitment:', commitment.slice(0, 16) + '...');
            }
          } catch (err) {
            console.error('Failed to parse program data:', err);
          }
        }
      }
    }

    console.log(`Scanned ${commitments.length} commitments`);
    return commitments;
  } catch (err) {
    console.error('Scan failed:', err);
    return [];
  }
}

/**
 * Derive viewing key from wallet
 * In production, this would use proper key derivation (BIP44, etc.)
 * For demo: we'll use the wallet's public key to derive deterministic blinding factors
 */
export function deriveViewingKey(walletPublicKey: PublicKey): string {
  // Simple derivation: hash of public key
  // In production, you'd use the private key for proper derivation
  const bytes = walletPublicKey.toBuffer();
  return bytes.toString('hex');
}

/**
 * Try to decrypt/identify a commitment as yours
 * This checks if a commitment was created by you by testing different blinding factors
 *
 * In a real implementation, you would:
 * 1. Derive a deterministic blinding factor from your viewing key + index
 * 2. For each scanned commitment, compute what the commitment should be
 * 3. If it matches, you own that note
 */
export async function tryDecryptCommitment(
  commitment: string,
  viewingKey: string,
  walletAddress: string,
  amount: bigint,
  index: number,
): Promise<{ blinding: bigint; matches: boolean }> {
  // Derive deterministic blinding factor from viewing key + index
  const seed = `${viewingKey}_${index}`;
  const hashBuffer = Buffer.from(seed);

  // Create a deterministic blinding factor (simplified for demo)
  let blinding = BigInt(0);
  for (let i = 0; i < Math.min(hashBuffer.length, 32); i++) {
    const byte = hashBuffer[i];
    if (byte !== undefined) {
      blinding = (blinding << BigInt(8)) | BigInt(byte);
    }
  }

  // Compute what the commitment should be with this blinding
  const recipientPk = BigInt(`0x${walletAddress.slice(0, 16)}`);
  const expectedCommitment = await computeCommitment(
    recipientPk,
    amount,
    blinding,
  );
  const expectedHex = expectedCommitment.toString(16).padStart(64, '0');

  // Check if it matches
  return {
    blinding,
    matches: expectedHex === commitment,
  };
}

/**
 * Scan and restore notes from blockchain using viewing key
 * This is the key function that makes the wallet work across devices
 */
export async function scanAndRestoreNotes(
  connection: Connection,
  walletPublicKey: PublicKey,
  progressCallback?: (status: string, progress: number) => void,
): Promise<number> {
  const walletAddress = walletPublicKey.toBase58();
  const viewingKey = deriveViewingKey(walletPublicKey);

  progressCallback?.('Scanning blockchain...', 0);

  // Get all commitments from blockchain
  const scannedCommitments = await scanForCommitments(connection);

  if (scannedCommitments.length === 0) {
    progressCallback?.('No commitments found', 100);
    return 0;
  }

  progressCallback?.('Checking commitments...', 30);

  // Get existing notes to avoid duplicates
  const existingNotes = getNotes(walletAddress);
  const existingCommitments = new Set(existingNotes.map((n) => n.commitment));

  let restored = 0;
  const commonAmounts = [
    0.001,
    0.01,
    0.1,
    0.5,
    1,
    5,
    10, // Common shield amounts in SOL
  ];

  // Try to identify which commitments are yours
  for (let i = 0; i < scannedCommitments.length; i++) {
    const scanned = scannedCommitments[i];
    if (!scanned) continue;

    // Skip if we already have this note
    if (existingCommitments.has(scanned.commitment)) continue;

    progressCallback?.(
      `Checking commitment ${i + 1}/${scannedCommitments.length}...`,
      30 + (i / scannedCommitments.length) * 60,
    );

    // Try different amounts to find a match
    for (const solAmount of commonAmounts) {
      const amountLamports = BigInt(Math.floor(solAmount * 1e9));

      // Try different indices (in case you have multiple notes)
      for (let index = 0; index < 10; index++) {
        const { blinding, matches } = await tryDecryptCommitment(
          scanned.commitment,
          viewingKey,
          walletAddress,
          amountLamports,
          index,
        );

        if (matches) {
          // Found a match! Save this note
          const note: Note = {
            commitment: scanned.commitment,
            blinding: blinding.toString(),
            amount: solAmount.toString(),
            recipient: walletAddress,
            timestamp: scanned.timestamp * 1000,
            txSignature: scanned.signature,
            spent: false,
          };

          saveNote(walletAddress, note);
          restored++;
          console.log(`✅ Restored note: ${solAmount} SOL`);

          // Move to next commitment once found
          break;
        }
      }
    }
  }

  progressCallback?.('Scan complete!', 100);
  return restored;
}
