'use client';

import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  ShieldCheckIcon,
  ChatBubbleLeftRightIcon,
  EyeSlashIcon,
  LockClosedIcon,
  BoltIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import Navigation from './components/Navigation';
import styles from './landing.module.css';

export default function LandingPage() {
  const router = useRouter();
  const { connected } = useWallet();

  const features = [
    {
      icon: ShieldCheckIcon,
      title: 'Privacy First',
      description: 'Zero-knowledge proofs keep your transactions completely private',
    },
    {
      icon: ChatBubbleLeftRightIcon,
      title: 'E2E Encryption',
      description: 'End-to-end encrypted messaging with perfect forward secrecy',
    },
    {
      icon: EyeSlashIcon,
      title: 'Anonymous Transfers',
      description: 'Send and receive SOL without revealing your identity',
    },
    {
      icon: LockClosedIcon,
      title: 'Secure by Design',
      description: 'Military-grade encryption with cryptographic privacy',
    },
    {
      icon: BoltIcon,
      title: 'Lightning Fast',
      description: 'Built on Solana for instant, low-cost transactions',
    },
    {
      icon: ChartBarIcon,
      title: 'Privacy Pool',
      description: 'Mix your funds with others for maximum anonymity',
    },
  ];

  const handleGetStarted = () => {
    if (connected) {
      router.push('/dashboard');
    } else {
      // Trigger wallet connection
      document.querySelector('[class*="wallet-adapter"]')?.querySelector('button')?.click();
    }
  };

  return (
    <div className={styles.page}>
      <Navigation />

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>
            <BoltIcon className={styles.badgeIcon} />
            <span>Powered by Solana</span>
          </div>
          
          <h1 className={styles.heroTitle}>
            Your Privacy
            <span className={styles.gradient}> Matters</span>
          </h1>
          
          <p className={styles.heroSubtitle}>
            NoirWire brings true privacy to Solana. Shield your transactions, 
            communicate securely, and transact anonymously—all with zero-knowledge proofs.
          </p>

          <div className={styles.heroButtons}>
            <button 
              className={styles.primaryButton}
              onClick={handleGetStarted}
            >
              {connected ? 'Go to Dashboard' : 'Get Started'}
            </button>
            <button 
              className={styles.secondaryButton}
              onClick={() => window.open('https://github.com/f1l1ph/noirwire', '_blank')}
            >
              View on GitHub
            </button>
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statValue}>100%</div>
              <div className={styles.statLabel}>Private</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>0-Fee</div>
              <div className={styles.statLabel}>Messaging</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>ZK</div>
              <div className={styles.statLabel}>Proofs</div>
            </div>
          </div>
        </div>

        {/* Animated Background */}
        <div className={styles.heroBackground}>
          <div className={styles.circle}></div>
          <div className={styles.circle}></div>
          <div className={styles.circle}></div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <div className={styles.featuresContent}>
          <h2 className={styles.sectionTitle}>
            Privacy-Preserving <span className={styles.gradient}>Features</span>
          </h2>
          
          <p className={styles.sectionSubtitle}>
            Everything you need for private transactions and communications on Solana
          </p>

          <div className={styles.featureGrid}>
            {features.map((feature, index) => (
              <div key={index} className={styles.featureCard}>
                <div className={styles.featureIcon}>
                  <feature.icon className={styles.icon} />
                </div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDescription}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className={styles.howItWorks}>
        <div className={styles.howItWorksContent}>
          <h2 className={styles.sectionTitle}>
            How It <span className={styles.gradient}>Works</span>
          </h2>

          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNumber}>1</div>
              <h3 className={styles.stepTitle}>Connect Wallet</h3>
              <p className={styles.stepDescription}>
                Connect your Solana wallet (Phantom, Solflare, or any other)
              </p>
            </div>

            <div className={styles.stepArrow}>→</div>

            <div className={styles.step}>
              <div className={styles.stepNumber}>2</div>
              <h3 className={styles.stepTitle}>Shield Funds</h3>
              <p className={styles.stepDescription}>
                Deposit SOL into the privacy pool using zero-knowledge proofs
              </p>
            </div>

            <div className={styles.stepArrow}>→</div>

            <div className={styles.step}>
              <div className={styles.stepNumber}>3</div>
              <h3 className={styles.stepTitle}>Transact Privately</h3>
              <p className={styles.stepDescription}>
                Send, receive, and message with complete anonymity
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.cta}>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>
            Ready to Go <span className={styles.gradient}>Private</span>?
          </h2>
          <p className={styles.ctaSubtitle}>
            Join NoirWire today and take control of your financial privacy
          </p>
          <button 
            className={styles.ctaButton}
            onClick={handleGetStarted}
          >
            {connected ? 'Open Dashboard' : 'Connect Wallet to Start'}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerBrand}>
            <span className={styles.footerLogo}>⚡ NoirWire</span>
            <p className={styles.footerTagline}>Privacy-first transactions on Solana</p>
          </div>
          
          <div className={styles.footerLinks}>
            <a href="https://github.com/f1l1ph/noirwire" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href="https://docs.solana.com" target="_blank" rel="noopener noreferrer">
              Docs
            </a>
            <a href="mailto:contact@noirwire.app">
              Contact
            </a>
          </div>
        </div>
        
        <div className={styles.footerBottom}>
          <p>© 2025 NoirWire. Built with ⚡ on Solana.</p>
        </div>
      </footer>
    </div>
  );
}
