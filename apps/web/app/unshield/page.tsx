'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  TransactionInstruction,
  Transaction,
  SystemProgram,
  SendTransactionError,
} from '@solana/web3.js';
import { useState, useEffect } from 'react';
import { getIndexerSyncStatus } from '../../lib/indexerClient';
import {
  deriveSecretKey,
  generateNoteId,
  getMerkleProof,
  splitAddressToLimbs,
} from '../../lib/privacyUtils';
import { generateProof, decodeProof } from '../../lib/proofService';
import { Note, ProcessingStep, UnshieldInput } from '../../lib/types';
import { FRONTEND_URL, API_BASE_URL } from '../../lib/constants';
import { useWalletData } from '../context/WalletDataContext';
import styles from '../components/TransactionLayout.module.css';
import Navigation from '../components/Navigation';

const PROGRAM_ID = new PublicKey('Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz');
const UNSHIELD_DISCRIMINATOR = Buffer.from([136, 159, 238, 158, 125, 27, 217, 224]);
const toLittleEndianBytes = (value: bigint, byteLength: number): Buffer => {
  if (value < 0n) {
    throw new Error('Negative values not supported for field encoding');
  }
  const max = 1n << (BigInt(byteLength) * 8n);
  if (value >= max) {
    throw new Error(
      `Value ${value.toString()} does not fit in ${byteLength} little-endian bytes`,
    );
  }

  const buffer = Buffer.alloc(byteLength);
  let temp = value;
  for (let i = 0; i < byteLength; i++) {
    buffer[i] = Number(temp & 0xffn);
    temp >>= 8n;
  }

  return buffer;
};

