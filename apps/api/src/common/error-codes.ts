/**
 * Application Error Codes
 * Each error has a unique code for client-side handling and diagnostics
 *
 * Format: DOMAIN_ERROR_NAME
 * - INDEXER: Merkle tree indexer errors
 * - PROOF: Proof generation errors
 * - VERIFIER: Proof verification errors
 * - VALIDATION: Input validation errors
 */

export const ErrorCodes = {
  // Indexer Errors (1000-1999)
  INDEXER_COMMITMENT_NOT_FOUND: {
    code: 'INDEXER_COMMITMENT_NOT_FOUND',
    status: 404,
    message: 'Commitment not found in Merkle tree',
    userMessage: 'Your note is not in the Merkle tree yet.',
  },
  INDEXER_TREE_EMPTY: {
    code: 'INDEXER_TREE_EMPTY',
    status: 409,
    message: 'No commitments in tree (tree is empty)',
    userMessage:
      'The Merkle tree is empty. Please shield first to create a note.',
  },
  INDEXER_INVALID_COMMITMENT_FORMAT: {
    code: 'INDEXER_INVALID_COMMITMENT_FORMAT',
    status: 400,
    message: 'Invalid commitment format (not hex or decimal)',
    userMessage: 'The commitment format is invalid.',
  },
  INDEXER_INVALID_CIRCUIT: {
    code: 'INDEXER_INVALID_CIRCUIT',
    status: 400,
    message: 'Invalid circuit name',
    userMessage: 'Invalid circuit. Must be shield, transfer, or unshield.',
  },
  INDEXER_NOT_INITIALIZED: {
    code: 'INDEXER_NOT_INITIALIZED',
    status: 503,
    message: 'Indexer not initialized (Poseidon not ready)',
    userMessage: 'The indexer is not ready. Please try again.',
  },
  INDEXER_HASH_FAILED: {
    code: 'INDEXER_HASH_FAILED',
    status: 500,
    message: 'Poseidon hash computation failed',
    userMessage: 'Hash computation failed. Please try again.',
  },

  // Proof Errors (2000-2999)
  PROOF_WASM_NOT_FOUND: {
    code: 'PROOF_WASM_NOT_FOUND',
    status: 500,
    message: 'WASM artifact missing (circuit not compiled)',
    userMessage: 'The circuit is not properly compiled.',
  },
  PROOF_ZKEY_NOT_FOUND: {
    code: 'PROOF_ZKEY_NOT_FOUND',
    status: 500,
    message: 'ZKEY artifact missing (proving key not found)',
    userMessage: 'The proving key is not found.',
  },
  PROOF_GENERATION_FAILED: {
    code: 'PROOF_GENERATION_FAILED',
    status: 400,
    message: 'Proof generation failed',
    userMessage: 'Proof generation failed. Please check your inputs.',
  },
  PROOF_INVALID_INPUT: {
    code: 'PROOF_INVALID_INPUT',
    status: 400,
    message: 'Invalid proof input',
    userMessage: 'Invalid input for proof generation.',
  },
  PROOF_MISSING_FIELD: {
    code: 'PROOF_MISSING_FIELD',
    status: 400,
    message: 'Missing required field in proof input',
    userMessage: 'Missing required field for proof generation.',
  },

  // Verifier Errors (3000-3999)
  VERIFIER_VK_NOT_FOUND: {
    code: 'VERIFIER_VK_NOT_FOUND',
    status: 500,
    message: 'Verification key not found',
    userMessage: 'The verification key is not found.',
  },
  VERIFIER_VERIFICATION_FAILED: {
    code: 'VERIFIER_VERIFICATION_FAILED',
    status: 400,
    message: 'Proof verification failed',
    userMessage: 'Proof verification failed. The proof may be invalid.',
  },

  // Validation Errors (4000-4999)
  VALIDATION_MISSING_FIELD: {
    code: 'VALIDATION_MISSING_FIELD',
    status: 400,
    message: 'Missing required field',
    userMessage: 'Missing required field in request.',
  },
  VALIDATION_INVALID_TYPE: {
    code: 'VALIDATION_INVALID_TYPE',
    status: 400,
    message: 'Invalid field type',
    userMessage: 'Invalid field type in request.',
  },

  // Generic Errors (5000+)
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    status: 500,
    message: 'Internal server error',
    userMessage: 'An unexpected error occurred. Please try again.',
  },
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

/**
 * Get error details by code
 */
export function getErrorDetails(code: ErrorCode) {
  return ErrorCodes[code];
}

/**
 * Get error code from status (for backwards compatibility)
 */
export function getErrorCodeFromStatus(status: number): ErrorCode {
  for (const code of Object.keys(ErrorCodes) as ErrorCode[]) {
    if (ErrorCodes[code].status === status) {
      return code;
    }
  }
  return 'INTERNAL_ERROR';
}
