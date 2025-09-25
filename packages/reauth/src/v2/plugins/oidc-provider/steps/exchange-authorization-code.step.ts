/**
 * OIDC Exchange Authorization Code Step V2
 * Implements OAuth 2.0 token endpoint for authorization code exchange
 */

import { type } from 'arktype';
import { createStepV2 } from '../../../utils/create-step.v2';
import type { OIDCProviderConfigV2 } from '../types';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  calculateExpirationDate,
  validatePkceChallenge,
  generateSecureRandom,
  createIdTokenClaims,
} from '../utils';

// Input schema for token exchange request
const ExchangeAuthorizationCodeInput = type({
  grantType: 'string',
  clientId: 'string',
  clientSecret: 'string?',
  code: 'string',
  redirectUri: 'string',
  codeVerifier: 'string?',
});

// Output schema for token response
const ExchangeAuthorizationCodeOutput = type({
  success: 'boolean',
  status:
    '"tokens_issued" | "invalid_request" | "invalid_client" | "invalid_grant" | "unsupported_grant_type"',
  message: 'string',
  accessToken: 'string?',
  tokenType: 'string?',
  expiresIn: 'number?',
  refreshToken: 'string?',
  idToken: 'string?',
  scope: 'string?',
});

/**
 * Exchange Authorization Code Step
 *
 * Exchanges an authorization code for access token, refresh token, and ID token.
 * Implements the OAuth 2.0 token endpoint as defined in RFC 6749 with OIDC extensions.
 *
 * @example
 * ```typescript
 * const result = await engine.executeStep('exchange-authorization-code', {
 *   grantType: 'authorization_code',
 *   clientId: 'my-client-id',
 *   clientSecret: 'my-client-secret',
 *   code: 'auth-code-123',
 *   redirectUri: 'https://app.example.com/callback'
 * });
 * ```
 */
