/**
 * Shared TypeScript types and Zod schemas for NoirWire
 * Used across web, API, and other packages
 */

import { z } from 'zod';

// ============================================================================
// Core Domain Types
// ============================================================================

/**
 * A private note in the shielded pool
 */
export const NoteSchema = z.object({
  commitment: z.string(),
  blinding: z.string().optional(),
  amount: z.string(),
  recipient: z.string().optional(),
  timestamp: z.number().optional(),
  txSignature: z.string().optional(),
  spent: z.boolean(),
});

export type Note = z.infer<typeof NoteSchema>;

/**
 * Processing step states
 */
export const ProcessingStepSchema = z.enum([
  'idle',
  'computing',
  'building',
  'sending',
  'confirming',
  'success',
  'error',
]);

export type ProcessingStep = z.infer<typeof ProcessingStepSchema>;

// ============================================================================
// Zero-Knowledge Proof Inputs
// ============================================================================

/**
 * Shield proof input
 */
export const ShieldInputSchema = z.object({
  recipient_pk: z.string(),
  amount: z.string(),
  blinding: z.string(),
});

export type ShieldInput = z.infer<typeof ShieldInputSchema>;

/**
 * Transfer proof input
 */
export const TransferInputSchema = z.object({
  root: z.string(),
  nullifier: z.string(),
  secret: z.string(),
  recipient_pk: z.string(),
  blinding: z.string(),
  fee: z.string(),
  path_elements: z.array(z.string()),
  path_index: z.array(z.string()),
});

export type TransferInput = z.infer<typeof TransferInputSchema>;

/**
 * Unshield proof input
 */
export const UnshieldInputSchema = z.object({
  root: z.string(),
  nullifier: z.string(),
  secret: z.string(),
  amount: z.string(),
  blinding: z.string(),
  fee: z.string(),
  path_elements: z.array(z.string()),
  path_index: z.array(z.string()),
});

export type UnshieldInput = z.infer<typeof UnshieldInputSchema>;

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Proof generation request
 */
export const ProofRequestSchema = z.object({
  circuit: z.enum(['shield', 'transfer', 'unshield']),
  input: z.union([ShieldInputSchema, TransferInputSchema, UnshieldInputSchema]),
});

export type ProofRequest = z.infer<typeof ProofRequestSchema>;

/**
 * Proof generation response
 */
export const ProofResponseSchema = z.object({
  proofBase64: z.string(),
  publicSignals: z.array(z.string()).optional(),
});

export type ProofResponse = z.infer<typeof ProofResponseSchema>;

/**
 * Notes upload request
 */
export const UploadNotesRequestSchema = z.object({
  walletAddress: z.string(),
  encryptedData: z.string(),
});

export type UploadNotesRequest = z.infer<typeof UploadNotesRequestSchema>;

/**
 * Notes upload response
 */
export const UploadNotesResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export type UploadNotesResponse = z.infer<typeof UploadNotesResponseSchema>;

/**
 * Notes download response
 */
export const DownloadNotesResponseSchema = z.object({
  encryptedData: z.string().nullable(),
});

export type DownloadNotesResponse = z.infer<typeof DownloadNotesResponseSchema>;

// ============================================================================
// Auto-sync Types
// ============================================================================

/**
 * Auto-sync configuration
 */
export const AutoSyncConfigSchema = z.object({
  connection: z.any(), // Solana Connection object
  walletPublicKey: z.any(), // Solana PublicKey object
  onUpdate: z
    .function()
    .args(z.number(), z.number())
    .returns(z.void())
    .optional(),
  onError: z.function().args(z.instanceof(Error)).returns(z.void()).optional(),
});

export type AutoSyncConfig = {
  connection: any; // Solana Connection
  walletPublicKey: any; // Solana PublicKey
  onUpdate?: (noteCount: number, totalBalance: number) => void;
  onError?: (error: Error) => void;
};

/**
 * Sync result
 */
export const SyncResultSchema = z.object({
  found: z.number(),
  total: z.number(),
});

export type SyncResult = z.infer<typeof SyncResultSchema>;

// ============================================================================
// Error Types
// ============================================================================

/**
 * API Error
 */
export const ApiErrorSchema = z.object({
  message: z.string(),
  statusCode: z.number().optional(),
  code: z.string().optional(),
});

export type ApiErrorData = z.infer<typeof ApiErrorSchema>;

// ============================================================================
// Constants Types
// ============================================================================

/**
 * API Configuration
 */
export interface ApiConfig {
  readonly BASE_URL: string;
  readonly TIMEOUT: number;
  readonly RETRY_ATTEMPTS: number;
  readonly RETRY_DELAY: number;
}

/**
 * Sync Configuration
 */
export interface SyncConfig {
  readonly INTERVAL_MS: number;
  readonly TRANSACTION_SCAN_LIMIT: number;
  readonly DELAY_BETWEEN_TX_MS: number;
}

/**
 * UI Configuration
 */
export interface UIConfig {
  readonly COPY_FEEDBACK_DURATION: number;
  readonly NOTE_DISPLAY_DECIMALS: number;
}
