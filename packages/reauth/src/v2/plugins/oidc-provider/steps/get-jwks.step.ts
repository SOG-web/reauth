/**
 * OIDC JWKS (JSON Web Key Set) Step V2
 * Implements RFC 7517 JSON Web Key Set standard
 */

import { type } from 'arktype';
import type { AuthStepV2, OrmLike } from '../../../types.v2';
import type { OIDCProviderConfigV2 } from '../types';

// Input schema for JWKS request
const getJwksInputSchema = type({
  'keyId?': 'string',
});

// Output schema for JWKS response
const getJwksOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  jwks: 'unknown', // Will contain the JWK Set
});

/**
 * Get JWKS (JSON Web Key Set) Step
 * 
 * Returns the JSON Web Key Set containing public keys used for verifying
 * JWT tokens issued by this OIDC provider. Implements RFC 7517.
 * 
 * @example
 * ```typescript
 * const result = await engine.executeStep('get-jwks', {});
 * 
 * console.log(result.jwks.keys); // Array of JWK objects
 * ```
 */
export const getJwksStep: AuthStepV2<
  typeof getJwksInputSchema.infer,
  typeof getJwksOutputSchema.infer,
  OIDCProviderConfigV2,
  OrmLike
> = {
  name: 'get-jwks',
  validationSchema: getJwksInputSchema,
  inputs: ['keyId'],
  outputs: getJwksOutputSchema,
  protocol: {
    type: 'oidc-provider.get-jwks',
    description: 'Get JWKS (JSON Web Key Set)',
    method: 'GET',
    path: '/.well-known/jwks.json',
  },

  async run(input, ctx) {
    const oidcConfig = ctx.config as OIDCProviderConfigV2;
    const orm = await ctx.engine.getOrm();

    try {
      // Get active signing keys from database
      const activeKeys = await orm.findMany('oidc_keys', {
        where: (b: any) => b('is_active', '=', true)
          .and(b('key_use', '=', 'sig')),
        orderBy: [
          ['created_at', 'desc'],
        ],
      });

      if (!activeKeys || activeKeys.length === 0) {
        return {
          success: false,
          status: 'no_keys_found',
          message: 'No active signing keys found',
          jwks: null,
        };
      }

      // Convert stored keys to JWK format
      const jwks = {
        keys: activeKeys.map((keyRecord: any) => {
          const jwk: any = {
            kty: keyRecord.key_type, // 'RSA' or 'EC'
            use: keyRecord.key_use, // 'sig'
            alg: keyRecord.algorithm, // 'RS256', 'ES256', etc.
            kid: keyRecord.key_id,
          };

          // Parse the public key (in a real implementation, you'd properly format this)
          // This is a simplified version - in production you'd use proper cryptographic libraries
          if (keyRecord.key_type === 'RSA') {
            jwk.n = keyRecord.public_key; // RSA modulus (base64url encoded)
            jwk.e = 'AQAB'; // RSA exponent (typically 65537 = AQAB in base64url)
          } else if (keyRecord.key_type === 'EC') {
            jwk.crv = 'P-256'; // Curve name
            jwk.x = keyRecord.public_key; // EC x coordinate
            jwk.y = keyRecord.public_key; // EC y coordinate (simplified)
          }

          return jwk;
        }),
      };

      return {
        success: true,
        status: 'jwks_retrieved',
        message: 'JWKS retrieved successfully',
        jwks,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        status: 'key_error',
        message: `Failed to retrieve JWKS: ${errorMessage}`,
        jwks: null,
      };
    }
  },
};