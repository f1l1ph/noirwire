'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import {
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  EyeSlashIcon,
  PaperAirplaneIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ChartBarIcon,
  EnvelopeIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';
import styles from './page.module.css';
import LoadingSkeleton from '../components/LoadingSkeleton';
import SyncStatusIndicator from '../components/SyncStatusIndicator';
import DashboardHeader from './DashboardHeader';
import Navigation from '../components/Navigation';

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  action: string;
  disabled?: boolean;
  comingSoon?: boolean;
}

const features: FeatureCard[] = [
  {
    id: 'messages',
    title: 'Messages',
    description: 'E2E encrypted messaging',
    icon: ChatBubbleLeftRightIcon,
    route: '/messages',
    action: 'Open',
  },
  {
    id: 'shield',
    title: 'Shield',
    description: 'Deposit into privacy pool',
    icon: ShieldCheckIcon,
    route: '/shield',
    action: 'Shield',
  },
  {
    id: 'unshield',
    title: 'Unshield',
    description: 'Withdraw from pool',
    icon: EyeSlashIcon,
    route: '/unshield',
    action: 'Unshield',
  },
  {
    id: 'transfer',
    title: 'Transfer',
    description: 'Private pool transfers',
    icon: PaperAirplaneIcon,
    route: '/transfer',
    action: 'Send',
  },
  {
    id: 'send',
    title: 'Send',
    description: 'Send SOL or tokens',
    icon: ArrowUpTrayIcon,
    route: '/send',
    action: 'Send',
  },
  {
    id: 'receive',
    title: 'Receive',
    description: 'Show wallet address',
    icon: ArrowDownTrayIcon,
    route: '/receive',
    action: 'View',
  },
  {
    id: 'defi',
    title: 'DeFi',
    description: 'Private DeFi protocols',
    icon: ChartBarIcon,
    route: '/defi',
    action: 'Explore',
    disabled: true,
    comingSoon: true,
  },
  {
    id: 'email',
    title: 'Email',
    description: 'Demo email client',
    icon: EnvelopeIcon,
    route: '/email',
    action: 'Open',
  },
];

export default function DashboardPage() {
  const { publicKey, connected } = useWallet();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate initial load
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleCardClick = (feature: FeatureCard) => {
    if (feature.disabled) return;
    router.push(feature.route);
  };

  return (
    <div className={styles.page}>
      {/* Sync Status Indicator (shows loading/errors) */}
      <SyncStatusIndicator />

      {/* Universal Navigation */}
      <Navigation />

      {/* Balances Section */}
      {connected && publicKey && <DashboardHeader />}

      <main className={styles.main}>
        {isLoading ? (
          <LoadingSkeleton variant="card" count={8} />
        ) : (
          <div className={styles.grid}>
            {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.id}
                className={`${styles.card} ${feature.disabled ? styles.cardDisabled : ''}`}
                onClick={() => handleCardClick(feature)}
                role="button"
                tabIndex={feature.disabled ? -1 : 0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleCardClick(feature);
                  }
                }}
              >
                <Icon className={styles.cardIcon} />
                <h2 className={styles.cardTitle}>{feature.title}</h2>
                <p className={styles.cardDescription}>{feature.description}</p>
                
                {feature.comingSoon ? (
                  <span className={styles.comingSoonBadge}>Coming Soon</span>
                ) : (
                  <div className={styles.cardAction}>
                    {feature.action}
                    <ArrowRightIcon style={{ width: '1rem', height: '1rem' }} />
                  </div>
                )}
                
                {feature.disabled && (
                  <div className={styles.tooltip}>
                    This feature is coming soon
                  </div>
                )}
              </div>
            );
          })}
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <p>NoirWire • Zero-Knowledge Privacy on Solana</p>
      </footer>
    </div>
  );
}
