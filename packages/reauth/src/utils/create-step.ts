/**
 * Create Step  Utility
 * Utility for creating  steps with proper type validation and protocol definitions
 */

import type { Type } from 'arktype';
import type {
  AuthStep,
  AuthOutput,
  ReAuthCradle,
  AuthInput,
  StepContext,
} from '../types';

interface StepOptions<TConfig> {
  name: string;
  inputs: Type<any>;
  outputs: Type<any>;
  protocol: string;
  meta?: {
    http?: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      codes: Record<string, number>;
      auth?: boolean;
    };
  };
  handler: (
    input: AuthInput,
    ctx: {
      config: TConfig;
      container: ReAuthCradle;
    },
  ) => Promise<AuthOutput>;
}

/**
 * Create a  authentication step
 */
export function createStep<TConfig>(
  options: StepOptions<TConfig>,
): AuthStep<TConfig> {
  const { name, inputs, outputs, protocol, meta, handler } = options;

  return {
    name,
    description: `${name} step`,
    validationSchema: inputs,
    protocol: meta
      ? {
          http: meta.http
            ? {
                method: meta.http.method,
                codes: meta.http.codes,
                auth: meta.http.auth ?? false,
              }
            : undefined,
        }
      : undefined,
    inputs: extractInputKeys(inputs),
    outputs: outputs,

    async run(
      input: AuthInput,
      ctx: StepContext<TConfig>,
    ): Promise<AuthOutput> {
      return handler(input, {
        config: ctx.config,
        container: ctx.container,
      });
    },
  } as AuthStep<TConfig>;
}

/**
 * Extract input keys from arktype schema
 * This is a simplified implementation - in practice you'd need more sophisticated type introspection
 */
function extractInputKeys(inputType: Type<any>): string[] {
  // For now, return a generic set since arktype introspection is complex
  // In a full implementation, you'd parse the type definition
  return ['input']; // This would be dynamically extracted from the type
}
