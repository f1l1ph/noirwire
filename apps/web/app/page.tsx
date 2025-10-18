'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SimpleWalletDisplay } from './components/SimpleWalletDisplay';
import { PROGRAM_ADDRESS, UI_CONFIG } from '../lib/constants';
import styles from './page.module.css';

export default function Home() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const copyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(PROGRAM_ADDRESS.toBase58());
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  // Reset copied state after duration
  useEffect(() => {
    if (!copied) return;

    timerRef.current = setTimeout(
      () => setCopied(false),
      UI_CONFIG.COPY_FEEDBACK_DURATION,
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [copied]);
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>⚡ NoirWire</h1>
        <p>Private Payments on Solana</p>
      </header>

      <main className={styles.main}>
        <SimpleWalletDisplay />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <span className={styles.network}>Solana Devnet</span>
          <span className={styles.separator}>•</span>
          <button 
            onClick={copyAddress}
            className={styles.programId}
            title="Click to copy program ID"
          >
            {PROGRAM_ADDRESS.toBase58().slice(0, 8)}...{PROGRAM_ADDRESS.toBase58().slice(-8)}
            <span className={styles.copyIcon}>{copied ? ' ✓' : ' 📋'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
