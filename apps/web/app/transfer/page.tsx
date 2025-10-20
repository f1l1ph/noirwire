'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, TransactionInstruction, Transaction, SystemProgram } from '@solana/web3.js';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { deriveBlindingFactor, getNextNoteIndex } from '../../lib/notes';
import { computeCommitment, fieldToBuffer, bufferToField } from '../../lib/crypto';
import {
  deriveSecretKey,
  generateNoteId,
  getMerkleProof
} from '../../lib/privacyUtils';
import { generateProof, decodeProof } from '../../lib/proofService';
import { Note, ProcessingStep, TransferInput } from '../../lib/types';
import { useWalletData } from '../context/WalletDataContext';
import styles from '../components/TransactionLayout.module.css';
import Navigation from '../components/Navigation';

const PROGRAM_ID = new PublicKey('Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz');
const TRANSFER_DISCRIMINATOR = Buffer.from([131, 57, 253, 234, 98, 101, 37, 157]);

export default function TransferPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { getUnspentNotes, markNoteAsSpent, addNote, privateBalance } = useWalletData();
  const [recipientZkAddress, setRecipientZkAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [status, setStatus] = useState('');
  const [txSig, setTxSig] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  const [availableNotes, setAvailableNotes] = useState<Note[]>([]);
  const [totalBalance, setTotalBalance] = useState('0');
  const [copiedMyZkAddress, setCopiedMyZkAddress] = useState(false);

  const myZkAddress = useMemo(() => {
    if (!publicKey) return null;
    const field = bufferToField(new Uint8Array(publicKey.toBuffer()));
    return `0x${field.toString(16).padStart(64, '0')}`;
  }, [publicKey]);

  const handleCopyMyZkAddress = useCallback(async () => {
    if (!myZkAddress) return;
    try {
      await navigator.clipboard.writeText(myZkAddress);
      setCopiedMyZkAddress(true);
      setTimeout(() => setCopiedMyZkAddress(false), 2000);
    } catch (error) {
      console.error('Failed to copy ZK address:', error);
    }
  }, [myZkAddress]);

  // Auto-calculate fee as 0.1% of transfer amount with minimum 0.0001 SOL
  const DEFAULT_FEE_RATE = 0.001;
  const MIN_FEE = 0.0001;

  const calculateFee = (amount: string): number => {
    const amountNum = parseFloat(amount) || 0;
    const calculatedFee = amountNum * DEFAULT_FEE_RATE;
    return Math.max(calculatedFee, MIN_FEE);
  };

  const fee = transferAmount ? calculateFee(transferAmount).toFixed(4) : '0.0001';

  // Load available notes from context
  useEffect(() => {
    if (!publicKey) {
      setAvailableNotes([]);
      setTotalBalance('0');
      return;
    }

    const notes = getUnspentNotes();
    setAvailableNotes(notes);
    setTotalBalance(privateBalance.toFixed(4));
  }, [publicKey, getUnspentNotes, privateBalance]);

  // Auto-select the best note (one that can cover transfer + fee)
  const getSelectedNote = (): Note | undefined => {
    if (!transferAmount || availableNotes.length === 0) return undefined;
    
    const transferAmountNum = parseFloat(transferAmount);
    const feeNum = parseFloat(fee);
    const totalNeeded = transferAmountNum + feeNum;

    // Find the smallest note that can cover the amount
    const suitableNotes = availableNotes
      .filter(note => parseFloat(note.amount) >= totalNeeded)
      .sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));

    return suitableNotes[0] || availableNotes[0];
  };

  const selectedNote = getSelectedNote();

  const handleTransfer = async () => {
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
      setErrorDetails('You need to shield some SOL first before you can transfer. Go to the Shield page to deposit SOL into the privacy pool.');
      return;
    }

    // Validation: Recipient address entered
    if (!recipientZkAddress || recipientZkAddress.trim() === '') {
      setStep('error');
      setStatus('❌ Recipient ZK address required');
      setErrorDetails('Please enter the recipient\'s ZK address (16-byte hex string, e.g., 0x1234567890abcdef...).');
      return;
    }

    // Validation: Amount entered
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      setStep('error');
      setStatus('❌ Invalid amount');
      setErrorDetails('Please enter a valid amount greater than 0 SOL.');
      return;
    }

    // Validation: Has a note that can cover the amount
    if (!selectedNote) {
      setStep('error');
      setStatus('❌ No suitable note found');
      setErrorDetails(`You need at least ${(parseFloat(transferAmount) + parseFloat(fee)).toFixed(4)} SOL in a single note. Your current notes: ${availableNotes.map(n => n.amount).join(', ')} SOL.`);
      return;
    }

    try {
      setStep('computing');
      setStatus('Computing transfer proof...');
      setTxSig('');
      setErrorDetails('');
      
      // Parse amounts
      const transferAmountLamports = BigInt(Math.floor(parseFloat(transferAmount) * 1e9));
      const feeLamports = BigInt(Math.floor(parseFloat(fee) * 1e9));
      const oldAmountLamports = BigInt(Math.floor(parseFloat(selectedNote.amount) * 1e9));
      
      // Validate amounts
      if (transferAmountLamports + feeLamports > oldAmountLamports) {
        throw new Error('Transfer amount + fee exceeds note balance');
      }
      
      // Validate transfer amount is positive
      if (transferAmountLamports <= 0n) {
        throw new Error('Transfer amount must be greater than 0');
      }
      
      // Derive secret key
      const secretKey = await deriveSecretKey(publicKey.toBase58());
      
      // Get Merkle proof from shield tree (where the note was created)
      // Note: For transfer, we spend a note from the shield tree
      setStatus('Fetching Merkle proof from indexer...');
      let merkleProof;
      try {
        merkleProof = await getMerkleProof(selectedNote.commitment, 'shield');
      } catch (proofErr) {
        const proofError = proofErr as Error;
        if (proofError.message.includes('No commitments found')) {
          throw new Error(
            'Your note is not in the Merkle tree yet. This can happen if:\n' +
            '1. The note was just created (wait a few seconds)\n' +
            '2. The indexer was restarted (notes are stored locally but tree needs rebuilding)\n' +
            '3. You need to manually add the commitment to the indexer\n\n' +
            `Commitment: ${selectedNote.commitment.slice(0, 16)}...`
          );
        }
        throw proofErr; // Re-throw other errors
      }
      const { path, pathPositions } = merkleProof;
      
      // Parse recipient ZK address (hex format like 0x1234...)
      let recipientPk: bigint;
      let normalizedRecipientAddress = '';
      try {
        // Remove 0x prefix if present
        const zkAddressHex = recipientZkAddress.startsWith('0x')
          ? recipientZkAddress.slice(2)
          : recipientZkAddress;

        if (zkAddressHex.length !== 64) {
          throw new Error('ZK address must be 64 hex characters (32 bytes)');
        }

        const sanitized = zkAddressHex.toLowerCase();
        recipientPk = BigInt('0x' + sanitized);
        normalizedRecipientAddress = `0x${sanitized}`;
      } catch {
        throw new Error('Invalid ZK address format. Use format: 0x1234567890abcdef...');
      }
      
      // Generate new note for recipient
      const walletAddress = publicKey.toBase58();
      const newNoteIndex = getNextNoteIndex(walletAddress);
      const newBlinding = await deriveBlindingFactor(walletAddress, newNoteIndex);
      const newCommitment = await computeCommitment(recipientPk, transferAmountLamports, newBlinding);
      
      // Generate note ID
      const noteId = generateNoteId(selectedNote.commitment);
      
      // Convert full 32-byte public key to field element
      const senderPk = bufferToField(new Uint8Array(publicKey.toBuffer()));
      
      // Build proof input
      const proofInput: TransferInput = {
        secret_sk: secretKey.toString(),
        old_recipient_pk: senderPk.toString(),
        old_amount: oldAmountLamports.toString(),
        old_blinding: selectedNote.blinding,
        note_id: noteId.toString(),
        merkle_path: path,
        merkle_path_positions: pathPositions,
        new_recipient_pk: recipientPk.toString(),
        new_amount: transferAmountLamports.toString(),
        new_blinding: newBlinding.toString(),
        fee: feeLamports.toString(),
      };
      
      const { proofBase64 } = await generateProof('transfer', proofInput);
      const proofBytes = decodeProof(proofBase64);
      
      setStep('building');
      setStatus('Building transaction...');
      
      // Derive PDAs
      const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);
      const [rootsPda] = PublicKey.findProgramAddressSync([Buffer.from('roots')], PROGRAM_ID);
      const [vkPda] = PublicKey.findProgramAddressSync([Buffer.from('vk'), Buffer.from([1])], PROGRAM_ID);
      const [nullifiersPda] = PublicKey.findProgramAddressSync([Buffer.from('nullifiers'), Buffer.from([0, 0])], PROGRAM_ID);
      
      // Build transfer instruction
      const proofLen = Buffer.alloc(4);
      proofLen.writeUInt32LE(proofBytes.length, 0);
      const publicInputsLen = Buffer.alloc(4);
      publicInputsLen.writeUInt32LE(2, 0);
      
      // Compute nullifier (public input 1) - Poseidon(secret_sk, note_id)
      const { computeNullifier } = await import('../../lib/privacyUtils');
      const nullifier = await computeNullifier(secretKey, noteId);
      const nullifierBytes = fieldToBuffer(nullifier);
      
      // New commitment (public input 2)
      const newCommitmentBytes = fieldToBuffer(newCommitment);
      
      const transferData = Buffer.concat([
        TRANSFER_DISCRIMINATOR,
        proofLen,
        Buffer.from(proofBytes),
        publicInputsLen,
        Buffer.from(nullifierBytes),
        Buffer.from(newCommitmentBytes),
      ]);
      
      const transferKeys = [
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: vkPda, isSigner: false, isWritable: false },
        { pubkey: rootsPda, isSigner: false, isWritable: false },
        { pubkey: nullifiersPda, isSigner: false, isWritable: true },
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ];
      const transferIx = new TransactionInstruction({ keys: transferKeys, programId: PROGRAM_ID, data: transferData });
      
      setStep('sending');
      setStatus('Sending transaction to network...');
      
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      const transaction = new Transaction({ feePayer: publicKey, blockhash, lastValidBlockHeight })
        .add(transferIx);
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
      
      // Mark old note as spent
      await markNoteAsSpent(selectedNote.commitment);
      
      const newCommitmentHex = newCommitment.toString(16).padStart(64, '0');
      
      // Add new commitment to indexer (transfer tree)
      setStatus('Adding commitment to indexer...');
      try {
        // Debug: Log the actual values
        console.log(`[Transfer] newCommitmentHex type: ${typeof newCommitmentHex}, value:`, newCommitmentHex);
        console.log(`[Transfer] newCommitment type: ${typeof newCommitment}, value:`, newCommitment);
        
        if (!newCommitmentHex || typeof newCommitmentHex !== 'string') {
          throw new Error(`New commitment hash is invalid: type=${typeof newCommitmentHex}, value=${newCommitmentHex}`);
        }
        
        const { addCommitmentToIndexer } = await import('../../lib/indexerClient');
        console.log(`[Transfer] About to add commitment: ${newCommitmentHex.slice(0, 16)}...`);
        const result = await addCommitmentToIndexer('transfer', newCommitmentHex);
        console.log(`[Transfer] Commitment added to indexer successfully at index ${result.index}`);
      } catch (indexerErr) {
        console.error('[Transfer] Failed to add commitment to indexer:', indexerErr);
        console.error('[Transfer] Error details:', {
          name: (indexerErr as Error).name,
          message: (indexerErr as Error).message,
          stack: (indexerErr as Error).stack,
        });
        // Don't fail the whole operation if indexer fails
      }
      
      // Save new note for recipient
      await addNote({
        commitment: newCommitmentHex,
        blinding: newBlinding.toString(),
        amount: transferAmount,
        recipient: normalizedRecipientAddress || recipientZkAddress,
        timestamp: Date.now(),
        txSignature: signature,
        spent: false,
      });
      
      setStep('success');
      setStatus('✅ Transfer successful! New note added to Merkle tree.');
    } catch (err: unknown) {
      console.error('Transfer error:', err);
      setStep('error');
      
      const error = err as { message?: string; logs?: string[]; signature?: string };
      let errorMsg = error?.message || String(err);
      let details = '';
      
      // Parse specific error types for better UX
      if (errorMsg.includes('Transaction was not confirmed')) {
        errorMsg = 'Transaction timeout - it may still be processing';
        details = 'Check the transaction in Solana Explorer. If it failed, try again with a higher priority fee.';
      } else if (errorMsg.includes('simulation failed')) {
        errorMsg = 'Transaction simulation failed';
        details = error?.logs?.join('\n') || 'This usually means:\n- Insufficient SOL for transaction fees\n- Invalid proof\n- Program state mismatch';
      } else if (errorMsg.includes('Blockhash not found')) {
        errorMsg = 'Network congestion detected';
        details = 'The transaction expired before confirmation. Please try again.';
      } else if (errorMsg.includes('User rejected')) {
        errorMsg = 'Transaction cancelled';
        details = 'You rejected the transaction in your wallet.';
      } else if (errorMsg.includes('Insufficient funds')) {
        errorMsg = 'Insufficient funds';
        details = 'You need more SOL in your wallet to pay for transaction fees (not the transfer amount).';
      } else if (errorMsg.includes('not in the Merkle tree')) {
        errorMsg = 'Note not found in indexer';
        details = errorMsg; // Already has detailed explanation
      } else if (errorMsg.includes('Invalid ZK address')) {
        errorMsg = 'Invalid recipient ZK address';
        details =
          'The ZK address must be a 32-byte hex string (64 characters). Example: 0x1a2b...';
      } else if (errorMsg.includes('exceeds note balance')) {
        errorMsg = 'Amount exceeds note balance';
        details = `Your selected note has ${selectedNote?.amount} SOL. Please enter a smaller amount (including ${fee} SOL fee).`;
      } else if (errorMsg.includes('ZK address must be 64 hex characters')) {
        errorMsg = 'Invalid ZK address length';
        details =
          'The ZK address must be exactly 64 hex characters (32 bytes). Example: 0x1a2b3c4d5e6f7890abcdef1234567890feedc0ffee1234567890abcdef123456';
      }
      
      setStatus(`❌ Error: ${errorMsg}`);
      setErrorDetails(details);
      
      if (!txSig && error?.signature) {
        setTxSig(error.signature);
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
        <h1 className={styles.title}>🔄 Private Transfer</h1>
        <p className={styles.description}>Transfer funds within the privacy pool anonymously</p>
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
            {myZkAddress && (
              <div className={styles.infoCard}>
                <div className={styles.infoHeader}>
                  <span className={styles.infoIcon}>🛰️</span>
                  <div>
                    <div className={styles.infoTitle}>Your private (ZK) address</div>
                    <div className={styles.infoSubtitle}>
                      Share this string to receive private transfers
                    </div>
                  </div>
                </div>
                <div className={styles.infoAddressRow}>
                  <code>{myZkAddress.slice(0, 18)}…{myZkAddress.slice(-18)}</code>
                  <button
                    type="button"
                    onClick={handleCopyMyZkAddress}
                    className={styles.copyButton}
                  >
                    {copiedMyZkAddress ? '✅ Copied' : 'Copy'}
                  </button>
                </div>
                <div className={styles.infoAddressFull}>{myZkAddress}</div>
              </div>
            )}
            <div className={styles.inputSection}>
              <label className={styles.label}>Your Private Balance:</label>
              <div className={styles.feeDisplay}>
                <span className={styles.feeAmount}>{totalBalance} SOL</span>
              </div>
            </div>

            <div className={styles.inputSection}>
              <label className={styles.label}>Recipient ZK Address:</label>
              <input
                type="text"
                value={recipientZkAddress}
                onChange={(e) => setRecipientZkAddress(e.target.value)}
                placeholder="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
                className={styles.input}
                disabled={step !== 'idle' && step !== 'error' && step !== 'success'}
                aria-label="Recipient ZK address"
              />
              <p className={styles.inputHint}>Paste the recipient&apos;s ZK address (64 hex characters, case-insensitive)</p>
            </div>

            <div className={styles.inputSection}>
              <label className={styles.label}>Amount (SOL):</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                max={totalBalance}
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className={styles.input}
                disabled={step !== 'idle' && step !== 'error' && step !== 'success'}
                aria-label="Transfer amount in SOL"
                placeholder="0.1"
              />
              <p className={styles.inputHint}>
                Fee: {fee} SOL automatically included • Available: {totalBalance} SOL
              </p>
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
          onClick={handleTransfer}
          disabled={!publicKey || !selectedNote || !recipientZkAddress || !transferAmount || (step !== 'idle' && step !== 'error' && step !== 'success')}
          className={`${styles.button} ${styles.buttonPrimary}`}
        >
          {!publicKey ? '🔌 Connect Wallet' :
           availableNotes.length === 0 ? '�️ Shield SOL First' :
           !recipientZkAddress || !transferAmount ? '📝 Fill in details' :
           step === 'computing' || step === 'building' ? '⏳ Preparing...' :
           step === 'sending' ? '📤 Sending...' :
           step === 'confirming' ? '⏳ Confirming...' :
           '🔄 Send Transfer'}
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
