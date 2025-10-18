import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './wallet.css';
import { WalletContextProvider } from './components/WalletContextProvider';
import { WalletDataProvider } from './context/WalletDataContext';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'NoirWire - Private Payments on Solana',
  description: 'Zero-knowledge privacy layer for Solana',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className={`${geistSans.variable} ${geistMono.variable}`}
        suppressHydrationWarning
      >
        <WalletContextProvider>
          <WalletDataProvider>
            {children}
          </WalletDataProvider>
        </WalletContextProvider>
      </body>
    </html>
  );
}
