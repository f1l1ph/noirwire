/**
 * Notes Synchronization Service
 * Handles encrypted note sync with backend using secure client-side encryption
 * Uses Zod validation and shared types
 */

import { get, post } from './httpClient';
import { encryptNotes, decryptNotes } from './notesEncryption';
import { STORAGE_KEYS } from './constants';
import {
  NoteSchema,
  UploadNotesResponseSchema,
  type Note,
} from '@noirwire/types';

interface DownloadResponse {
  success: boolean;
  found: boolean;
  encryptedData: string | null;
}

export class NotesSync {
  /**
   * Upload encrypted notes to server with validation
   */
  async uploadNotes(walletAddress: string, notes: Note[]): Promise<void> {
    // Validate notes before encryption
    notes.forEach((note) => NoteSchema.parse(note));

    const encryptedData = encryptNotes(notes, walletAddress);

    const response = await post<unknown>('/notes/upload', {
      walletAddress,
      encryptedData,
    });

    // Validate response
    UploadNotesResponseSchema.parse(response);
  }

  /**
   * Download and decrypt notes from server with validation
   */
  async downloadNotes(walletAddress: string): Promise<Note[]> {
    const response = await get<DownloadResponse>(`/notes/${walletAddress}`);

    if (!response.found || !response.encryptedData) {
      return [];
    }

    const notes = (await decryptNotes(
      response.encryptedData,
      walletAddress,
    )) as Note[];

    // Validate each note
    return notes.map((note) => NoteSchema.parse(note));
  }

  /**
   * Auto-sync notes (upload + download merge)
   */
  async autoSync(walletAddress: string): Promise<Note[]> {
    const localNotes = this.getLocalNotes(walletAddress);
    const remoteNotes = await this.downloadNotes(walletAddress);
    const merged = this.mergeNotes(localNotes, remoteNotes);

    await this.uploadNotes(walletAddress, merged);
    this.saveLocalNotes(walletAddress, merged);

    return merged;
  }

  /**
   * Get notes from localStorage
   */
  private getLocalNotes(walletAddress: string): Note[] {
    if (typeof window === 'undefined') return [];

    const key = `${STORAGE_KEYS.NOTES_PREFIX}${walletAddress}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  /**
   * Save notes to localStorage
   */
  private saveLocalNotes(walletAddress: string, notes: Note[]): void {
    if (typeof window === 'undefined') return;

    const key = `${STORAGE_KEYS.NOTES_PREFIX}${walletAddress}`;
    localStorage.setItem(key, JSON.stringify(notes));
  }

  /**
   * Merge local and remote notes, preferring newer timestamps
   */
  private mergeNotes(local: Note[], remote: Note[]): Note[] {
    const map = new Map<string, Note>();

    [...local, ...remote].forEach((note) => {
      const existing = map.get(note.commitment);
      if (
        !existing ||
        (note.timestamp &&
          existing.timestamp &&
          note.timestamp > existing.timestamp)
      ) {
        map.set(note.commitment, note);
      }
    });

    return Array.from(map.values());
  }
}
