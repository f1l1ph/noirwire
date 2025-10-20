'use client';

import React, { useMemo, useEffect } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { 
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  TrustWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

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
        errorString.includes('wallet_requestpermissions') ||
        errorString.includes('wallet not ready') ||
        errorString.includes('wallet not found')
      ) {
        // Suppress these errors - they're from wallet detection attempts
        return;
      }
      originalError.apply(console, args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  // Determine network from RPC URL
  const network = useMemo(() => {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';
    if (rpcUrl.includes('mainnet')) return WalletAdapterNetwork.Mainnet;
    if (rpcUrl.includes('testnet')) return WalletAdapterNetwork.Testnet;
    return WalletAdapterNetwork.Devnet;
  }, []);

  const endpoint = useMemo(() => {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';
    console.log('🌐 Using Solana RPC:', rpcUrl);
    console.log('📡 Network:', network);
    return rpcUrl;
  }, [network]);
  
  // Configure multiple wallets for better compatibility
  const wallets = useMemo(
    () => [
      // Popular Solana wallets
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      new CoinbaseWalletAdapter(),
      new TrustWalletAdapter(),
      // More wallets can be added here
    ],
    [network]
  );

  // Error handler for wallet adapter - suppress irrelevant errors
  const onError = (error: Error) => {
    // Ignore common wallet detection and initialization errors
    const errorMessage = error.message?.toLowerCase() || '';
    const errorName = error.name?.toLowerCase() || '';
    
    if (
      errorMessage.includes('ethereum') || 
      errorMessage.includes('metamask') ||
      errorMessage.includes('not initialized') ||
      errorMessage.includes('wallet not found') ||
      errorMessage.includes('wallet not ready') ||
      errorMessage.includes('user rejected') ||
      errorMessage.includes('user declined') ||
      errorName.includes('walletnotreadyerror') ||
      errorName.includes('walletnotfounderror')
    ) {
      // These are expected - wallet detection or user cancellation
      return;
    }
    
    // Log actual errors that need attention
    console.error('❌ Wallet error:', error);
  };

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider 
        wallets={wallets} 
        autoConnect={false}
        onError={onError}
        localStorageKey="noirwire_wallet"
      >
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
