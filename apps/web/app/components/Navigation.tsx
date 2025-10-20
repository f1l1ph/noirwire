'use client';

import { useRouter, usePathname } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { 
  ArrowLeftIcon,
  HomeIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';
import styles from './Navigation.module.css';

export default function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  
  // Prevent hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const isLandingPage = pathname === '/';
  const isDashboard = pathname === '/dashboard';
  const isMessages = pathname === '/messages';
  
  // Determine if we're on a subpage (feature pages)
  const isSubPage = pathname.startsWith('/shield') || 
                    pathname.startsWith('/unshield') || 
                    pathname.startsWith('/transfer') ||
                    pathname.startsWith('/send') ||
                    pathname.startsWith('/receive') ||
                    pathname.startsWith('/email') ||
                    pathname.startsWith('/defi') ||
                    pathname.startsWith('/debug-indexer');
  
  // Smart back navigation logic
  const handleBackClick = () => {
    if (isDashboard) {
      // From dashboard → go to landing page
      router.push('/');
    } else if (isSubPage) {
      // From feature page → go to dashboard
      router.push('/dashboard');
    } else if (isMessages) {
      // From messages → go to dashboard
      router.push('/dashboard');
    } else {
      // Default: browser back
      router.back();
    }
  };
  
  const navItems = isSubPage
    ? [
        { 
          label: 'Dashboard', 
          path: '/dashboard', 
          icon: HomeIcon,
          show: true
        },
      ]
    : [
        { 
          label: 'Messages', 
          path: '/messages', 
          icon: ChatBubbleLeftRightIcon,
          show: isMessages ? false : (!isDashboard && !isLandingPage)
        },
      ];

  return (
    <nav className={styles.nav}>
      <div className={styles.container}>
        {/* Left: Logo */}
        <button 
          className={styles.logo}
          onClick={() => router.push('/')}
          aria-label="NoirWire Home"
        >
          <span className={styles.logoIcon}>⚡</span>
          <span className={styles.logoText}>NoirWire</span>
        </button>

        {/* Center: Navigation Links */}
        {!isLandingPage && (
          <div className={styles.navLinks}>
            {navItems.filter(item => item.show).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  className={styles.navButton}
                  onClick={() => router.push(item.path)}
                >
                  <Icon className={styles.navIcon} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Right: Actions */}
        <div className={styles.actions}>
          {!isLandingPage && (
            <button 
              className={styles.backButton}
              onClick={handleBackClick}
              aria-label="Go back"
              title={isDashboard ? 'Back to home' : isSubPage ? 'Back to dashboard' : 'Go back'}
            >
              <ArrowLeftIcon className={styles.backIcon} />
            </button>
          )}

          {mounted && (
            <div className={styles.walletButton}>
              <WalletMultiButton />
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
