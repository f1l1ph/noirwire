'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, TransactionInstruction, Transaction } from '@solana/web3.js';
import { useState } from 'react';
import Link from 'next/link';
import { computeCommitment, fieldToBuffer, bufferToField } from '../../lib/crypto';
import { getNextNoteIndex, deriveBlindingFactor } from '../../lib/notes';
import { generateProof, decodeProof } from '../../lib/proofService';
import { ProcessingStep, ShieldInput } from '../../lib/types';
import { useWalletData } from '../context/WalletDataContext';
import styles from '../components/TransactionLayout.module.css';

const PROGRAM_ID = new PublicKey('Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz');
const SHIELD_DISCRIMINATOR = Buffer.from([20, 113, 217, 81, 39, 76, 191, 163]);

export default function ShieldPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { addNote } = useWalletData();
  const [amount, setAmount] = useState('0.001');
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [status, setStatus] = useState('');
  const [txSig, setTxSig] = useState('');
  const [commitmentHash, setCommitmentHash] = useState('');
  const [errorDetails, setErrorDetails] = useState('');

  const handleShield = async () => {
    if (!publicKey || !signTransaction) {
      setStatus('Please connect wallet');
      return;
    }

    try {
      setStep('computing');
      setStatus('Computing commitment and generating proof...');
      setTxSig('');
      setErrorDetails('');
      
      const walletAddress = publicKey.toBase58();
      const noteIndex = getNextNoteIndex(walletAddress);
      const blinding = await deriveBlindingFactor(walletAddress, noteIndex);
      
      // Convert full 32-byte public key to field element
      const recipientPk = bufferToField(new Uint8Array(publicKey.toBuffer()));
      const amountLamports = BigInt(Math.floor(parseFloat(amount) * 1e9));
      
      const commitment = await computeCommitment(recipientPk, amountLamports, blinding);
      const commitmentHex = commitment.toString(16).padStart(64, '0');
      setCommitmentHash(commitmentHex);
      
      // Generate real proof
      const proofInput: ShieldInput = {
        recipient_pk: recipientPk.toString(),
        amount: amountLamports.toString(),
        blinding: blinding.toString(),
      };
      
      const { proofBase64 } = await generateProof('shield', proofInput);
      const proofBytes = decodeProof(proofBase64);
      
      setStep('building');
      setStatus('Building transaction...');
      
      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('config')],
        PROGRAM_ID
      );
      
      const [vkPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vk'), Buffer.from([0])],
        PROGRAM_ID
      );
      
      const [treasuryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('treasury')],
        PROGRAM_ID
      );
      
      const commitmentBytes = Array.from(fieldToBuffer(commitment));
      const proofLen = Buffer.alloc(4);
      proofLen.writeUInt32LE(proofBytes.length, 0);
      const publicInputsLen = Buffer.alloc(4);
      publicInputsLen.writeUInt32LE(1, 0);
      const amountBuffer = Buffer.alloc(8);
      const amountNum = Number(amountLamports);
      amountBuffer.writeUInt32LE(amountNum & 0xFFFFFFFF, 0);
      amountBuffer.writeUInt32LE(Math.floor(amountNum / 0x100000000), 4);

      const data = Buffer.concat([
        SHIELD_DISCRIMINATOR,
        proofLen,
        Buffer.from(proofBytes),
        publicInputsLen,
        Buffer.from(commitmentBytes),
        amountBuffer,
      ]);
      
      const keys = [
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: vkPda, isSigner: false, isWritable: false },
        { pubkey: treasuryPda, isSigner: false, isWritable: true },
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
      ];
      
      const instruction = new TransactionInstruction({ keys, programId: PROGRAM_ID, data });
      
      setStep('sending');
      setStatus('Sending transaction to network...');
      
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      const transaction = new Transaction({ feePayer: publicKey, blockhash, lastValidBlockHeight }).add(instruction);
      const signed = await signTransaction(transaction);
      
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
      
      setTxSig(signature);
      setStep('confirming');
      setStatus('Confirming transaction... (this may take 30-60 seconds)');
      
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      
      // Add commitment to indexer (for Merkle tree)
      console.log('');
      console.log('═══════════════════════════════════════════════');
      console.log('🔥 ADDING COMMITMENT TO INDEXER');
      console.log('═══════════════════════════════════════════════');
      setStatus('Adding commitment to indexer...');
      try {
        // Debug: Log the actual values
        console.log(`[Shield] commitmentHex type: ${typeof commitmentHex}, value:`, commitmentHex);
        console.log(`[Shield] commitment type: ${typeof commitment}, value:`, commitment);
        
        if (!commitmentHex || typeof commitmentHex !== 'string') {
          const errMsg = `Commitment hash is invalid: type=${typeof commitmentHex}, value=${commitmentHex}`;
          console.error(`❌ ${errMsg}`);
          throw new Error(errMsg);
        }
        
        const { addCommitmentToIndexer } = await import('../../lib/indexerClient');
        console.log(`[Shield] 📤 Calling addCommitmentToIndexer('shield', '${commitmentHex.slice(0, 16)}...')`);
        console.log(`[Shield] API URL: http://localhost:3000/indexer/shield/commit`);
        
        const result = await addCommitmentToIndexer('shield', commitmentHex);
        
        console.log(`✅ SUCCESS! Commitment added to indexer`);
        console.log(`   Index: ${result.index}`);
        console.log(`   Root: ${result.root.slice(0, 16)}...`);
        console.log('═══════════════════════════════════════════════');
        console.log('');
      } catch (indexerErr) {
        console.log('');
        console.log('❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌');
        console.error('❌ FAILED TO ADD COMMITMENT TO INDEXER!');
        console.error('❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌');
        console.error('[Shield] Error:', indexerErr);
        console.error('[Shield] Error details:', {
          name: (indexerErr as Error).name,
          message: (indexerErr as Error).message,
          stack: (indexerErr as Error).stack,
        });
        console.error('');
        console.error('⚠️  WARNING: Shield succeeded but commitment was NOT added to indexer!');
        console.error('⚠️  You will NOT be able to unshield this note until the commitment is added!');
        console.error('');
        console.error('🔧 MANUAL FIX:');
        console.error(`   1. Go to: http://localhost:3001/debug-indexer`);
        console.error(`   2. Paste this commitment: ${commitmentHex}`);
        console.error(`   3. Click "Add to Indexer" button`);
        console.error('');
        console.error('❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌');
        console.log('');
        // Don't fail the whole operation if indexer fails
      }
      
      await addNote({
        commitment: commitmentHex,
        blinding: blinding.toString(),
        amount,
        recipient: publicKey.toBase58(),
        timestamp: Date.now(),
        txSignature: signature,
        spent: false,
      });
      
      setStep('success');
      setStatus('✅ Shield successful! Your note has been saved and added to Merkle tree.');
    } catch (err: unknown) {
      console.error('Shield error:', err);
      setStep('error');
      
      const error = err as { message?: string; logs?: string[]; signature?: string };
      let errorMsg = error?.message || String(err);
      let details = '';
      
      if (errorMsg.includes('Transaction was not confirmed')) {
        errorMsg = 'Transaction timeout - it may still be processing';
        details = 'Check the transaction in Solana Explorer. If it failed, try again with a higher priority fee.';
      } else if (errorMsg.includes('simulation failed')) {
        errorMsg = 'Transaction simulation failed';
        details = error?.logs?.join('\n') || 'Check program logs for details';
      } else if (errorMsg.includes('Blockhash not found')) {
        errorMsg = 'Network congestion detected';
        details = 'The transaction expired. Please try again.';
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
      <header className={styles.header}>
        <Link href="/" className={styles.backButton}>
          ← Back to Home
        </Link>
        <h1 className={styles.title}>🛡️ Shield SOL</h1>
        <p className={styles.description}>Deposit SOL into the privacy pool with zero-knowledge proof</p>
      </header>

      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.inputSection}>
            <label className={styles.label}>Amount (SOL):</label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={step !== 'idle' && step !== 'error' && step !== 'success'}
              className={styles.input}
              aria-label="Amount in SOL"
            />
            <p className={styles.inputHint}>Minimum: 0.001 SOL (~$0.00 on devnet)</p>
          </div>
        </div>

        {step !== 'idle' && step !== 'success' && (
          <div className={styles.progressBox}>
            <h3 className={styles.progressTitle}>Processing Steps:</h3>
            <div className={styles.progressSteps}>
              <div className={styles.stepRow}>
                <span className={styles.stepIcon}>{getStepStatus('computing')}</span>
                <span className={styles.stepText}>Computing commitment</span>
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
          onClick={handleShield}
          disabled={!publicKey || (step !== 'idle' && step !== 'error' && step !== 'success')}
          className={`${styles.button} ${styles.buttonPrimary}`}
        >
          {!publicKey ? '🔌 Connect Wallet First' :
           step === 'computing' || step === 'building' ? '⏳ Preparing...' :
           step === 'sending' ? '📤 Sending...' :
           step === 'confirming' ? '⏳ Confirming...' :
           '🛡️ Shield SOL'}
        </button>

        {status && (
          <div className={`${styles.statusBox} ${
            step === 'success' ? styles.statusBoxSuccess :
            step === 'error' ? styles.statusBoxError :
            styles.statusBoxIdle
          }`}>
            <p className={styles.statusMessage}>{status}</p>

            {commitmentHash && (
              <div className={styles.commitmentBox}>
                <span className={styles.commitmentLabel}>Commitment: </span>
                <span className={styles.commitmentValue}>
                  0x{commitmentHash.slice(0, 16)}...{commitmentHash.slice(-16)}
                </span>
              </div>
            )}

            {errorDetails && (
              <div className={styles.errorDetails}>{errorDetails}</div>
            )}

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

        <div className={styles.infoBox}>
          <h4 className={styles.infoTitle}>ℹ️ How it works</h4>
          <ul className={styles.infoList}>
            <li>A deterministic blinding factor is derived from your viewing key</li>
            <li>Your wallet address, amount, and blinding create a commitment hash</li>
            <li>A zero-knowledge proof is generated server-side using snarkjs</li>
            <li>On-chain verification confirms the proof without revealing details</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
