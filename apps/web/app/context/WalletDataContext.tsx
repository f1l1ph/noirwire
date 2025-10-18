/**
 * Centralized Wallet Data Context
 * 
 * Manages all wallet-related state including:
 * - Private balance and notes
 * - Syncing with Supabase
 * - Loading states
 * 
 * This eliminates the need for direct localStorage access throughout the app
 */

'use client';

import axios from 'axios';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Note } from '../../lib/types';
import { API_BASE_URL, STORAGE_KEYS } from '../../lib/constants';

interface WalletData {
  notes: Note[];
  privateBalance: number;
  noteCount: number;
  isLoading: boolean;
  isLoadingFromSupabase: boolean;
}

interface WalletDataContextType extends WalletData {
  addNote: (note: Note) => Promise<void>;
  markNoteAsSpent: (commitment: string) => Promise<void>;
  clearAllNotes: () => Promise<void>;
  refreshNotes: () => Promise<void>;
  getUnspentNotes: () => Note[];
}

const WalletDataContext = createContext<WalletDataContextType | undefined>(undefined);

export function WalletDataProvider({ children }: { children: React.ReactNode }) {
  const { publicKey } = useWallet();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFromSupabase, setIsLoadingFromSupabase] = useState(false);

  // Calculate derived state
  const unspentNotes = notes.filter(n => !n.spent);
  const privateBalance = unspentNotes.reduce((sum, note) => {
    const amount = parseFloat(note.amount);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);
  const noteCount = unspentNotes.length;

  /**
   * Get storage key for current wallet
   */
  const getStorageKey = useCallback(() => {
    if (!publicKey) return null;
    return `${STORAGE_KEYS.NOTES_PREFIX}${publicKey.toBase58()}`;
  }, [publicKey]);

  /**
   * Load notes from localStorage
   */
  const loadFromLocalStorage = useCallback((): Note[] => {
    const key = getStorageKey();
    if (!key) return [];

    try {
      const stored = localStorage.getItem(key);
      if (!stored) return [];
      
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return [];
    }
  }, [getStorageKey]);

  /**
   * Save notes to localStorage
   */
  const saveToLocalStorage = useCallback((notesToSave: Note[]) => {
    const key = getStorageKey();
    if (!key) return;

    try {
      localStorage.setItem(key, JSON.stringify(notesToSave));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }, [getStorageKey]);

  /**
   * Sync notes to Supabase (optional, fails silently)
   */
  const syncToSupabase = useCallback(async (notesToSync: Note[]) => {
    if (!publicKey) return;

    try {
      console.log('=== SYNCING TO SUPABASE ===');
      console.log(`Wallet: ${publicKey.toBase58()}`);
      console.log(`Notes count: ${notesToSync.length}`);
      
      const encryptedData = btoa(JSON.stringify(notesToSync));
      console.log(`Encrypted data length: ${encryptedData.length} chars`);
      
      const payload = {
        walletAddress: publicKey.toBase58(),
        encryptedData,
      };
      console.log('Payload:', JSON.stringify(payload, null, 2));
      
      console.log(`Sending POST to: ${API_BASE_URL}/notes/upload`);
      const response = await axios.post(
        `${API_BASE_URL}/notes/upload`,
        payload,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5_000,
          validateStatus: () => true,
        },
      );

      console.log(`Response status: ${response.status} ${response.statusText}`);
      
      if (response.status < 200 || response.status >= 300) {
        const errorText =
          typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data);
        console.error('❌ Supabase sync failed:');
        console.error(`Status: ${response.status}`);
        console.error(`Response: ${errorText}`);
        console.error('This may indicate:');
        console.error('1. Table "user_notes" does not exist in Supabase');
        console.error('2. Run supabase-schema.sql in Supabase SQL Editor');
        console.error('3. API server issue (check API logs)');
        return; // Fail silently for now
      }

      const result = response.data;
      console.log('✅ Notes synced to Supabase');
      console.log('Result:', result);
    } catch (error) {
      console.error('❌ Supabase sync error:', error);
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      // Supabase is optional - fail silently
    } finally {
      console.log('=== SYNC COMPLETE ===');
    }
  }, [publicKey]);

  /**
   * Load notes from Supabase
   */
  const loadFromSupabase = useCallback(async (): Promise<Note[] | null> => {
    if (!publicKey) return null;

    try {
      const response = await axios.get<{
        success: boolean;
        encryptedData?: string;
      }>(`${API_BASE_URL}/notes/${publicKey.toBase58()}`, {
        timeout: 5_000,
        validateStatus: () => true,
      });
      
      if (response.status < 200 || response.status >= 300) return null;

      const data = response.data;
      
      if (!data.success || !data.encryptedData) return null;

      const decrypted = atob(data.encryptedData);
      const loadedNotes = JSON.parse(decrypted);
      
      console.log(`✅ Loaded ${loadedNotes.length} notes from Supabase`);
      return loadedNotes;
    } catch {
      return null;
    }
  }, [publicKey]);

  /**
   * Refresh notes from storage
   */
  const refreshNotes = useCallback(async () => {
    if (!publicKey) {
      setNotes([]);
      return;
    }

    setIsLoading(true);

    // First, load from localStorage (fast)
    const localNotes = loadFromLocalStorage();
    setNotes(localNotes);

    // If localStorage is empty, try Supabase
    if (localNotes.length === 0) {
      setIsLoadingFromSupabase(true);
      const supabaseNotes = await loadFromSupabase();
      
      if (supabaseNotes && supabaseNotes.length > 0) {
        setNotes(supabaseNotes);
        saveToLocalStorage(supabaseNotes);
      }
      setIsLoadingFromSupabase(false);
    }

    setIsLoading(false);
  }, [publicKey, loadFromLocalStorage, loadFromSupabase, saveToLocalStorage]);

  /**
   * Add a new note
   */
  const addNote = useCallback(async (note: Note) => {
    const noteWithId: Note = {
      ...note,
      noteId: note.noteId || note.commitment,
    };

    const updatedNotes = [...notes, noteWithId];
    setNotes(updatedNotes);
    saveToLocalStorage(updatedNotes);
    
    // Sync to Supabase in background
    await syncToSupabase(updatedNotes);
  }, [notes, saveToLocalStorage, syncToSupabase]);

  /**
   * Mark a note as spent
   */
  const markNoteAsSpent = useCallback(async (commitment: string) => {
    const updatedNotes = notes.map(note =>
      note.commitment === commitment ? { ...note, spent: true } : note
    );

    setNotes(updatedNotes);
    saveToLocalStorage(updatedNotes);
    
    // Sync to Supabase in background
    await syncToSupabase(updatedNotes);
  }, [notes, saveToLocalStorage, syncToSupabase]);

  /**
   * Clear all notes
   */
  const clearAllNotes = useCallback(async () => {
    setNotes([]);
    saveToLocalStorage([]);
    
    // Clear from Supabase
    await syncToSupabase([]);
  }, [saveToLocalStorage, syncToSupabase]);

  /**
   * Get unspent notes
   */
  const getUnspentNotes = useCallback(() => {
    return notes.filter(n => !n.spent);
  }, [notes]);

  // Load notes when wallet connects
  useEffect(() => {
    refreshNotes();
  }, [refreshNotes]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!publicKey) return;

    const interval = setInterval(() => {
      refreshNotes();
    }, 10000);

    return () => clearInterval(interval);
  }, [publicKey, refreshNotes]);

  const value: WalletDataContextType = {
    notes,
    privateBalance,
    noteCount,
    isLoading,
    isLoadingFromSupabase,
    addNote,
    markNoteAsSpent,
    clearAllNotes,
    refreshNotes,
    getUnspentNotes,
  };

  return (
    <WalletDataContext.Provider value={value}>
      {children}
    </WalletDataContext.Provider>
  );
}

/**
 * Hook to use wallet data context
 */
export function useWalletData() {
  const context = useContext(WalletDataContext);
  if (!context) {
    throw new Error('useWalletData must be used within WalletDataProvider');
  }
  return context;
}
