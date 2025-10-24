/**
 * Application constants
 * Centralized configuration values for the NoirWire privacy pool
 */

import { PublicKey } from '@solana/web3.js';

// Network Configuration
export const SOLANA_NETWORK = 'devnet';
export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';

// Program Configuration
export const PROGRAM_ID = new PublicKey(
  'Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz',
);
export const PROGRAM_ADDRESS = PROGRAM_ID; // Alias for convenience

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

export const API_BASE_URL = API_CONFIG.BASE_URL;
export const PROOF_ENDPOINT = `${API_CONFIG.BASE_URL}/proof/generate`;

// Frontend Configuration
export const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3001';

// Sync Configuration
export const SYNC_CONFIG = {
  INTERVAL_MS: 60000, // 60 seconds
  TRANSACTION_SCAN_LIMIT: 20, // Reduced to avoid rate limits
} as const;

// UI Configuration
export const UI_CONFIG = {
  COPY_FEEDBACK_DURATION: 2000, // 2 seconds
  NOTE_DISPLAY_DECIMALS: 4,
} as const;

// Circuit Configuration
export const CIRCUITS = {
  SHIELD: 'shield',
  TRANSFER: 'transfer',
  UNSHIELD: 'unshield',
} as const;

// Merkle Tree Configuration
export const MERKLE_TREE_DEPTH = 20;
export const MAX_NOTES = 2 ** MERKLE_TREE_DEPTH;

// Demo/Placeholder Values (TODO: Replace with real indexer)
export const DEMO_MERKLE_ROOT =
  '21663839004416932945382355908790599225266501822907911457504978515578255421292';
export const DEMO_MERKLE_PATH = Array(MERKLE_TREE_DEPTH).fill('0');
export const DEMO_MERKLE_POSITIONS = Array(MERKLE_TREE_DEPTH).fill('0');

// LocalStorage Keys
export const STORAGE_KEYS = {
  NOTES_PREFIX: 'noirwire_notes_',
  SETTINGS: 'noirwire_settings',
} as const;

// Transaction Configuration
export const MIN_SHIELD_AMOUNT = 0.001; // Minimum SOL to shield
export const DEFAULT_FEE = '0'; // Default transfer/unshield fee

// Event Discriminators
export const EVENT_DISCRIMINATORS = {
  NEW_COMMITMENT: '4e154bf3',
} as const;

// Common amounts for note scanning (in SOL)
export const COMMON_NOTE_AMOUNTS = [
  0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50, 100,
] as const;

// Note scanning configuration
export const SCAN_CONFIG = {
  MAX_NOTE_INDEX: 100, // Max note indices to try when scanning
} as const;

// Explorer URLs
export const getExplorerUrl = (signature: string): string =>
  `https://explorer.solana.com/tx/${signature}?cluster=${SOLANA_NETWORK}`;

export const getProgramExplorerUrl = (): string =>
  `https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=${SOLANA_NETWORK}`;
