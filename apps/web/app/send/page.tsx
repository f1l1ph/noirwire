'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import styles from '../dashboard/page.module.css';

export default function SendPage() {
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
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Send Tokens</h1>
          <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>
            This feature will allow you to send SOL and SPL tokens to any wallet address.
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
            <p style={{ color: '#f97316' }}>🚧 Coming Soon</p>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Standard token send functionality is being implemented.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
