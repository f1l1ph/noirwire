/**
 * Simple Wallet Display - Beautiful, minimal UI
 * Shows balance and quick actions without technical complexity
 */

'use client';

import dynamic from 'next/dynamic';
import React, { useCallback, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import styles from './SimpleWalletDisplay.module.css';
import { useWalletData } from '../context/WalletDataContext';
import { useWalletBalance } from '../../lib/hooks';
import { bufferToField } from '../../lib/crypto';

function SimpleWalletDisplayClient(): React.ReactElement {
  const { publicKey } = useWallet();
  const { balance: walletBalance } = useWalletBalance();
  const { 
    privateBalance, 
    noteCount, 
    isLoading,
    isLoadingFromSupabase,
    clearAllNotes 
  } = useWalletData();
  const [copiedZkAddress, setCopiedZkAddress] = useState(false);

  const zkAddress = useMemo(() => {
    if (!publicKey) return null;
    const field = bufferToField(new Uint8Array(publicKey.toBuffer()));
    return `0x${field.toString(16).padStart(64, '0')}`;
  }, [publicKey]);

  const handleCopyZkAddress = useCallback(async () => {
    if (!zkAddress) return;
    try {
      await navigator.clipboard.writeText(zkAddress);
      setCopiedZkAddress(true);
      setTimeout(() => setCopiedZkAddress(false), 2000);
    } catch (error) {
      console.error('Failed to copy ZK address:', error);
    }
  }, [zkAddress]);

  /**
   * Clear all notes (for debugging / incompatible notes)
   */
  const handleClearNotes = async () => {
    if (!publicKey) return;
    
    if (confirm('⚠️ This will delete all your private notes. Are you sure?')) {
      await clearAllNotes();
      alert('✅ All notes cleared');
    }
  };

  if (!publicKey) {
    return (
      <div className={styles.container}>
        <div className={styles.connectPrompt}>
          <div className={styles.connectIcon}>🔐</div>
          <h2>Connect Your Wallet</h2>
          <p>Connect to view your balances and start using private payments</p>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.walletHeader}>
        <div className={styles.walletAddress}>
          <span className={styles.addressLabel}>Connected:</span>
          <span className={styles.addressValue}>
            {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
          </span>
        </div>
        <WalletMultiButton />
      </div>

      <div className={styles.balanceCards}>
        <div className={styles.balanceCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>💰</span>
            <span className={styles.cardTitle}>Public Balance</span>
          </div>
          <div className={styles.cardAmount}>
            {walletBalance !== null ? walletBalance.toFixed(4) : '—'}
          </div>
          <div className={styles.cardLabel}>SOL</div>
          <div className={styles.cardSubtext}>Available for transactions</div>
        </div>

        <div className={`${styles.balanceCard} ${styles.balanceCardPrivate}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>🔒</span>
            <span className={styles.cardTitle}>Private Balance</span>
          </div>
          <div className={styles.cardAmount}>
            {isLoadingFromSupabase ? (
              <span className={styles.loading}>Loading...</span>
            ) : (
              <>{privateBalance > 0 ? privateBalance.toFixed(4) : '0.0000'}</>
            )}
          </div>
          <div className={styles.cardLabel}>SOL</div>
          <div className={styles.cardSubtext}>
            {isLoading ? (
              'Loading notes...'
            ) : noteCount > 0 ? (
              `${noteCount} note${noteCount !== 1 ? 's' : ''}`
            ) : (
              'No private funds yet'
            )}
          </div>
        </div>
      </div>

      {zkAddress && (
        <div className={styles.zkAddressCard}>
          <div className={styles.zkAddressHeader}>
            <span className={styles.zkAddressIcon}>🛰️</span>
            <div className={styles.zkAddressText}>
              <span className={styles.zkAddressTitle}>Your Private (ZK) Address</span>
              <span className={styles.zkAddressSubtitle}>
                Share this with other NoirWire users to receive private transfers
              </span>
            </div>
          </div>
          <div className={styles.zkAddressValue}>
            <code>{zkAddress.slice(0, 12)}…{zkAddress.slice(-12)}</code>
            <button
              type="button"
              onClick={handleCopyZkAddress}
              className={styles.copyButton}
            >
              {copiedZkAddress ? '✅ Copied' : 'Copy'}
            </button>
          </div>
          <div className={styles.zkAddressHint}>
            Full address: <code className={styles.zkAddressFull}>{zkAddress}</code>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <Link href="/shield" className={`${styles.actionButton} ${styles.actionButtonShield}`}>
          <span className={styles.actionIcon}>🛡️</span>
          <span className={styles.actionText}>Shield</span>
          <span className={styles.actionDesc}>Deposit into pool</span>
        </Link>

        <Link href="/transfer" className={`${styles.actionButton} ${styles.actionButtonTransfer}`}>
          <span className={styles.actionIcon}>💸</span>
          <span className={styles.actionText}>Transfer</span>
          <span className={styles.actionDesc}>Send privately</span>
        </Link>

        <Link href="/unshield" className={`${styles.actionButton} ${styles.actionButtonUnshield}`}>
          <span className={styles.actionIcon}>🔓</span>
          <span className={styles.actionText}>Unshield</span>
          <span className={styles.actionDesc}>Withdraw funds</span>
        </Link>
      </div>

      {privateBalance === 0 && !isLoading && (
        <div className={styles.getStarted}>
          <h3>🚀 Get Started</h3>
          <p>Shield some SOL to start making private transactions</p>
          <ol>
            <li>Click <strong>Shield</strong> to deposit SOL into the privacy pool</li>
            <li>Use <strong>Transfer</strong> to send funds privately to others</li>
            <li>Click <strong>Unshield</strong> when you want to withdraw</li>
          </ol>
        </div>
      )}

      {noteCount > 0 && (
        <div className={styles.devTools}>
          <button onClick={handleClearNotes} className={styles.clearButton}>
            🗑️ Clear All Notes
          </button>
          <p className={styles.devHint}>Use this if you have incompatible notes from old circuit versions</p>
        </div>
      )}
    </div>
  );
}

export const SimpleWalletDisplay = dynamic(() => Promise.resolve(SimpleWalletDisplayClient), {
  ssr: false,
});
