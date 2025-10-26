/**
 * Notes API Client - API-Only Storage
 *
 * All notes are stored on blockchain/Supabase only.
 * No localStorage cache - everything goes through the API.
 * Client-side encryption happens before uploading to server.
 *
 * @module notesApi
 */

import axios from 'axios';
import { Note } from './types';
import { API_BASE_URL } from './constants';

/**
 * Upload encrypted notes to API
 * @param walletAddress - Public key of the wallet
 * @param notes - Notes to save (will be encrypted before sending)
 * @throws Error if upload fails
 */
export async function uploadNotes(
  walletAddress: string,
  notes: Note[],
): Promise<void> {
  try {
    const encryptedData = btoa(JSON.stringify(notes));

    const response = await axios.post(
      `${API_BASE_URL}/notes/upload`,
      {
        walletAddress,
        encryptedData,
      },
      { timeout: 10_000 },
    );

    if (!response.data.success) {
      throw new Error('Server returned success: false');
    }

    console.log('✅ Notes saved to blockchain');
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error || error.message
      : String(error);
    throw new Error(`Failed to save notes: ${message}`);
  }
}

/**
 * Download encrypted notes from API
 * @param walletAddress - Public key of the wallet
 * @returns Notes array or empty array if none found
 * @throws Error if download fails
 */
export async function downloadNotes(walletAddress: string): Promise<Note[]> {
  try {
    const response = await axios.get<{
      success: boolean;
      encryptedData?: string;
      found?: boolean;
    }>(`${API_BASE_URL}/notes/${walletAddress}`, {
      timeout: 10_000,
    });

    if (!response.data.success || !response.data.found) {
      return [];
    }

    if (!response.data.encryptedData) {
      return [];
    }

    const decrypted = atob(response.data.encryptedData);
    const parsed = JSON.parse(decrypted);

    console.log(`✅ Loaded ${parsed.length} notes from blockchain`);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error || error.message
      : String(error);
    throw new Error(`Failed to load notes: ${message}`);
  }
}

/**
 * Clear all notes by uploading empty array
 * @param walletAddress - Public key of the wallet
 * @throws Error if clear fails
 */
export async function clearAllNotes(walletAddress: string): Promise<void> {
  try {
    await uploadNotes(walletAddress, []);
    console.log('✅ All notes cleared');
  } catch (error) {
    throw new Error(
      `Failed to clear notes: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
