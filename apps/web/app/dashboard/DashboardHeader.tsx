'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { 
  ClipboardDocumentIcon, 
  CheckIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import styles from './DashboardHeader.module.css';

export default function DashboardHeader() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  
  // Balances
  const [publicBalance, setPublicBalance] = useState<number | null>(null);
  const [privateBalance, setPrivateBalance] = useState<number>(0);
  
  // Copy states
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [copiedPrivate, setCopiedPrivate] = useState(false);
  
  // Privacy toggle
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  
  // Shortened addresses
  const publicAddress = publicKey?.toBase58() || '';
  const publicShort = publicAddress ? `${publicAddress.slice(0, 4)}...${publicAddress.slice(-4)}` : '';
  
  // For demo purposes, using a mock private address
  // In production, this would be derived from your viewing key
  const privateAddress = publicKey ? `priv_${publicAddress.slice(0, 8)}...${publicAddress.slice(-8)}` : '';
  const privateShort = `priv_...${publicAddress.slice(-4)}`;

  // Fetch public balance
  useEffect(() => {
    if (!publicKey || !connection) return;

    const fetchPublicBalance = async () => {
      try {
        const lamports = await connection.getBalance(publicKey);
        setPublicBalance(lamports / LAMPORTS_PER_SOL);
      } catch (err) {
        console.error('Failed to fetch public balance:', err);
      }
    };

    fetchPublicBalance();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchPublicBalance, 10000);
    return () => clearInterval(interval);
  }, [publicKey, connection]);

  // Calculate private balance from unspent notes
  useEffect(() => {
    if (!publicKey) return;

    try {
      // Dynamically import to avoid SSR issues
      const walletAddress = publicKey.toBase58();
      
      // Try to get unspent notes, handle if not available
      import('../../lib/notes').then(({ getUnspentNotes }) => {
        try {
          const unspentNotes = getUnspentNotes(walletAddress);
          const totalLamports = unspentNotes.reduce((sum: bigint, note: { amount: string }) => {
            const amount = typeof note.amount === 'string' ? BigInt(note.amount) : BigInt(0);
            return sum + amount;
          }, BigInt(0));
          setPrivateBalance(Number(totalLamports) / LAMPORTS_PER_SOL);
        } catch (err) {
          console.warn('Failed to fetch private balance:', err);
          setPrivateBalance(0);
        }
      }).catch(err => {
        console.warn('Notes module not available:', err);
        setPrivateBalance(0);
      });
    } catch (err) {
      console.warn('Failed to calculate private balance:', err);
      setPrivateBalance(0);
    }
  }, [publicKey]);

  const copyToClipboard = async (text: string, type: 'public' | 'private') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'public') {
        setCopiedPublic(true);
        setTimeout(() => setCopiedPublic(false), 2000);
      } else {
        setCopiedPrivate(true);
        setTimeout(() => setCopiedPrivate(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!publicKey) return null;

  return (
    <div className={styles.header}>
      <div className={styles.container}>
        {/* Left: Addresses */}
        <div className={styles.section}>
          <div className={styles.addressGroup}>
            {/* Public Address */}
            <div className={styles.addressCard}>
              <div className={styles.addressLabel}>
                <EyeIcon className={styles.icon} />
                <span>Public</span>
              </div>
              <div className={styles.addressValue}>
                <span className={styles.address} title={publicAddress}>
                  {publicShort}
                </span>
                <button
                  className={styles.copyButton}
                  onClick={() => copyToClipboard(publicAddress, 'public')}
                  disabled={!publicAddress}
                >
                  {copiedPublic ? (
                    <CheckIcon className={styles.iconSmall} />
                  ) : (
                    <ClipboardDocumentIcon className={styles.iconSmall} />
                  )}
                </button>
              </div>
            </div>

            {/* Private Address */}
            <div className={styles.addressCard}>
              <div className={styles.addressLabel}>
                <EyeSlashIcon className={styles.icon} />
                <span>Private</span>
              </div>
              <div className={styles.addressValue}>
                <span className={styles.address} title={showPrivateKey ? privateAddress : ''}>
                  {showPrivateKey ? privateAddress : privateShort}
                </span>
                <button
                  className={styles.toggleButton}
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                >
                  {showPrivateKey ? (
                    <EyeSlashIcon className={styles.iconSmall} />
                  ) : (
                    <EyeIcon className={styles.iconSmall} />
                  )}
                </button>
                <button
                  className={styles.copyButton}
                  onClick={() => copyToClipboard(privateAddress, 'private')}
                  disabled={!publicAddress}
                >
                  {copiedPrivate ? (
                    <CheckIcon className={styles.iconSmall} />
                  ) : (
                    <ClipboardDocumentIcon className={styles.iconSmall} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Balances */}
        <div className={styles.section}>
          <div className={styles.balanceGroup}>
            {/* Public Balance */}
            <div className={styles.balanceCard}>
              <div className={styles.balanceLabel}>Public Balance</div>
              <div className={styles.balanceValue}>
                {publicBalance !== null ? (
                  <>
                    <span className={styles.amount}>{publicBalance.toFixed(4)}</span>
                    <span className={styles.currency}>SOL</span>
                  </>
                ) : (
                  <span className={styles.loading}>...</span>
                )}
              </div>
            </div>

            {/* Private Balance */}
            <div className={styles.balanceCard}>
              <div className={styles.balanceLabel}>Private Balance</div>
              <div className={styles.balanceValue}>
                <span className={styles.amount}>{privateBalance.toFixed(4)}</span>
                <span className={styles.currency}>SOL</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Network Info */}
        <div className={styles.section}>
          <div className={styles.networkCard}>
            <div className={styles.networkStatus}>
              <div className={styles.statusDot}></div>
              <span className={styles.networkText}>Devnet</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
