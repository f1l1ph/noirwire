/**
 * Wallet Data Context - API-Only
 *
 * Manages wallet state (notes, balance, sync status).
 * All notes are stored on blockchain/Supabase only.
 * No localStorage - everything syncs through the API.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Note } from '../../lib/types';
import { uploadNotes, downloadNotes, clearAllNotes } from '../../lib/notesApi';

interface WalletData {
  notes: Note[];
  privateBalance: number;
  noteCount: number;
  isLoading: boolean;
  isSyncing: boolean;
  syncError: string | null;
}

interface WalletDataContextType extends WalletData {
  addNote: (note: Note) => Promise<void>;
  markNoteAsSpent: (commitment: string) => Promise<void>;
  clearAllNotes: () => Promise<void>;
  refreshNotes: () => Promise<void>;
  getUnspentNotes: () => Note[];
  clearSyncError: () => void;
}

const WalletDataContext = createContext<WalletDataContextType | undefined>(
  undefined,
);

export function WalletDataProvider({ children }: { children: React.ReactNode }) {
  const { publicKey } = useWallet();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Derived state
  const unspentNotes = notes.filter((n) => !n.spent);
  const privateBalance = unspentNotes.reduce((sum, note) => {
    const amount = parseFloat(note.amount);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);
  const noteCount = unspentNotes.length;

  /**
   * Load notes from blockchain/API
   */
  const refreshNotes = useCallback(async () => {
    if (!publicKey) return;

    setIsLoading(true);
    setSyncError(null);

    try {
      console.log('🔄 Loading notes from blockchain...');
      const loadedNotes = await downloadNotes(publicKey.toBase58());
      setNotes(loadedNotes);
      console.log(`✅ Loaded ${loadedNotes.length} notes`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to load notes:', message);
      setSyncError(message);
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);

  /**
   * Save notes to blockchain/API
   */
  const syncNotesToAPI = useCallback(
    async (notesToSync: Note[]) => {
      if (!publicKey) return;

      setIsSyncing(true);
      setSyncError(null);

      try {
        console.log(`💾 Syncing ${notesToSync.length} notes to blockchain...`);
        await uploadNotes(publicKey.toBase58(), notesToSync);
        console.log('✅ Notes synced to blockchain');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('❌ Sync failed:', message);
        setSyncError(message);
        throw error;
      } finally {
        setIsSyncing(false);
      }
    },
    [publicKey],
  );

  /**
   * Add a new note
   */
  const addNote = useCallback(
    async (note: Note) => {
      const newNotes = [...notes, note];
      setNotes(newNotes);
      await syncNotesToAPI(newNotes);
    },
    [notes, syncNotesToAPI],
  );

  /**
   * Mark a note as spent
   */
  const markNoteAsSpent = useCallback(
    async (commitment: string) => {
      const updated = notes.map((note) =>
        note.commitment === commitment ? { ...note, spent: true } : note,
      );

      setNotes(updated);
      await syncNotesToAPI(updated);
    },
    [notes, syncNotesToAPI],
  );

  /**
   * Clear all notes
   */
  const clearAll = useCallback(async () => {
    setNotes([]);
    await clearAllNotes(publicKey?.toBase58() || '');
  }, [publicKey]);

  /**
   * Get unspent notes
   */
  const getUnspentNotes = useCallback(
    () => notes.filter((n) => !n.spent),
    [notes],
  );

  /**
   * Clear error message
   */
  const clearSyncError = useCallback(() => {
    setSyncError(null);
  }, []);

  /**
   * Load notes on wallet connection
   */
  useEffect(() => {
    if (publicKey) {
      refreshNotes();
    } else {
      setNotes([]);
    }
  }, [publicKey, refreshNotes]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (publicKey) refreshNotes();
    }, 30_000);

    return () => clearInterval(interval);
  }, [publicKey, refreshNotes]);

  const value: WalletDataContextType = {
    notes,
    privateBalance,
    noteCount,
    isLoading,
    isSyncing,
    syncError,
    addNote,
    markNoteAsSpent,
    clearAllNotes: clearAll,
    refreshNotes,
    getUnspentNotes,
    clearSyncError,
  };

  return (
    <WalletDataContext.Provider value={value}>
      {children}
    </WalletDataContext.Provider>
  );
}

/**
 * Hook to use wallet data
 */
export function useWalletData(): WalletDataContextType {
  const context = useContext(WalletDataContext);
  if (!context) {
    throw new Error('useWalletData must be used within WalletDataProvider');
  }
  return context;
}
