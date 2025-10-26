'use client';

import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { ArrowLeftIcon, CheckIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { QRCodeCanvas } from 'qrcode.react';
import { useRef, useState } from 'react';
import styles from './receive.module.css';

export default function ReceivePage() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const address = publicKey?.toBase58() || '';

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas') as HTMLCanvasElement;
    if (canvas) {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${address.slice(0, 8)}-qr-code.png`;
      link.click();
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          onClick={() => router.push('/dashboard')}
          className={styles.backButton}
        >
          <ArrowLeftIcon style={{ width: '1rem', height: '1rem' }} />
          Back to Dashboard
        </button>
      </header>

      <main className={styles.main}>
        {connected && publicKey ? (
          <div className={styles.content}>
            <h1 className={styles.title}>Receive Tokens</h1>
            <p className={styles.subtitle}>
              Share your wallet address to receive SOL and SPL tokens
            </p>

            <div className={styles.card}>
              <div className={styles.qrContainer} ref={qrRef}>
                <QRCodeCanvas
                  value={address}
                  size={240}
                  level="H"
                  includeMargin
                  className={styles.qrCode}
                  fgColor="#000000"
                  bgColor="#FFFFFF"
                />
              </div>

              <div className={styles.addressContainer}>
                {address}
              </div>

              <div className={styles.buttonGroup}>
                <button
                  onClick={copyAddress}
                  className={`${styles.copyButton} ${copied ? styles.copied : ''}`}
                >
                  {copied ? (
                    <>
                      <CheckIcon style={{ width: '1rem', height: '1rem' }} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <CheckIcon style={{ width: '1rem', height: '1rem' }} />
                      Copy Address
                    </>
                  )}
                </button>

                <button
                  onClick={downloadQR}
                  className={styles.downloadButton}
                >
                  <ArrowDownTrayIcon style={{ width: '1rem', height: '1rem' }} />
                  Download QR
                </button>
              </div>

              <div className={styles.note}>
                💡 Share this QR code to receive payments directly to your wallet
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.content}>
            <h1 className={styles.title}>Connect Your Wallet</h1>
            <p className={styles.subtitle}>
              Please connect your wallet to see your receive address
            </p>
            <div className={styles.card}>
              <div className={styles.disconnected}>
                <p className={styles.disconnectedText}>
                  No wallet connected. Please use the connect button in the top navigation to get started.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
