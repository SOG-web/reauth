/**
 * OIDC Begin Authorization Step V2
 * Implements OAuth 2.0 Authorization Code Flow initiation with OIDC extensions
 */

import { type, string, array } from 'arktype';
import { createStepV2 } from '../../../utils/create-step.v2';
import type { OIDCProviderConfigV2 } from '../types';
import { 
  generateAuthorizationCode, 
  validateRedirectUri, 
  validateScopes,
  calculateExpirationDate,
  generateSecureRandom 
} from '../utils';

// Input schema for authorization request
const BeginAuthorizationInput = type({
  clientId: string,
  redirectUri: string,
  responseType: string,
  scopes: array(string),
  state: string.optional(),
  nonce: string.optional(),
  codeChallenge: string.optional(),
  codeChallengeMethod: string.optional(),
  prompt: string.optional(),
  maxAge: 'number | undefined',
  loginHint: string.optional(),
  uiLocales: string.optional(),
  userId: string, // Assumes user is already authenticated
});

// Output schema for authorization response
const BeginAuthorizationOutput = type({
  success: 'true',
  status: '"authorization_code_generated" | "authorization_pending" | "invalid_request" | "unauthorized_client" | "unsupported_response_type" | "invalid_scope" | "server_error"',
  message: 'string',
  authorizationCode: string.optional(),
  redirectUrl: string.optional(),
  state: string.optional(),
});

/**
 * Begin Authorization Step
 * 
 * Initiates the OIDC authorization flow by validating the authorization request
 * and generating an authorization code for the authorization code flow.
 * 
 * @example
 * ```typescript
 * const result = await engine.executeStep('begin-authorization', {
 *   clientId: 'my-client-id',
 *   redirectUri: 'https://app.example.com/callback',
 *   responseType: 'code',
 *   scopes: ['openid', 'profile', 'email'],
 *   state: 'random-state-value',
 *   userId: 'user-123'
 * });
 * ```
 */
export const beginAuthorizationStep = createStepV2({
  name: 'begin-authorization',
  
  inputs: BeginAuthorizationInput,
  outputs: BeginAuthorizationOutput,
  
  protocol: 'oidc-provider.begin-authorization.v1',
  
  meta: {
    http: {
      method: 'POST',
      codes: {
        authorization_code_generated: 302, // Redirect with code
        authorization_pending: 200, // Need user interaction
        invalid_request: 400,
        unauthorized_client: 401,
        unsupported_response_type: 400,
        invalid_scope: 400,
        server_error: 500,
      },
      auth: true, // User must be authenticated
    },
  },

  async handler(input, { orm, config }) {
    const {
      clientId,
      redirectUri,
      responseType,
      scopes,
      state,
      nonce,
      codeChallenge,
      codeChallengeMethod,
      prompt,
      maxAge,
      userId,
    } = input;
    
    const oidcConfig = config as OIDCProviderConfigV2;

    try {
      // 1. Validate client
      const client = await orm.findFirst('oidc_clients', {
        where: (b: any) => b('client_id', '=', clientId),
      });

      if (!client) {
        return {
          success: false as const,
          status: 'unauthorized_client' as const,
          message: 'Invalid client ID',
        };
      }

      // 2. Validate redirect URI
      const clientRedirectUris = Array.isArray(client.redirect_uris) 
        ? client.redirect_uris 
        : JSON.parse(client.redirect_uris || '[]');
        
      if (!clientRedirectUris.includes(redirectUri)) {
        return {
          success: false as const,
          status: 'invalid_request' as const,
          message: 'Invalid redirect URI',
        };
      }

      if (!validateRedirectUri(redirectUri, oidcConfig.security.allowInsecureRedirectUris)) {
        return {
          success: false as const,
          status: 'invalid_request' as const,
          message: 'Insecure redirect URI not allowed',
        };
      }

      // 3. Validate response type
      const clientResponseTypes = Array.isArray(client.response_types)
        ? client.response_types
        : JSON.parse(client.response_types || '["code"]');
        
      if (!clientResponseTypes.includes(responseType)) {
        return {
          success: false as const,
          status: 'unsupported_response_type' as const,
          message: 'Unsupported response type for this client',
        };
      }

      // 4. Validate and filter scopes
      const validScopes = validateScopes(scopes, oidcConfig);
      if (validScopes.length === 0 || !validScopes.includes('openid')) {
        return {
          success: false as const,
          status: 'invalid_scope' as const,
          message: 'Invalid scopes or missing openid scope',
        };
      }

      // 5. Validate PKCE if required
      if (oidcConfig.security.requirePkce && !codeChallenge) {
        return {
          success: false as const,
          status: 'invalid_request' as const,
          message: 'PKCE code challenge required',
        };
      }

      if (codeChallenge) {
        const method = codeChallengeMethod || 'S256';
        if (method !== 'S256' && method !== 'plain') {
          return {
            success: false as const,
            status: 'invalid_request' as const,
            message: 'Invalid PKCE code challenge method',
          };
        }
        
        if (method === 'plain' && !oidcConfig.security.allowPlaintextPkce) {
          return {
            success: false as const,
            status: 'invalid_request' as const,
            message: 'Plain PKCE not allowed',
          };
        }
      }

      // 6. Generate authorization code for authorization code flow
      if (responseType === 'code') {
        const authCode = generateAuthorizationCode();
        const expiresAt = calculateExpirationDate(oidcConfig.tokens.authorizationCodeTtl);
        
        // Store authorization code
        const codeRecord = {
          id: generateSecureRandom(16),
          code: authCode,
          client_id: clientId,
          user_id: userId,
          redirect_uri: redirectUri,
          scopes: JSON.stringify(validScopes),
          nonce: nonce || null,
          state: state || null,
          code_challenge: codeChallenge || null,
          code_challenge_method: codeChallengeMethod || null,
          auth_time: new Date(),
          expires_at: expiresAt,
          used_at: null,
          created_at: new Date(),
        };

        await orm.insertOne('oidc_authorization_codes', codeRecord);

        // Build redirect URL with authorization code
        const redirectUrl = new URL(redirectUri);
        redirectUrl.searchParams.set('code', authCode);
        if (state) {
          redirectUrl.searchParams.set('state', state);
        }

        return {
          success: true as const,
          status: 'authorization_code_generated' as const,
          message: 'Authorization code generated successfully',
          authorizationCode: authCode,
          redirectUrl: redirectUrl.toString(),
          state: state || undefined,
        };
      }

      // Handle other response types (implicit, hybrid) - simplified for now
      return {
        success: false as const,
        status: 'unsupported_response_type' as const,
        message: 'Response type not yet implemented',
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false as const,
        status: 'server_error' as const,
        message: `Authorization failed: ${errorMessage}`,
      };
    }
  },
});