export const exchangeAuthorizationCodeStep = createStepV2({
  name: 'exchange-authorization-code',

  inputs: ExchangeAuthorizationCodeInput,
  outputs: ExchangeAuthorizationCodeOutput,

  protocol: 'oidc-provider.exchange-authorization-code.v1',

  meta: {
    http: {
      method: 'POST',
      codes: {
        tokens_issued: 200,
        invalid_request: 400,
        invalid_client: 401,
        invalid_grant: 400,
        unsupported_grant_type: 400,
      },
      auth: false, // Client authentication via credentials
    },
  },

  async handler(input, { orm, config }) {
    const {
      grantType,
      clientId,
      clientSecret,
      code,
      redirectUri,
      codeVerifier,
    } = input;

    const oidcConfig = config as OIDCProviderConfigV2;

    try {
      // 1. Validate grant type
      if (grantType !== 'authorization_code') {
        return {
          success: false as const,
          status: 'unsupported_grant_type' as const,
          message: 'Unsupported grant type',
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

      // Verify client secret if required (simplified hash comparison)
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

      // 3. Retrieve and validate authorization code
      const authCode = await orm.findFirst('oidc_authorization_codes', {
        where: (b: any) =>
          b('code', '=', code).and(b('client_id', '=', clientId)),
      });

      if (!authCode) {
        return {
          success: false as const,
          status: 'invalid_grant' as const,
          message: 'Invalid authorization code',
        };
      }

      // Check if code is expired
      if (new Date() > new Date(authCode.expires_at)) {
        return {
          success: false as const,
          status: 'invalid_grant' as const,
          message: 'Authorization code expired',
        };
      }

      // Check if code has already been used
      if (authCode.used_at) {
        return {
          success: false as const,
          status: 'invalid_grant' as const,
          message: 'Authorization code already used',
        };
      }

      // Validate redirect URI matches
      if (authCode.redirect_uri !== redirectUri) {
        return {
          success: false as const,
          status: 'invalid_grant' as const,
          message: 'Redirect URI mismatch',
        };
      }

      // 4. Validate PKCE if code challenge was used
      if (authCode.code_challenge) {
        if (!codeVerifier) {
          return {
            success: false as const,
            status: 'invalid_request' as const,
            message: 'PKCE code verifier required',
          };
        }

        const method = authCode.code_challenge_method || 'S256';
        if (
          !validatePkceChallenge(codeVerifier, authCode.code_challenge, method)
        ) {
          return {
            success: false as const,
            status: 'invalid_grant' as const,
            message: 'Invalid PKCE code verifier',
          };
        }
      }

      // 5. Mark authorization code as used
      await orm.updateMany('oidc_authorization_codes', {
        where: (b: any) => b('id', '=', authCode.id),
        set: { used_at: new Date() },
      });

      // 6. Generate access token
      const accessToken = generateAccessToken();
      const accessTokenHash = await hashToken(accessToken);
      const accessTokenExpiresAt = calculateExpirationDate(
        oidcConfig.tokens.accessTokenTtl,
      );

      const scopes = JSON.parse(authCode.scopes || '["openid"]');

      const accessTokenRecord = {
        id: generateSecureRandom(16),
        token_hash: accessTokenHash,
        client_id: clientId,
        user_id: authCode.user_id,
        scopes: JSON.stringify(scopes),
        token_type: 'Bearer',
        expires_at: accessTokenExpiresAt,
        revoked_at: null,
        created_at: new Date(),
      };

      await orm.create('oidc_access_tokens', accessTokenRecord);

      // 7. Generate refresh token (if enabled and requested)
      let refreshToken: string | undefined;
      if (
        oidcConfig.features.refreshTokens &&
        scopes.includes('offline_access')
      ) {
        refreshToken = generateRefreshToken();
        const refreshTokenHash = await hashToken(refreshToken);
        const refreshTokenExpiresAt = new Date();
        refreshTokenExpiresAt.setDate(
          refreshTokenExpiresAt.getDate() + oidcConfig.tokens.refreshTokenTtl,
        );

        const refreshTokenRecord = {
          id: generateSecureRandom(16),
          token_hash: refreshTokenHash,
          access_token_id: accessTokenRecord.id,
          client_id: clientId,
          user_id: authCode.user_id,
          scopes: JSON.stringify(scopes),
          expires_at: refreshTokenExpiresAt,
          revoked_at: null,
          created_at: new Date(),
        };

        await orm.create('oidc_refresh_tokens', refreshTokenRecord);
      }

      // 8. Generate ID token (if openid scope is present)
      let idToken: string | undefined;
      if (scopes.includes('openid')) {
        // Get user profile for claims
        const userProfile = await orm.findFirst('subjects', {
          where: (b: any) => b('id', '=', authCode.user_id),
        });

        if (userProfile) {
          const idTokenClaims = createIdTokenClaims(
            oidcConfig,
            authCode.user_id,
            clientId,
            userProfile,
            scopes,
            authCode.nonce || undefined,
            new Date(authCode.auth_time),
          );

          // In a real implementation, you would properly sign the JWT here
          // This is a simplified version for demonstration
          const header = {
            alg: oidcConfig.tokens.signingAlgorithm,
            typ: 'JWT',
          };
          const headerB64 = btoa(JSON.stringify(header));
          const payloadB64 = btoa(JSON.stringify(idTokenClaims));
          const signature = 'signature'; // Would be actual signature

          idToken = `${headerB64}.${payloadB64}.${signature}`;

          // Store ID token for audit
          const idTokenRecord = {
            id: generateSecureRandom(16),
            jti: idTokenClaims.jti!,
            client_id: clientId,
            user_id: authCode.user_id,
            audience: JSON.stringify(
              Array.isArray(idTokenClaims.aud)
                ? idTokenClaims.aud
                : [idTokenClaims.aud],
            ),
            scopes: JSON.stringify(scopes),
            auth_time: authCode.auth_time ? new Date(authCode.auth_time) : null,
            issued_at: new Date(),
            expires_at: new Date(idTokenClaims.exp * 1000),
            nonce: authCode.nonce || null,
          };

          await orm.create('oidc_id_tokens', idTokenRecord);
        }
      }

      return {
        success: true as const,
        status: 'tokens_issued' as const,
        message: 'Tokens issued successfully',
        accessToken,
        tokenType: 'Bearer',
        expiresIn: oidcConfig.tokens.accessTokenTtl * 60, // Convert minutes to seconds
        refreshToken,
        idToken,
        scope: scopes.join(' '),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false as const,
        status: 'invalid_request' as const,
        message: `Token exchange failed: ${errorMessage}`,
      };
    }
  },
});
