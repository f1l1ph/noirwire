/**
 * Type Definitions for NoirWire Privacy Pool
 *
 * This file contains all TypeScript type definitions used throughout
 * the application for type safety and better developer experience.
 *
 * @module types
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Represents a shielded note in the privacy pool
 */
export interface Note {
  /** Poseidon hash commitment (hex string, 64 chars) */
  commitment: string;

  /** Blinding factor for commitment (bigint as string) */
  blinding: string;

  /** Amount of SOL in the note */
  amount: string;

  /** Recipient wallet address (public key) */
  recipient: string;

  /** Timestamp when note was created */
  timestamp: number;

  /** Solana transaction signature (optional) */
  txSignature?: string;

  /** Whether the note has been spent */
  spent: boolean;

  /** Unique identifier for nullifier generation */
  noteId?: string;
}

/**
 * Supported circuit types for zero-knowledge proofs
 */
export type CircuitType = 'shield' | 'transfer' | 'unshield';

/**
 * Circuit type as const for better type safety
 */
export const CIRCUIT_TYPES = {
  SHIELD: 'shield',
  TRANSFER: 'transfer',
  UNSHIELD: 'unshield',
} as const;

// ============================================================================
// Circuit Input Types
// ============================================================================

/**
 * Input for shield circuit (deposit)
 * Creates a new commitment without revealing recipient or amount
 */
export interface ShieldInput {
  /** Recipient public key (hashed) */
  recipient_pk: string;

  /** Amount to shield (as string to avoid precision loss) */
  amount: string;

  /** Blinding factor for commitment */
  blinding: string;
}

/**
 * Input for transfer circuit (private transfer)
 * Transfers value from one note to another without revealing amounts
 */
export interface TransferInput {
  /** Merkle root */
  root: string;

  /** Nullifier to prevent double-spend */
  nullifier: string;

  /** Secret key of sender */
  secret: string;

  /** Recipient public key */
  recipient_pk: string;

  /** Blinding factor for output note */
  blinding: string;

  /** Transfer fee */
  fee: string;

  /** Merkle proof path (sibling hashes) */
  path_elements: string[];

  /** Merkle proof positions (left=0, right=1) */
  path_index: string[];
}

/**
 * Input for unshield circuit (withdrawal)
 * Withdraws from private note to public address
 */
export interface UnshieldInput {
  /** Merkle root */
  root: string;

  /** Nullifier to prevent double-spend */
  nullifier: string;

  /** Secret key of note owner */
  secret: string;

  /** Old amount in the note (total) */
  amount: string;

  /** Blinding factor for the note */
  blinding: string;

  /** Withdrawal fee */
  fee: string;

  /** Merkle proof path (sibling hashes) */
  path_elements: string[];

  /** Merkle proof positions (left=0, right=1) */
  path_index: string[];

  /** Lower 128 bits of recipient address */
  recipient_lo?: string;

  /** Upper 128 bits of recipient address */
  recipient_hi?: string;

  /** Old recipient public key of the note */
  old_recipient_pk?: string;

  /** Note ID for nullifier generation */
  note_id?: string;
}

/**
 * Union type of all circuit inputs
 */
export type CircuitInput = ShieldInput | TransferInput | UnshieldInput;

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response from proof generation API
 */
export interface ProofResponse {
  /** Base64-encoded proof bytes */
  proofBase64: string;

  /** Public signals (inputs visible on-chain) */
  publicSignals: string[];
}

/**
 * Processing steps for UI feedback
 */
export type ProcessingStep =
  | 'idle'
  | 'computing' // Computing witness
  | 'building' // Building proof
  | 'sending' // Sending transaction
  | 'confirming' // Confirming on-chain
  | 'success' // Transaction successful
  | 'error'; // Error occurred

/**
 * Error response from API
 */
export interface ApiError {
  /** Error message */
  message: string;

  /** Error code (optional) */
  code?: string;

  /** Additional error details (optional) */
  details?: unknown;
}
