// apps/web/lib/errorHandler.ts
/**
 * Centralized error handling utilities
 * Provides consistent error messages and logging
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common error codes
 */
export const ERROR_CODES = {
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  USER_REJECTED: 'USER_REJECTED',
  INVALID_INPUT: 'INVALID_INPUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PROOF_GENERATION_FAILED: 'PROOF_GENERATION_FAILED',
  INDEXER_ERROR: 'INDEXER_ERROR',
} as const;

/**
 * Parse error and return user-friendly message
 */
export const parseError = (error: unknown): string => {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    // Wallet errors
    if (
      error.message.includes('User rejected') ||
      error.message.includes('User denied')
    ) {
      return 'Transaction was cancelled by user';
    }

    // Insufficient funds
    if (
      error.message.includes('insufficient') ||
      error.message.includes('0x1')
    ) {
      return 'Insufficient balance for this transaction';
    }

    // Network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return 'Network error. Please check your connection and try again.';
    }

    // Simulation failed
    if (error.message.includes('simulation failed')) {
      return 'Transaction simulation failed. Please check your inputs.';
    }

    // Default to error message
    return error.message;
  }

  return 'An unexpected error occurred';
};

/**
 * Get error details for logging
 */
export const getErrorDetails = (
  error: unknown,
): { message: string; stack?: string; name?: string } => {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }

  return {
    message: String(error),
  };
};

/**
 * Handle error with logging
 */
export const handleError = (error: unknown, context?: string): string => {
  const message = parseError(error);
  const details = getErrorDetails(error);

  // Log error (in production, this would go to error tracking service)
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to Sentry or other error tracking service
    console.error(`[${context || 'ERROR'}]`, details);
  } else {
    console.error(`[${context || 'ERROR'}]`, error);
  }

  return message;
};