export default function UnshieldPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { getUnspentNotes, markNoteAsSpent, privateBalance } = useWalletData();
  const [recipientAddress, setRecipientAddress] = useState('');
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number>(0);
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [status, setStatus] = useState('');
  const [txSig, setTxSig] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  const [availableNotes, setAvailableNotes] = useState<Note[]>([]);

  const fee = '0'; // No fee for unshield

  // Load available notes from context
  useEffect(() => {
    if (!publicKey) {
      setAvailableNotes([]);
      return;
    }

    const notes = getUnspentNotes();
    setAvailableNotes(notes);
  }, [publicKey, getUnspentNotes, privateBalance]);

  // Get selected note and unshield amount
  const selectedNote = availableNotes[selectedNoteIndex];
  const unshieldAmount = selectedNote?.amount || '0';

  const handleUnshield = async () => {
    // Validation: Wallet connected
    if (!publicKey || !signTransaction) {
      setStep('error');
      setStatus('❌ Please connect your wallet first');
      setErrorDetails('Click the "Select Wallet" button in the top right corner to connect your Phantom wallet.');
      return;
    }

    // Validation: Has available notes
    if (availableNotes.length === 0) {
      setStep('error');
      setStatus('❌ No private balance available');
      setErrorDetails(`You need to shield some SOL first. Here's what to do:\n\n` +
        `1. Go to the "Shield" tab\n` +
        `2. Enter the amount you want to shield (0.001 SOL minimum)\n` +
        `3. Click "Shield SOL" and wait for confirmation\n` +
        `4. Your private balance will be updated immediately\n` +
        `5. Once Merkle roots are published on-chain, you can unshield\n\n` +
        `Currently: 0 SOL shielded`);
      return;
    }

    // Validation: Amount entered
    if (!unshieldAmount || parseFloat(unshieldAmount) <= 0) {
      setStep('error');
      setStatus('❌ No note selected');
      setErrorDetails('Please select a note to unshield.');
      return;
    }

    // Validation: Has a note that can cover the amount
    if (!selectedNote) {
      setStep('error');
      setStatus('❌ No note selected');
      setErrorDetails('Please select a note from the dropdown.');
      return;
    }

    try {
      setStep('computing');
      setStatus('Computing unshield proof...');
      setTxSig('');
      setErrorDetails('');
      
      // Parse amounts
      const unshieldAmountLamports = BigInt(Math.floor(parseFloat(unshieldAmount) * 1e9));
      const feeLamports = BigInt(Math.floor(parseFloat(fee) * 1e9));
      const oldAmountLamports = BigInt(Math.floor(parseFloat(selectedNote.amount) * 1e9));
      
      // Validate amounts
      if (unshieldAmountLamports + feeLamports > oldAmountLamports) {
        throw new Error('Unshield amount + fee exceeds note balance');
      }
      
      // Validate unshield amount is positive
      if (unshieldAmountLamports <= 0n) {
        throw new Error('Unshield amount must be greater than 0');
      }
      
      // Derive secret key
      const secretKey = await deriveSecretKey(publicKey.toBase58());
      
      // Get Merkle proof from shield tree (where the note was created)
      // Note: For unshield, we spend a note from the shield tree
      setStatus('Fetching Merkle proof from indexer...');
      console.log('');
      console.log('═══════════════════════════════════════════════');
      console.log('🔍 FETCHING MERKLE PROOF');
      console.log('═══════════════════════════════════════════════');
      console.log(`Note commitment: ${selectedNote.commitment}`);
      console.log(`Commitment length: ${selectedNote.commitment.length} chars`);
      console.log(`Commitment type: ${typeof selectedNote.commitment}`);
      console.log(`Querying circuit: shield`);
      console.log('');
      
      let merkleProof;
      try {
        merkleProof = await getMerkleProof(selectedNote.commitment, 'shield');
        console.log('✅ Got Merkle proof:');
        console.log(`   Root: ${merkleProof.rootHex}`);
        console.log(`   Path length: ${merkleProof.path.length}`);
        console.log(`   Path positions length: ${merkleProof.pathPositions.length}`);
        console.log(`   First 5 path elements: ${JSON.stringify(merkleProof.path.slice(0, 5))}`);
        console.log(`   First 5 positions: ${JSON.stringify(merkleProof.pathPositions.slice(0, 5))}`);
        console.log('');
        
        // Check if path is all zeros (means commitment not found but didn't error)
        const allZeros = merkleProof.path.every(p => p === '0' || p === '0x0' || BigInt(p) === 0n);
        if (allZeros) {
          console.error('❌ PATH IS ALL ZEROS!');
          console.error('   This means the commitment was NOT found in the tree');
          console.error('   The indexer returned a default/empty proof');
          console.error('');
          console.error('   Commitment being queried:', selectedNote.commitment);
          console.error('');
          throw new Error(
            `Merkle path is all zeros! The commitment was not found in the indexer.\n\n` +
            `Commitment: ${selectedNote.commitment}\n\n` +
            `This means:\n` +
            `1. The commitment format doesn't match (hex vs decimal)\n` +
            `2. The commitment wasn't added to indexer after shield\n` +
            `3. The indexer was restarted and tree is empty\n\n` +
            `MANUAL FIX:\n` +
            `Go to: ${FRONTEND_URL}/debug-indexer\n` +
            `1. Click "Load Status" - check shield tree count\n` +
            `2. Click "Load Notes" - find your commitment\n` +
            `3. Paste commitment in input field\n` +
            `4. Click "Add to Indexer"\n` +
            `5. Click "Get Merkle Proof" to verify it works`
          );
        }
        
        // Validate proof has data
        if (!merkleProof.path || merkleProof.path.length === 0) {
          throw new Error(
            `Merkle proof has empty path! This means:\n` +
            `1. The commitment was not added to the indexer\n` +
            `2. The indexer tree is empty\n` +
            `3. You need to manually add the commitment\n\n` +
            `Try: curl -X POST ${API_BASE_URL}/indexer/shield/commit \\\n` +
            `  -H "Content-Type: application/json" \\\n` +
            `  -d '{"commitment":"${selectedNote.commitment}"}'`
          );
        }
        
        console.log('✅ Merkle proof looks valid (not all zeros)');
        console.log('═══════════════════════════════════════════════');
        console.log('');
        
      } catch (proofErr) {
        const proofError = proofErr as Error;
        console.error('❌ MERKLE PROOF ERROR:', proofError);
        
        if (proofError.message.includes('No commitments found')) {
          throw new Error(
            'Your note is not in the Merkle tree yet. This can happen if:\n' +
            '1. The note was just created (wait a few seconds)\n' +
            '2. The indexer was restarted (notes are stored locally but tree needs rebuilding)\n' +
            '3. You need to manually add the commitment to the indexer\n\n' +
            `Commitment: ${selectedNote.commitment.slice(0, 16)}...\n\n` +
            `Try running:\n` +
            `curl -X POST ${API_BASE_URL}/indexer/shield/commit \\\n` +
            `  -H "Content-Type: application/json" \\\n` +
            `  -d '{"commitment":"${selectedNote.commitment}"}'`
          );
        }
        throw proofErr; // Re-throw other errors
      }
      const { rootHex, path, pathPositions } = merkleProof;

      const waitForRootOnChain = async (hex: string) => {
        const normalized = hex.replace(/^0x/, '').toLowerCase();
        const maxAttempts = 12;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const syncStatus = await getIndexerSyncStatus().catch(() => null);
          const statusEntry = syncStatus?.rootStatus.find(
            (entry) => entry.root === normalized,
          );

          if (statusEntry?.status === 'published') {
            const seenAt = new Date(statusEntry.updatedAt).toLocaleTimeString();
            setStatus(
              `✅ Merkle root published on-chain (${seenAt}). Continuing unshield...`,
            );
            return;
          }

          const latestShieldRoot = syncStatus?.indexerStatus.latestRoots.shield;
          const parts = [
            `⏳ Merkle root pending on-chain (attempt ${attempt + 1}/${maxAttempts})`,
            `\n\n📝 What's happening:`,
            `• Your note has been added to the Merkle tree ✓`,
            `• Waiting for the root to be published on-chain...`,
            `• This happens automatically every ~30 seconds`,
          ];
          
          if (statusEntry) {
            parts.push(`\n📊 Root Status: ${statusEntry.status}`);
            if (statusEntry.signature) {
              parts.push(`   Transaction: ${statusEntry.signature.slice(0, 16)}...`);
            }
            if (statusEntry.error) {
              parts.push(`   ⚠️ Last error: ${statusEntry.error}`);
            }
          } else if (latestShieldRoot?.root) {
            parts.push(`\n🌳 Latest root: ${latestShieldRoot.root.slice(0, 16)}...`);
            parts.push(`   Updated: ${new Date(latestShieldRoot.updatedAt).toLocaleTimeString()}`);
          }
          
          parts.push(`\n💡 Tip: You can cancel and try again later. Your note is safely stored.`);
          
          setStatus(parts.join(' '));

          await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        throw new Error(
          `Merkle root pending on-chain after 60 seconds. This usually means:\n\n` +
          `1. The indexer is busy publishing roots (wait 1-2 minutes and try again)\n` +
          `2. Network is congested (Solana network is slow)\n\n` +
          `Your note is safely stored. You can try unshielding again later. Check the debug page at ${FRONTEND_URL}/debug-indexer for more details.`
        );
      };

      await waitForRootOnChain(rootHex);
      
      // Parse recipient address and split into limbs
      let recipientPubkey: PublicKey;
      try {
        recipientPubkey = new PublicKey(recipientAddress || publicKey.toBase58());
      } catch {
        throw new Error('Invalid recipient address');
      }
      
      const recipientBytes = recipientPubkey.toBuffer();
      const { lo: recipientLo, hi: recipientHi } = splitAddressToLimbs(recipientBytes);
      
      // Generate note ID
      const noteId = generateNoteId(selectedNote.commitment);
      
      // Compute nullifier (must be done before proof input)
      const { computeNullifier } = await import('../../lib/privacyUtils');
      const nullifier = await computeNullifier(secretKey, noteId);
      
      // Build proof input - send only what the circuit expects
      // NOTE: root and nullifier are COMPUTED by the circuit, not inputs!
      const proofInput: UnshieldInput = {
        // Web app format that we'll transform on the backend
        root: rootHex, // Will be removed by backend
        nullifier: nullifier.toString(), // Will be removed by backend
        secret: secretKey.toString(),
        amount: oldAmountLamports.toString(), // OLD amount in the note, not unshield amount
        blinding: selectedNote.blinding,
        path_elements: path,
        path_index: pathPositions,
        fee: feeLamports.toString(),
        // Additional fields needed by circuit
        recipient_lo: recipientLo.toString(),
        recipient_hi: recipientHi.toString(),
        old_recipient_pk: '0', // TODO: This should come from the note metadata
        note_id: noteId.toString(),
      };
      // Log the payload for debugging
      console.log('[Unshield] Proof input payload:', JSON.stringify({ circuit: 'unshield', input: proofInput }, null, 2));
      const { proofBase64 } = await generateProof('unshield', proofInput);
      const proofBytes = decodeProof(proofBase64);
      
      setStep('building');
      setStatus('Building transaction...');
      
      // Derive PDAs
      const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);
      const [rootsPda] = PublicKey.findProgramAddressSync([Buffer.from('roots')], PROGRAM_ID);
      const [vkPda] = PublicKey.findProgramAddressSync([Buffer.from('vk'), Buffer.from([2])], PROGRAM_ID);
      const [nullifiersPda] = PublicKey.findProgramAddressSync([Buffer.from('nullifiers'), Buffer.from([0, 0])], PROGRAM_ID);
      const [treasuryPda] = PublicKey.findProgramAddressSync([Buffer.from('treasury')], PROGRAM_ID);
      
      // Build unshield instruction
      const proofLen = Buffer.alloc(4);
      proofLen.writeUInt32LE(proofBytes.length, 0);
      const publicInputsLen = Buffer.alloc(4);
      publicInputsLen.writeUInt32LE(6, 0); // root, nullifier, recipient_lo, recipient_hi, amount, fee

      // Nullifier already computed for proof input
      const nullifierBytes = toLittleEndianBytes(nullifier, 32);

      // Recipient limbs (public input 3, 4)
      const recipientLoBytes = toLittleEndianBytes(recipientLo, 32);
      const recipientHiBytes = toLittleEndianBytes(recipientHi, 32);
      console.log('[Unshield] Recipient limb bytes (LE)', {
        lo: recipientLoBytes.slice(0, 16).toString('hex'),
        hi: recipientHiBytes.slice(0, 16).toString('hex'),
      });

      // Amount (public input 5)
      const amountBytes = toLittleEndianBytes(unshieldAmountLamports, 32);
      console.log('[Unshield] Amount bytes (LE)', amountBytes
        .slice(0, 8)
        .toString('hex'));

      // Fee (public input 6)
      const feeBytes = toLittleEndianBytes(feeLamports, 32);

      // Merkle root (public input 1)
      const rootBigInt = BigInt(`0x${rootHex.replace(/^0x/, '')}`);
      const rootBytes = toLittleEndianBytes(rootBigInt, 32);
      console.log('[Unshield] Root bytes (LE)', rootBytes.slice(0, 16).toString('hex'));

      const unshieldData = Buffer.concat([
        UNSHIELD_DISCRIMINATOR,
        proofLen,
        Buffer.from(proofBytes),
        publicInputsLen,
        rootBytes,
        nullifierBytes,
        recipientLoBytes,
        recipientHiBytes,
        amountBytes,
        feeBytes,
      ]);
      
      const unshieldKeys = [
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: vkPda, isSigner: false, isWritable: false },
        { pubkey: rootsPda, isSigner: false, isWritable: false },
        { pubkey: nullifiersPda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: true },
        { pubkey: recipientPubkey, isSigner: false, isWritable: true },
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ];
      const unshieldIx = new TransactionInstruction({ keys: unshieldKeys, programId: PROGRAM_ID, data: unshieldData });
      
      setStep('sending');
      setStatus('Sending transaction to network...');
      
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      const transaction = new Transaction({ feePayer: publicKey, blockhash, lastValidBlockHeight })
        .add(unshieldIx);
      const signed = await signTransaction(transaction);
      
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
      
      setTxSig(signature);
      setStep('confirming');
      setStatus('Confirming transaction... (this may take 30-60 seconds)');
      
      const confirmation = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      
      // Mark note as spent
      await markNoteAsSpent(selectedNote.commitment);
      
      setStep('success');
      setStatus(`✅ Unshield successful! Withdrew ${unshieldAmount} SOL to ${recipientPubkey.toBase58().slice(0, 8)}...`);
    } catch (err: unknown) {
      console.error('[Unshield] Error encountered during flow:', err);
      setStep('error');
      
      const error = err as {
        message?: string;
        logs?: string[];
        signature?: string;
        getLogs?: (conn: unknown) => Promise<string[]>;
      };
      let resolvedLogs: string[] | undefined;
      if (err instanceof SendTransactionError) {
        try {
          resolvedLogs = await err.getLogs(connection);
          if (resolvedLogs?.length) {
            console.error('[Unshield] Transaction logs:', resolvedLogs);
          }
        } catch (logErr) {
          console.error('[Unshield] Failed to fetch transaction logs:', logErr);
        }
      } else if (typeof error?.getLogs === 'function') {
        try {
          resolvedLogs = await error.getLogs(connection);
          if (resolvedLogs?.length) {
            console.error('[Unshield] Transaction logs:', resolvedLogs);
          }
        } catch (logErr) {
          console.error('[Unshield] Failed to fetch transaction logs:', logErr);
        }
      }

      let errorMsg = error?.message || String(err);
      let details = '';
      
      // Parse specific error types for better UX
      if (errorMsg.includes('Transaction was not confirmed')) {
        errorMsg = 'Transaction timeout - it may still be processing';
        details = 'Check the transaction in Solana Explorer. If it failed, try again with a higher priority fee.';
      } else if (errorMsg.includes('simulation failed')) {
        errorMsg = 'Transaction simulation failed';
        details =
          resolvedLogs?.join('\n') ||
          error?.logs?.join('\n') ||
          'This usually means:\n- Insufficient SOL for transaction fees\n- Invalid proof\n- Program state mismatch';
      } else if (errorMsg.includes('Blockhash not found')) {
        errorMsg = 'Network congestion detected';
        details = 'The transaction expired before confirmation. Please try again.';
      } else if (errorMsg.includes('User rejected')) {
        errorMsg = 'Transaction cancelled';
        details = 'You rejected the transaction in your wallet.';
      } else if (errorMsg.includes('Insufficient funds')) {
        errorMsg = 'Insufficient funds';
        details = 'You need more SOL in your wallet to pay for transaction fees (not the unshield amount).';
      } else if (errorMsg.includes('not in the Merkle tree')) {
        errorMsg = 'Note not found in indexer';
        details = errorMsg; // Already has detailed explanation
      } else if (errorMsg.includes('Merkle root missing')) {
        errorMsg = 'Merkle root not registered on-chain';
        details = errorMsg;
      } else if (errorMsg.includes('still pending on-chain')) {
        errorMsg = 'Merkle root pending on-chain';
        details = errorMsg;
      } else if (errorMsg.includes('Invalid recipient address')) {
        errorMsg = 'Invalid recipient address';
        details = 'Please enter a valid Solana address (Base58 format).';
      } else if (errorMsg.includes('exceeds note balance')) {
        errorMsg = 'Amount exceeds note balance';
        details = `The selected note has ${selectedNote?.amount} SOL.`;
      }
      
      setStatus(`❌ Error: ${errorMsg}`);
      setErrorDetails(details);
      
      if (!txSig && error?.signature) {
        setTxSig(error.signature);
      }

      if (!details && resolvedLogs?.length) {
        setErrorDetails(resolvedLogs.join('\n'));
      }
    }
  };

  const getStepStatus = (currentStep: string) => {
    const steps = ['computing', 'building', 'sending', 'confirming'];
    const currentIndex = steps.indexOf(step);
    const stepIndex = steps.indexOf(currentStep);
    
    if (step === 'error') return stepIndex <= currentIndex ? '❌' : '⏸️';
    if (step === 'success') return '✅';
    if (stepIndex < currentIndex) return '✅';
    if (stepIndex === currentIndex) return '⏳';
    return '⏸️';
  };

  return (
    <div className={styles.page}>
      <Navigation />
      
      <header className={styles.header}>
        <h1 className={styles.title}>🔓 Unshield (Withdraw)</h1>
        <p className={styles.description}>Withdraw funds from the privacy pool to your wallet</p>
      </header>

      <div className={styles.container}>
        {!publicKey ? (
          <div className={styles.card}>
            <p className={styles.emptyState}>
              Please connect your wallet to continue
            </p>
          </div>
        ) : availableNotes.length === 0 ? (
          <div className={styles.card}>
            <p className={styles.emptyState}>
              No private balance available. Shield some SOL first.
            </p>
          </div>
        ) : (
          <div className={styles.card}>
            <div className={styles.inputSection}>
              <label className={styles.label}>Select Note to Withdraw:</label>
              <select
                value={selectedNoteIndex}
                onChange={(e) => setSelectedNoteIndex(Number(e.target.value))}
                className={styles.input}
                disabled={step !== 'idle' && step !== 'error' && step !== 'success'}
                aria-label="Select note to unshield"
              >
                {availableNotes.map((note, index) => (
                  <option key={note.commitment} value={index}>
                    Note #{index + 1}: {note.amount} SOL
                  </option>
                ))}
              </select>
              
              {selectedNote && (
                <div className={styles.noteStatusBox}>
                  <p>📝 Note Status:</p>
                  <p>✓ Added to Merkle tree</p>
                  <p>✓ Amount: {selectedNote.amount} SOL</p>
                  <p>✓ Transaction: {selectedNote.txSignature ? `${selectedNote.txSignature.slice(0, 12)}...` : 'N/A'}</p>
                  <p>Ready to unshield when Merkle roots are published on-chain</p>
                </div>
              )}
              
              <p className={styles.inputHint}>
                ⚠️ You must withdraw the <strong>full note amount</strong> ({unshieldAmount} SOL)
              </p>
            </div>

            <div className={styles.inputSection}>
              <label className={styles.label}>Recipient Address (optional):</label>
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder={publicKey?.toBase58() || 'Your wallet address'}
                className={styles.input}
                disabled={step !== 'idle' && step !== 'error' && step !== 'success'}
                aria-label="Recipient Solana address"
              />
              <p className={styles.inputHint}>Leave empty to withdraw to your connected wallet</p>
            </div>
          </div>
        )}

        {step !== 'idle' && step !== 'success' && (
          <div className={styles.progressBox}>
            <h3 className={styles.progressTitle}>Processing Steps:</h3>
            <div className={styles.progressSteps}>
              <div className={styles.stepRow}>
                <span className={styles.stepIcon}>{getStepStatus('computing')}</span>
                <span className={styles.stepText}>Computing proof</span>
              </div>
              <div className={styles.stepRow}>
                <span className={styles.stepIcon}>{getStepStatus('building')}</span>
                <span className={styles.stepText}>Building transaction</span>
              </div>
              <div className={styles.stepRow}>
                <span className={styles.stepIcon}>{getStepStatus('sending')}</span>
                <span className={styles.stepText}>Sending to network</span>
              </div>
              <div className={styles.stepRow}>
                <span className={styles.stepIcon}>{getStepStatus('confirming')}</span>
                <span className={styles.stepText}>Confirming on-chain (30-60s)</span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleUnshield}
          disabled={!publicKey || !selectedNote || (step !== 'idle' && step !== 'error' && step !== 'success')}
          className={`${styles.button} ${styles.buttonPrimary}`}
        >
          {!publicKey ? '🔌 Connect Wallet' :
           availableNotes.length === 0 ? '🛡️ Shield SOL First' :
           step === 'computing' || step === 'building' ? '⏳ Preparing...' :
           step === 'sending' ? '📤 Sending...' :
           step === 'confirming' ? '⏳ Confirming...' :
           `🔓 Withdraw ${unshieldAmount} SOL`}
        </button>

        {status && (
          <div className={`${styles.statusBox} ${
            step === 'success' ? styles.statusBoxSuccess :
            step === 'error' ? styles.statusBoxError :
            styles.statusBoxIdle
          }`}>
            <p className={styles.statusMessage}>{status}</p>

            {errorDetails && <div className={styles.errorDetails}>{errorDetails}</div>}

            {txSig && (
              <>
                <a
                  href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.txLink}
                >
                  View on Solana Explorer →
                </a>
                <div className={styles.txSignature}>{txSig}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
