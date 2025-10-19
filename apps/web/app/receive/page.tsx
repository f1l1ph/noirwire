'use client';

import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { ArrowLeftIcon, QrCodeIcon } from '@heroicons/react/24/outline';
import styles from '../dashboard/page.module.css';

export default function ReceivePage() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();

  const copyAddress = async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey.toBase58());
      alert('Address copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '0.5rem',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            <ArrowLeftIcon style={{ width: '1rem', height: '1rem' }} />
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Receive Tokens</h1>
          
          {connected && publicKey ? (
            <>
              <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>
                Share your wallet address to receive SOL and SPL tokens
              </p>
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '1rem',
                  padding: '2rem',
                  maxWidth: '600px',
                  margin: '0 auto',
                }}
              >
                <QrCodeIcon
                  style={{
                    width: '8rem',
                    height: '8rem',
                    margin: '0 auto 2rem',
                    color: '#a78bfa',
                  }}
                />
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    marginBottom: '1rem',
                    fontFamily: 'var(--font-geist-mono)',
                    fontSize: '0.875rem',
                    color: '#a78bfa',
                    wordBreak: 'break-all',
                  }}
                >
                  {publicKey.toBase58()}
                </div>
                <button
                  onClick={copyAddress}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
                    border: 'none',
                    borderRadius: '0.75rem',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Copy Address
                </button>
                <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '1rem' }}>
                  Note: QR code generation will be added in a future update
                </p>
              </div>
            </>
          ) : (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '1rem',
                padding: '2rem',
                maxWidth: '600px',
                margin: '0 auto',
              }}
            >
              <p style={{ color: '#9ca3af' }}>Please connect your wallet to receive tokens</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
