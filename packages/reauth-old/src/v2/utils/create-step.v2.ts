/**
 * Create Step V2 Utility
 * Utility for creating V2 steps with proper type validation and protocol definitions
 */

import type { Type } from 'arktype';
import type { AuthStepV2, AuthOutput, OrmLike } from '../types.v2';

interface StepOptions<TInput, TOutput, TConfig = unknown, TOrmT extends OrmLike = OrmLike> {
  name: string;
  inputs: Type<TInput>;
  outputs: Type<TOutput>;
  protocol: string;
  meta?: {
    http?: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      codes: Record<string, number>;
      auth?: boolean;
    };
  };
  handler: (
    input: TInput,
    ctx: {
      orm: TOrmT;
      config: TConfig;
      engine?: any;
    }
  ) => Promise<TOutput>;
}

/**
 * Create a V2 authentication step
 */
export function createStepV2<TInput, TOutput, TConfig = unknown, TOrmT extends OrmLike = OrmLike>(
  options: StepOptions<TInput, TOutput, TConfig, TOrmT>
): AuthStepV2<TInput, TOutput, TConfig, TOrmT> {
  const { name, inputs, outputs, protocol, meta, handler } = options;

  return {
    name,
    description: `${name} step`,
    validationSchema: inputs,
    protocol: meta ? {
      http: meta.http ? {
        method: meta.http.method,
        codes: meta.http.codes,
        auth: meta.http.auth ?? false,
      } : undefined,
    } : undefined,
    inputs: extractInputKeys(inputs),
    outputs: outputs,
    
    async run(input: TInput, ctx: any): Promise<TOutput> {
      const orm = await ctx.engine.getOrm();
      return handler(input, {
        orm,
        config: ctx.config,
        engine: ctx.engine,
      });
    },
  } as AuthStepV2<TInput, TOutput, TConfig, TOrmT>;
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