'use client';

import React, { useMemo, useEffect } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';

export function WalletContextProvider({ children }: { children: React.ReactNode }) {
  // Suppress MetaMask/Ethereum console errors globally
  useEffect(() => {
    const originalError = console.error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.error = (...args: any[]) => {
      const errorString = args.join(' ').toLowerCase();
      if (
        errorString.includes('metamask') ||
        errorString.includes('ethereum') ||
        errorString.includes('wallet_requestpermissions')
      ) {
        // Suppress these errors - they're from Solana wallets looking for Ethereum
        return;
      }
      originalError.apply(console, args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  const endpoint = useMemo(() => {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';
    console.log('🌐 Using Solana RPC:', rpcUrl);
    return rpcUrl;
  }, []);
  
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
    ],
    []
  );

  // Error handler for wallet adapter - suppress irrelevant errors
  const onError = (error: Error) => {
    // Ignore MetaMask/Ethereum/browser wallet detection errors
    const errorMessage = error.message?.toLowerCase() || '';
    if (
      errorMessage.includes('ethereum') || 
      errorMessage.includes('metamask') ||
      errorMessage.includes('not initialized') ||
      errorMessage.includes('wallet not found') ||
      errorMessage.includes('user rejected')
    ) {
      // These are expected - we're a Solana app, not Ethereum
      return;
    }
    
    // Log actual errors
    console.error('Wallet error:', error);
  };

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false} onError={onError}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
