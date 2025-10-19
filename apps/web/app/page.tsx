'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { SimpleWalletDisplay } from './components/SimpleWalletDisplay';
import styles from './page.module.css';

export default function Home() {
  const router = useRouter();
  const { connected } = useWallet();

  // Redirect to dashboard if wallet is connected
  useEffect(() => {
    if (connected) {
      router.push('/dashboard');
    }
  }, [connected, router]);

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
        <p>Zero-Knowledge Privacy Layer for Solana</p>
      </footer>
    </div>
  );
}
