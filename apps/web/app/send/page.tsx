'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { 
  PublicKey, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import { useState } from 'react';
import Navigation from '../components/Navigation';
import styles from '../components/TransactionLayout.module.css';

type TokenType = 'SOL' | 'SPL';

export default function SendPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [tokenType, setTokenType] = useState<TokenType>('SOL');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenMint, setTokenMint] = useState('');
  const [status, setStatus] = useState('');
  const [txSig, setTxSig] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorDetails, setErrorDetails] = useState('');

  const handleSend = async () => {
    if (!publicKey || !signTransaction) {
      setStatus('❌ Please connect your wallet first');
      return;
    }

    if (!recipient || !amount) {
      setStatus('❌ Please fill in all fields');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setStatus('❌ Invalid amount');
      return;
    }

    if (tokenType === 'SPL' && !tokenMint) {
      setStatus('❌ Please enter token mint address');
      return;
    }

    try {
      setIsProcessing(true);
      setStatus('Building transaction...');
      setTxSig('');
      setErrorDetails('');

      let recipientPubkey: PublicKey;
      try {
        recipientPubkey = new PublicKey(recipient);
      } catch {
        throw new Error('Invalid recipient address');
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      const transaction = new Transaction({
        feePayer: publicKey,
        blockhash,
        lastValidBlockHeight,
      });

      if (tokenType === 'SOL') {
        // Send SOL
        const lamports = Math.floor(amountNum * LAMPORTS_PER_SOL);
        
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipientPubkey,
            lamports,
          })
        );

        setStatus(`Sending ${amountNum} SOL...`);
      } else {
        // Send SPL Token
        let mintPubkey: PublicKey;
        try {
          mintPubkey = new PublicKey(tokenMint);
        } catch {
          throw new Error('Invalid token mint address');
        }

        // Get token accounts
        const senderTokenAccount = await getAssociatedTokenAddress(
          mintPubkey,
          publicKey
        );

        const recipientTokenAccount = await getAssociatedTokenAddress(
          mintPubkey,
          recipientPubkey
        );

        // Check if sender has tokens
        try {
          const senderAccount = await getAccount(connection, senderTokenAccount);
          
          // Get token decimals (default to 9 if we can't fetch)
          const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
          const parsedData = mintInfo.value?.data as { parsed?: { info?: { decimals?: number } } } | null;
          const decimals = parsedData?.parsed?.info?.decimals || 9;
          const transferAmount = Math.floor(amountNum * Math.pow(10, decimals));

          if (senderAccount.amount < BigInt(transferAmount)) {
            throw new Error(`Insufficient token balance`);
          }

          // Check if recipient token account exists
          let recipientAccountExists = true;
          try {
            await getAccount(connection, recipientTokenAccount);
          } catch {
            recipientAccountExists = false;
          }

          // Create recipient token account if it doesn't exist
          if (!recipientAccountExists) {
            setStatus('Creating recipient token account...');
            transaction.add(
              createAssociatedTokenAccountInstruction(
                publicKey, // payer
                recipientTokenAccount,
                recipientPubkey,
                mintPubkey
              )
            );
          }

          // Add transfer instruction
          transaction.add(
            createTransferInstruction(
              senderTokenAccount,
              recipientTokenAccount,
              publicKey,
              transferAmount
            )
          );

          setStatus(`Sending ${amountNum} tokens...`);
        } catch (error) {
          if (error instanceof Error && error.message.includes('could not find account')) {
            throw new Error('You don\'t have any of this token. Make sure the mint address is correct.');
          }
          throw error;
        }
      }

      setStatus('Signing transaction...');
      const signed = await signTransaction(transaction);

      setStatus('Sending to network...');
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      setTxSig(signature);
      setStatus('Confirming transaction...');

      const confirmation = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      setStatus(`✅ Successfully sent ${amountNum} ${tokenType}!`);
      
      // Reset form
      setAmount('');
      setRecipient('');
      if (tokenType === 'SPL') setTokenMint('');
    } catch (err) {
      console.error('Send error:', err);
      const error = err as Error;
      let errorMsg = error.message || String(err);
      let details = '';

      if (errorMsg.includes('Insufficient')) {
        details = 'You don\'t have enough balance to send this amount plus transaction fees.';
      } else if (errorMsg.includes('Invalid')) {
        details = errorMsg;
      } else if (errorMsg.includes('User rejected')) {
        errorMsg = 'Transaction cancelled';
        details = 'You rejected the transaction in your wallet.';
      }

      setStatus(`❌ Error: ${errorMsg}`);
      setErrorDetails(details);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.page}>
      <Navigation />

      <header className={styles.header}>
        <h1 className={styles.title}>💸 Send Funds</h1>
        <p className={styles.description}>Send SOL or SPL tokens to any wallet</p>
      </header>

      <div className={styles.container}>
        {!publicKey ? (
          <div className={styles.card}>
            <p className={styles.emptyState}>
              Please connect your wallet to continue
            </p>
          </div>
        ) : (
          <div className={styles.card}>
            {/* Token Type Selection */}
            <div className={styles.inputSection}>
              <label className={styles.label}>Token Type:</label>
              <div className={styles.tokenTypeToggle}>
                <button
                  onClick={() => setTokenType('SOL')}
                  className={`${styles.tokenTypeButton} ${tokenType === 'SOL' ? styles.tokenTypeButtonActive : ''}`}
                  disabled={isProcessing}
                >
                  SOL
                </button>
                <button
                  onClick={() => setTokenType('SPL')}
                  className={`${styles.tokenTypeButton} ${tokenType === 'SPL' ? styles.tokenTypeButtonActive : ''}`}
                  disabled={isProcessing}
                >
                  SPL Token
                </button>
              </div>
            </div>

            {/* SPL Token Mint (only for SPL) */}
            {tokenType === 'SPL' && (
              <div className={styles.inputSection}>
                <label className={styles.label}>Token Mint Address:</label>
                <input
                  type="text"
                  value={tokenMint}
                  onChange={(e) => setTokenMint(e.target.value)}
                  placeholder="e.g., EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v (USDC)"
                  className={styles.input}
                  disabled={isProcessing}
                />
                <p className={styles.inputHint}>
                  Enter the mint address of the SPL token you want to send
                </p>
              </div>
            )}

            {/* Recipient Address */}
            <div className={styles.inputSection}>
              <label className={styles.label}>Recipient Address:</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Enter Solana wallet address"
                className={styles.input}
                disabled={isProcessing}
              />
              <p className={styles.inputHint}>
                The Solana address that will receive the {tokenType}
              </p>
            </div>

            {/* Amount */}
            <div className={styles.inputSection}>
              <label className={styles.label}>Amount:</label>
              <input
                type="number"
                step="0.000001"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={tokenType === 'SOL' ? '0.1' : '1.0'}
                className={styles.input}
                disabled={isProcessing}
              />
              <p className={styles.inputHint}>
                Amount to send (excluding network fees)
              </p>
            </div>

            {/* Info Box */}
            <div className={styles.infoBox}>
              <h3 className={styles.infoTitle}>ℹ️ Important Notes:</h3>
              <ul className={styles.infoList}>
                <li>
                  <strong>SOL:</strong> Standard Solana transfer (~0.000005 SOL fee)
                </li>
                <li>
                  <strong>SPL Tokens:</strong> If recipient doesn&apos;t have a token account, 
                  one will be created (~0.002 SOL fee)
                </li>
                <li>Double-check the recipient address before sending</li>
                <li>Transactions are irreversible once confirmed</li>
              </ul>
            </div>
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={!publicKey || !recipient || !amount || isProcessing || (tokenType === 'SPL' && !tokenMint)}
          className={`${styles.button} ${styles.buttonPrimary}`}
        >
          {!publicKey ? '🔌 Connect Wallet' :
           !recipient || !amount ? '📝 Fill in details' :
           tokenType === 'SPL' && !tokenMint ? '📝 Enter token mint' :
           isProcessing ? '⏳ Processing...' :
           `💸 Send ${amount || '0'} ${tokenType}`}
        </button>

        {/* Status Display */}
        {status && (
          <div className={`${styles.statusBox} ${
            status.startsWith('✅') ? styles.statusBoxSuccess :
            status.startsWith('❌') ? styles.statusBoxError :
            styles.statusBoxIdle
          }`}>
            <p className={styles.statusMessage}>{status}</p>

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
      </div>
    </div>
  );
}
