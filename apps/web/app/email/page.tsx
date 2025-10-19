'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, EnvelopeIcon, EnvelopeOpenIcon } from '@heroicons/react/24/outline';
import styles from '../dashboard/page.module.css';

// Mock email data
const mockEmails = [
  {
    id: 1,
    from: 'alice@noirwire.eth',
    subject: 'Welcome to NoirWire Email',
    preview: 'Thank you for trying our encrypted email demo. This is a preview of future capabilities...',
    date: '2h ago',
    unread: true,
  },
  {
    id: 2,
    from: 'bob@noirwire.eth',
    subject: 'Private Communication',
    preview: 'End-to-end encrypted email on Solana blockchain. All messages are encrypted client-side...',
    date: '1d ago',
    unread: false,
  },
  {
    id: 3,
    from: 'carol@noirwire.eth',
    subject: 'Demo Feature Showcase',
    preview: 'This demo demonstrates the UI/UX for future email integration with NoirWire messaging...',
    date: '3d ago',
    unread: false,
  },
];

export default function EmailPage() {
  const router = useRouter();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          <span style={{
            background: 'rgba(249, 115, 22, 0.2)',
            color: '#f97316',
            padding: '0.25rem 0.75rem',
            borderRadius: '0.5rem',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}>
            DEMO
          </span>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        {/* Sidebar */}
        <div style={{ width: '300px', borderRight: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(255, 255, 255, 0.02)' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f3f4f6' }}>Inbox</h2>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
              {mockEmails.filter(e => e.unread).length} unread
            </p>
          </div>
          <div>
            {mockEmails.map((email) => (
              <div
                key={email.id}
                style={{
                  padding: '1rem 1.5rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  cursor: 'pointer',
                  background: email.unread ? 'rgba(167, 139, 250, 0.05)' : 'transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {email.unread ? (
                    <EnvelopeIcon style={{ width: '1rem', height: '1rem', color: '#a78bfa' }} />
                  ) : (
                    <EnvelopeOpenIcon style={{ width: '1rem', height: '1rem', color: '#6b7280' }} />
                  )}
                  <span style={{
                    fontSize: '0.875rem',
                    fontWeight: email.unread ? 600 : 400,
                    color: email.unread ? '#f3f4f6' : '#9ca3af',
                  }}>
                    {email.from}
                  </span>
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: email.unread ? 600 : 400,
                  color: '#f3f4f6',
                  marginBottom: '0.25rem',
                }}>
                  {email.subject}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {email.preview}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  {email.date}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <EnvelopeIcon style={{ width: '4rem', height: '4rem', color: '#6b7280', marginBottom: '1rem', opacity: 0.5 }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#f3f4f6', marginBottom: '0.5rem' }}>
            Email Client Demo
          </h2>
          <p style={{ color: '#9ca3af', textAlign: 'center', maxWidth: '500px', lineHeight: 1.6 }}>
            This is a preview of the email interface. In the future, NoirWire will support
            end-to-end encrypted email communication using the same encryption as secure messaging.
          </p>
          <div style={{
            marginTop: '2rem',
            padding: '1.5rem',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '1rem',
            maxWidth: '600px',
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f3f4f6', marginBottom: '1rem' }}>
              Planned Features:
            </h3>
            <ul style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: 1.8, listStyle: 'none', padding: 0 }}>
              <li style={{ marginBottom: '0.5rem' }}>• E2E encrypted email using wallet identity</li>
              <li style={{ marginBottom: '0.5rem' }}>• Decentralized email storage on Solana</li>
              <li style={{ marginBottom: '0.5rem' }}>• Attachment support with IPFS integration</li>
              <li style={{ marginBottom: '0.5rem' }}>• Email aliases linked to wallet addresses</li>
              <li style={{ marginBottom: '0.5rem' }}>• Spam filtering with reputation system</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
