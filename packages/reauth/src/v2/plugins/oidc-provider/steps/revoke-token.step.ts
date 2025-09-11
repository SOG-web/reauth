/**
 * OIDC Token Revocation Step V2
 * Implements OAuth 2.0 Token Revocation as per RFC 7009
 */

import { type, string } from 'arktype';
import { createStepV2 } from '../../../utils/create-step.v2';
import type { OIDCProviderConfigV2 } from '../types';
import { hashToken } from '../utils';

// Input schema for token revocation request
const RevokeTokenInput = type({
  token: string,
  tokenTypeHint: string.optional(),
  clientId: string,
  clientSecret: string.optional(),
});

// Output schema for token revocation response
const RevokeTokenOutput = type({
  success: 'true',
  status: '"token_revoked" | "invalid_client" | "unsupported_token_type" | "server_error"',
  message: 'string',
});

/**
 * Revoke Token Step
 * 
 * Revokes an access token or refresh token as per RFC 7009.
 * The authorization server invalidates the token making it unusable for future requests.
 * 
 * @example
 * ```typescript
 * const result = await engine.executeStep('revoke-token', {
 *   token: 'access-token-or-refresh-token',
 *   tokenTypeHint: 'access_token',
 *   clientId: 'my-client-id',
 *   clientSecret: 'my-client-secret'
 * });
 * ```
 */
export const revokeTokenStep = createStepV2({
  name: 'revoke-token',
  
  inputs: RevokeTokenInput,
  outputs: RevokeTokenOutput,
  
  protocol: 'oidc-provider.revoke-token.v1',
  
  meta: {
    http: {
      method: 'POST',
      codes: {
        token_revoked: 200,
        invalid_client: 401,
        unsupported_token_type: 400,
        server_error: 500,
      },
      auth: false, // Client authentication via credentials
    },
  },

  async handler(input, { orm, config }) {
    const {
      token,
      tokenTypeHint,
      clientId,
      clientSecret,
    } = input;
    
    const oidcConfig = config as OIDCProviderConfigV2;

    try {
      // 1. Check if token revocation is enabled
      if (!oidcConfig.features.tokenRevocation) {
        return {
          success: false as const,
          status: 'unsupported_token_type' as const,
          message: 'Token revocation not supported',
        };
      }

      // 2. Validate client credentials
      const client = await orm.findFirst('oidc_clients', {
        where: (b: any) => b('client_id', '=', clientId),
      });

      if (!client) {
        return {
          success: false as const,
          status: 'invalid_client' as const,
          message: 'Invalid client credentials',
        };
      }

      // Verify client secret if required
      if (client.client_secret_hash && !clientSecret) {
        return {
          success: false as const,
          status: 'invalid_client' as const,
          message: 'Client secret required',
        };
      }

      if (client.client_secret_hash && clientSecret) {
        const hashedSecret = await hashToken(clientSecret);
        if (hashedSecret !== client.client_secret_hash) {
          return {
            success: false as const,
            status: 'invalid_client' as const,
            message: 'Invalid client secret',
          };
        }
      }

      // 3. Hash the token to find it in database
      const tokenHash = await hashToken(token);
      const now = new Date();
      let tokenRevoked = false;

      // 4. Try to revoke access token first (or if hint suggests it)
      if (!tokenTypeHint || tokenTypeHint === 'access_token') {
        const accessToken = await orm.findFirst('oidc_access_tokens', {
          where: (b: any) => b('token_hash', '=', tokenHash)
            .and(b('client_id', '=', clientId))
            .and(b('revoked_at', 'is', null)),
        });

        if (accessToken) {
          await orm.update('oidc_access_tokens', {
            where: (b: any) => b('id', '=', accessToken.id),
            set: { revoked_at: now },
          });
          tokenRevoked = true;
        }
      }

      // 5. Try to revoke refresh token if access token wasn't found
      if (!tokenRevoked && (!tokenTypeHint || tokenTypeHint === 'refresh_token')) {
        const refreshToken = await orm.findFirst('oidc_refresh_tokens', {
          where: (b: any) => b('token_hash', '=', tokenHash)
            .and(b('client_id', '=', clientId))
            .and(b('revoked_at', 'is', null)),
        });

        if (refreshToken) {
          // Revoke the refresh token
          await orm.update('oidc_refresh_tokens', {
            where: (b: any) => b('id', '=', refreshToken.id),
            set: { revoked_at: now },
          });

          // Also revoke associated access token if it exists
          if (refreshToken.access_token_id) {
            await orm.update('oidc_access_tokens', {
              where: (b: any) => b('id', '=', refreshToken.access_token_id)
                .and(b('revoked_at', 'is', null)),
              set: { revoked_at: now },
            });
          }
          
          tokenRevoked = true;
        }
      }

      // 6. According to RFC 7009, the server should respond with 200 OK
      // even if the token was not found or was already revoked
      return {
        success: true as const,
        status: 'token_revoked' as const,
        message: tokenRevoked 
          ? 'Token revoked successfully'
          : 'Token revocation processed (token may not exist or was already revoked)',
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false as const,
        status: 'server_error' as const,
        message: `Token revocation failed: ${errorMessage}`,
      };
    }
  },
});