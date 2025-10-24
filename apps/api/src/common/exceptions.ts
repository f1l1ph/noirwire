/**
 * Custom Application Exceptions
 * Extends NestJS HttpException with error codes and structured data
 */

import { HttpException } from '@nestjs/common';
import { ErrorCode, ErrorCodes } from './error-codes';

/**
 * Base custom exception with error code
 */
export class AppException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCode,
    public readonly details?: Record<string, any>,
  ) {
    const errorDef = ErrorCodes[errorCode];
    const response = {
      statusCode: errorDef.status,
      errorCode: errorDef.code,
      message: errorDef.message,
      userMessage: errorDef.userMessage,
      timestamp: new Date().toISOString(),
      ...(details && { details }),
    };

    super(response, errorDef.status);
  }

  getErrorCode(): ErrorCode {
    return this.errorCode;
  }

  getDetails() {
    return this.details;
  }
}

// ============================================================================
// Indexer-specific exceptions
// ============================================================================

/**
 * Commitment not found in Merkle tree (404)
 */
export class CommitmentNotFoundException extends AppException {
  constructor(
    commitment: string,
    circuit: string,
    availableCommitmentCount?: number,
  ) {
    super('INDEXER_COMMITMENT_NOT_FOUND', {
      commitment: commitment.slice(0, 16) + '...',
      circuit,
      availableCommitmentCount,
      suggestion: 'Have you shielded a note yet? The tree is empty.',
    });
  }
}

/**
 * Tree is empty (409 - Conflict with operations)
 */
export class EmptyTreeException extends AppException {
  constructor(circuit: string) {
    super('INDEXER_TREE_EMPTY', {
      circuit,
      suggestion: 'Shield a note first to populate the tree with commitments.',
    });
  }
}

/**
 * Invalid commitment format (400)
 */
export class InvalidCommitmentFormatException extends AppException {
  constructor(commitment: string, reason?: string) {
    super('INDEXER_INVALID_COMMITMENT_FORMAT', {
      commitment: commitment.slice(0, 16) + '...',
      reason: reason || 'Not a valid hex or decimal string',
    });
  }
}

/**
 * Invalid circuit name (400)
 */
export class InvalidCircuitException extends AppException {
  constructor(circuit: string) {
    super('INDEXER_INVALID_CIRCUIT', {
      provided: circuit,
      valid: ['shield', 'transfer', 'unshield'],
    });
  }
}

/**
 * Indexer not initialized (503)
 */
export class IndexerNotInitializedException extends AppException {
  constructor(reason?: string) {
    super('INDEXER_NOT_INITIALIZED', {
      reason: reason || 'Poseidon hash not initialized',
      status: 'The indexer is starting up. Please retry in a moment.',
    });
  }
}

/**
 * Hash computation failed (500)
 */
export class HashFailedException extends AppException {
  constructor(reason?: string) {
    super('INDEXER_HASH_FAILED', {
      reason: reason || 'Unknown error during Poseidon hash',
    });
  }
}

// ============================================================================
// Proof-specific exceptions
// ============================================================================

/**
 * WASM artifact missing (500)
 */
export class WasmNotFoundException extends AppException {
  constructor(circuit: string, path: string) {
    super('PROOF_WASM_NOT_FOUND', {
      circuit,
      path,
      hint: 'Circuit not compiled. Run build process.',
    });
  }
}

/**
 * ZKEY artifact missing (500)
 */
export class ZkeyNotFoundException extends AppException {
  constructor(circuit: string, path: string) {
    super('PROOF_ZKEY_NOT_FOUND', {
      circuit,
      path,
      hint: 'Proving key not found. Run build process.',
    });
  }
}

/**
 * Proof generation failed (400)
 */
export class ProofGenerationFailedException extends AppException {
  constructor(circuit: string, reason: string, inputKeys?: string[]) {
    super('PROOF_GENERATION_FAILED', {
      circuit,
      reason,
      inputKeys: inputKeys?.sort(),
      suggestion: 'Check input values and circuit parameters.',
    });
  }
}

/**
 * Invalid proof input (400)
 */
export class InvalidProofInputException extends AppException {
  constructor(circuit: string, reason: string) {
    super('PROOF_INVALID_INPUT', {
      circuit,
      reason,
    });
  }
}

/**
 * Missing required field in proof input (400)
 */
export class MissingProofFieldException extends AppException {
  constructor(circuit: string, field: string, requiredFields?: string[]) {
    super('PROOF_MISSING_FIELD', {
      circuit,
      missingField: field,
      requiredFields: requiredFields?.sort(),
    });
  }
}

// ============================================================================
// Verifier-specific exceptions
// ============================================================================

/**
 * Verification key not found (500)
 */
export class VerificationKeyNotFoundExcept extends AppException {
  constructor(circuit: string, path: string) {
    super('VERIFIER_VK_NOT_FOUND', {
      circuit,
      path,
      hint: 'Verification key not found. Run build process.',
    });
  }
}

/**
 * Proof verification failed (400)
 */
export class VerificationFailedException extends AppException {
  constructor(circuit: string, reason: string) {
    super('VERIFIER_VERIFICATION_FAILED', {
      circuit,
      reason,
      suggestion: 'The proof or public signals may be invalid.',
    });
  }
}

// ============================================================================
// Validation exceptions
// ============================================================================

/**
 * Missing required request field (400)
 */
export class ValidationMissingFieldException extends AppException {
  constructor(field: string, context?: string) {
    super('VALIDATION_MISSING_FIELD', {
      field,
      context: context || 'request body',
    });
  }
}

/**
 * Invalid field type (400)
 */
export class ValidationInvalidTypeException extends AppException {
  constructor(field: string, expectedType: string, receivedType: string) {
    super('VALIDATION_INVALID_TYPE', {
      field,
      expectedType,
      receivedType,
    });
  }
}
