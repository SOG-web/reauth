import { ValidationResult } from '../types';
import { TraversalError, Type } from 'arktype';

/**
 * Utility function to validate an entire input object against a ValidationSchema
 *
 * This function is used to validate input using the built-in ValidationSchema type
 *
 * @param schema ValidationSchema with validation rules
 * @param input The input data to validate
 * @returns ValidationResult compatible with reauth's validation system
 */
export async function validateInputWithValidationSchema(
  schema: Type<any>,
  input: Record<string, any>,
): Promise<ValidationResult> {
  try {
    const data = schema.assert(input);
  } catch (error) {
    if (error instanceof TraversalError) {
      return {
        isValid: false,
        errors: {
          _error: error.message,
        },
      };
    }

    return {
      isValid: false,
      errors: {
        _error: 'Unknown validation error',
      },
    };
  }
  return {
    isValid: true,
  };
}
