/**
 * Input Validation Utilities
 * Provides reusable validation functions with detailed error messages
 */

import {
  ValidationMissingFieldException,
  ValidationInvalidTypeException,
} from './exceptions';

/**
 * Validate that a required field is present
 * @param value - The value to check
 * @param fieldName - The field name for error messages
 * @throws ValidationMissingFieldException if value is missing
 */
export function validateRequired(
  value: any,
  fieldName: string,
  context?: string,
): asserts value {
  if (value === null || value === undefined || value === '') {
    throw new ValidationMissingFieldException(fieldName, context);
  }
}

/**
 * Validate that a field is of a specific type
 * @param value - The value to check
 * @param expectedType - The expected type name
 * @param fieldName - The field name for error messages
 * @throws ValidationInvalidTypeException if type doesn't match
 */
export function validateType(
  value: any,
  expectedType: string,
  fieldName: string,
): void {
  const actualType = Array.isArray(value) ? 'array' : typeof value;

  if (actualType !== expectedType) {
    throw new ValidationInvalidTypeException(
      fieldName,
      expectedType,
      actualType,
    );
  }
}

/**
 * Validate commitment is a valid hex or decimal string
 * @param commitment - The commitment value to validate
 * @throws ValidationInvalidTypeException if not a string
 * @returns true if valid
 */
export function validateCommitment(
  commitment: any,
): asserts commitment is string {
  if (typeof commitment !== 'string') {
    throw new ValidationInvalidTypeException(
      'commitment',
      'string',
      typeof commitment,
    );
  }

  if (commitment.length === 0) {
    throw new ValidationMissingFieldException('commitment');
  }
}

/**
 * Validate circuit name
 * @param circuit - The circuit value to validate
 * @returns true if valid, false otherwise
 */
export function isValidCircuit(
  circuit: any,
): circuit is 'shield' | 'transfer' | 'unshield' {
  return (
    typeof circuit === 'string' &&
    ['shield', 'transfer', 'unshield'].includes(circuit)
  );
}

/**
 * Validate object has all required keys
 * @param obj - The object to validate
 * @param requiredKeys - Array of required key names
 * @throws ValidationMissingFieldException if any key is missing
 */
export function validateRequiredKeys(obj: any, requiredKeys: string[]): void {
  if (!obj || typeof obj !== 'object') {
    throw new ValidationInvalidTypeException('request', 'object', typeof obj);
  }

  for (const key of requiredKeys) {
    if (!(key in obj)) {
      throw new ValidationMissingFieldException(key, 'request body');
    }
  }
}
