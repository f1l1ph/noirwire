'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import styles from '../dashboard/page.module.css';

export default function DefiPage() {
  const router = useRouter();

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
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>DeFi</h1>
          <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>
            Access decentralized finance protocols with zero-knowledge privacy.
          </p>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '1rem',
              padding: '3rem 2rem',
              maxWidth: '800px',
              margin: '0 auto',
            }}
          >
            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚧</p>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#f97316' }}>
              Coming Soon
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: 1.6 }}>
              We're working on integrating private DeFi capabilities including:
            </p>
            <ul
              style={{
                color: '#9ca3af',
                fontSize: '0.875rem',
                listStyle: 'none',
                padding: 0,
                marginTop: '1.5rem',
              }}
            >
              <li style={{ marginBottom: '0.5rem' }}>• Private swaps and liquidity provision</li>
              <li style={{ marginBottom: '0.5rem' }}>• Shielded staking and yield farming</li>
              <li style={{ marginBottom: '0.5rem' }}>• Anonymous lending and borrowing</li>
              <li style={{ marginBottom: '0.5rem' }}>• Private governance participation</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
