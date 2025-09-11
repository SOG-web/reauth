/**
 * OIDC JWKS (JSON Web Key Set) Step V2
 * Implements RFC 7517 JSON Web Key Set standard
 */

import { type, string } from 'arktype';
import { createStepV2 } from '../../../utils/create-step.v2';
import type { OIDCProviderConfigV2 } from '../types';

// Input schema for JWKS request
const GetJwksInput = type({
  // JWKS endpoint typically doesn't need parameters
  // but we include this for consistency
  keyId: string.optional(),
});

// Output schema for JWKS response
const GetJwksOutput = type({
  success: 'true',
  status: '"jwks_retrieved"',
  message: 'string',
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
export const getJwksStep = createStepV2({
  name: 'get-jwks',
  
  inputs: GetJwksInput,
  outputs: GetJwksOutput,
  
  protocol: 'oidc-provider.get-jwks.v1',
  
  meta: {
    http: {
      method: 'GET',
      codes: {
        jwks_retrieved: 200,
        no_keys_found: 404,
        key_error: 500,
      },
      auth: false, // JWKS is public endpoint
    },
  },

  async handler(input, { orm, config }) {
    const oidcConfig = config as OIDCProviderConfigV2;

    try {
      // Get active signing keys from database
      const activeKeys = await orm.findMany('oidc_keys', {
        where: (b: any) => b('is_active', '=', true)
          .and(b('key_use', '=', 'sig')),
        orderBy: (b: any) => b('created_at', 'desc'),
      });

      if (!activeKeys || activeKeys.length === 0) {
        return {
          success: false as const,
          status: 'no_keys_found' as const,
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
        success: true as const,
        status: 'jwks_retrieved' as const,
        message: 'JWKS retrieved successfully',
        jwks,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false as const,
        status: 'key_error' as const,
        message: `Failed to retrieve JWKS: ${errorMessage}`,
        jwks: null,
      };
    }
  },
});