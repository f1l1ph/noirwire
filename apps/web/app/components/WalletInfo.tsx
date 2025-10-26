"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import styles from "./WalletInfo.module.css";
import { useWalletBalance, useTreasuryBalance } from "../../lib/hooks";
import { UI_CONFIG } from "../../lib/constants";
import { useWalletData } from "../context/WalletDataContext";

/**
 * WalletInfo Component
 * 
 * Displays wallet information including:
 * - Public wallet balance
 * - Shielded balance (private notes)
 * - Pool TVL (treasury balance)
 * - Note management (export/import/scan)
 */
function WalletInfoClient(): React.ReactElement {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { balance: walletBalance } = useWalletBalance();
  const { balance: treasuryBalance } = useTreasuryBalance();
  const { notes, noteCount, refreshNotes } = useWalletData();

  const [zkAddress, setZkAddress] = useState<string>("");
  const [shieldedBalance, setShieldedBalance] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [copiedZkAddress, setCopiedZkAddress] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  /**
   * Load shielded notes from context (API-only)
   */
  const loadShieldedNotes = useCallback(() => {
    if (!publicKey) {
      setShieldedBalance(0);
      setZkAddress("");
      return;
    }

    // Calculate total balance from notes
    const total = notes.reduce((sum, note) => sum + parseFloat(note.amount), 0);
    setShieldedBalance(total);
    
    // Generate ZK address (first 16 bytes of public key)
    const zkAddr = publicKey.toBuffer().slice(0, 16).toString("hex");
    setZkAddress("0x" + zkAddr);
  }, [publicKey, notes]);

  /**
   * Copy ZK Address to clipboard with proper cleanup
   */
  const copyZkAddress = useCallback(async () => {
    if (!zkAddress) return;
    try {
      await navigator.clipboard.writeText(zkAddress);
      setCopiedZkAddress(true);
    } catch (err) {
      console.error('Failed to copy ZK address:', err);
    }
  }, [zkAddress]);

  /**
   * Reset copied state after duration
   */
  useEffect(() => {
    if (!copiedZkAddress) return;

    timerRef.current = setTimeout(
      () => setCopiedZkAddress(false),
      UI_CONFIG.COPY_FEEDBACK_DURATION,
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [copiedZkAddress]);

  // Load notes when wallet changes
  useEffect(() => {
    loadShieldedNotes();
  }, [loadShieldedNotes]);

  /**
   * Export notes (API-backed)
   * In API-only mode, notes are always backed up on-chain
   */
  const handleExport = async () => {
    if (!publicKey || !notes) return;
    try {
      const notesData = JSON.stringify(notes, null, 2);
      await navigator.clipboard.writeText(notesData);
      alert("Notes data copied to clipboard. All notes are also backed up on-chain via the API.");
    } catch (error) {
      alert("Failed to copy notes");
      console.error('Export notes failed:', error);
    }
  };

  /**
   * Refresh notes from API
   * In API-only mode, this pulls the latest from blockchain
   */
  const handleImport = async () => {
    if (!publicKey) return;
    try {
      await refreshNotes();
      alert("Notes refreshed from API");
    } catch (error) {
      alert("Failed to refresh notes");
      console.error('Refresh notes failed:', error);
    }
  };

  /**
   * Scan blockchain for notes (using viewing key)
   */
  const handleScan = async () => {
    if (!publicKey || !connection) return;
    setSyncing(true);
    
    try {
      const { AutoViewingKeySync } = await import("../../lib/autoSync");
      const sync = new AutoViewingKeySync({
        connection,
        walletPublicKey: publicKey,
        onUpdate: (nc: number, tb: number) => {
          setShieldedBalance(tb);
        },
        onError: (e: Error) => {
          console.error("Auto-sync error:", e);
        },
      });

      await sync.syncOnce();
      loadShieldedNotes(); // Refresh view
      alert("Scan complete");
    } catch (error) {
      console.error("Scan failed:", error);
      alert("Scan failed. See console for details.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>💼 Wallet & Privacy Info</h2>
        <WalletMultiButton />
      </div>

      {publicKey ? (
        <div className={styles.panels}>
          <div className={styles.panel}>
            <h3>🔓 Public Wallet</h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoRow}>
                <span className={styles.label}>Address:</span>
                <span className={styles.value} title={publicKey.toBase58()}>
                  {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>Balance:</span>
                <span className={styles.value}>
                  {walletBalance !== null ? `${walletBalance.toFixed(4)} SOL` : "Loading..."}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.panel}>
            <h3>🔐 Privacy Pool</h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoRow}>
                <span className={styles.label}>ZK Address:</span>
                <div className={styles.zkAddressContainer}>
                  <span className={styles.value} title={zkAddress}>
                    {zkAddress ? `${zkAddress.slice(0, 10)}...${zkAddress.slice(-8)}` : "—"}
                  </span>
                  {zkAddress && (
                    <button 
                      onClick={copyZkAddress}
                      className={styles.copyButton}
                      title="Copy full ZK address"
                    >
                      {copiedZkAddress ? '✓' : '📋'}
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.infoRow}>
                <span className={styles.label}>Your Shielded:</span>
                <span className={styles.value}>
                  {shieldedBalance > 0 ? `${shieldedBalance.toFixed(4)} SOL (${noteCount} notes)` : "No funds shielded"}
                </span>
              </div>

              <div className={styles.infoRow}>
                <span className={styles.label}>Pool TVL:</span>
                <span className={styles.value}>
                  {treasuryBalance !== null ? `${treasuryBalance.toFixed(4)} SOL` : "Loading..."}
                </span>
              </div>
            </div>

            <div className={styles.note}>
              <small>Click Scan to search the chain for previously shielded notes (manual only)</small>
            </div>

            <div className={styles.backupButtons}>
              <button onClick={handleScan} className={styles.backupButton} disabled={syncing}>
                {syncing ? "🔄 Scanning..." : "🔍 Scan for Notes"}
              </button>
              <button onClick={handleExport} className={styles.backupButton} disabled={shieldedBalance === 0}>
                📤 Export Backup
              </button>
              <button onClick={handleImport} className={styles.backupButton}>
                📥 Import Backup
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.connectPrompt}>
          <p>👆 Connect your wallet to view pool information</p>
        </div>
      )}
    </div>
  );
}

export const WalletInfo = dynamic(() => Promise.resolve(WalletInfoClient), {
  ssr: false,
});
