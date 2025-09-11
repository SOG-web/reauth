/**
 * OIDC UserInfo Endpoint Step V2
 * Implements OpenID Connect UserInfo endpoint specification
 */

import { type, string } from 'arktype';
import { createStepV2 } from '../../../utils/create-step.v2';
import type { OIDCProviderConfigV2 } from '../types';
import { hashToken, generateClaims } from '../utils';

// Input schema for UserInfo request
const GetUserinfoInput = type({
  accessToken: string,
});

// Output schema for UserInfo response
const GetUserinfoOutput = type({
  success: 'true',
  status: '"userinfo_retrieved" | "invalid_token" | "insufficient_scope" | "server_error"',
  message: 'string',
  userInfo: 'unknown', // Will contain user claims
});

/**
 * Get UserInfo Step
 * 
 * Returns user claims based on the provided access token and authorized scopes.
 * Implements OpenID Connect UserInfo endpoint as defined in the specification.
 * 
 * @example
 * ```typescript
 * const result = await engine.executeStep('get-userinfo', {
 *   accessToken: 'access-token-123'
 * });
 * 
 * console.log(result.userInfo.sub); // User ID
 * console.log(result.userInfo.email); // User email (if scope permits)
 * ```
 */
export const getUserinfoStep = createStepV2({
  name: 'get-userinfo',
  
  inputs: GetUserinfoInput,
  outputs: GetUserinfoOutput,
  
  protocol: 'oidc-provider.get-userinfo.v1',
  
  meta: {
    http: {
      method: 'GET',
      codes: {
        userinfo_retrieved: 200,
        invalid_token: 401,
        insufficient_scope: 403,
        server_error: 500,
      },
      auth: false, // Token authentication via access token
    },
  },

  async handler(input, { orm, config }) {
    const { accessToken } = input;
    const oidcConfig = config as OIDCProviderConfigV2;

    try {
      // 1. Hash and validate access token
      const tokenHash = await hashToken(accessToken);
      
      const tokenRecord = await orm.findFirst('oidc_access_tokens', {
        where: (b: any) => b('token_hash', '=', tokenHash)
          .and(b('revoked_at', 'is', null)),
      });

      if (!tokenRecord) {
        return {
          success: false as const,
          status: 'invalid_token' as const,
          message: 'Invalid or revoked access token',
        };
      }

      // 2. Check if token is expired
      if (new Date() > new Date(tokenRecord.expires_at)) {
        return {
          success: false as const,
          status: 'invalid_token' as const,
          message: 'Access token expired',
        };
      }

      // 3. Verify token has appropriate scopes for UserInfo
      const scopes = JSON.parse(tokenRecord.scopes || '[]');
      if (!scopes.includes('openid')) {
        return {
          success: false as const,
          status: 'insufficient_scope' as const,
          message: 'Access token missing openid scope',
        };
      }

      // 4. Get user profile data
      const userProfile = await orm.findFirst('subjects', {
        where: (b: any) => b('id', '=', tokenRecord.user_id),
      });

      if (!userProfile) {
        return {
          success: false as const,
          status: 'server_error' as const,
          message: 'User profile not found',
        };
      }

      // 5. Generate claims based on authorized scopes
      const userClaims = generateClaims(
        tokenRecord.user_id,
        userProfile,
        scopes,
        oidcConfig
      );

      // 6. Ensure 'sub' claim is always present
      const userInfo = {
        sub: tokenRecord.user_id,
        ...userClaims,
      };

      return {
        success: true as const,
        status: 'userinfo_retrieved' as const,
        message: 'User info retrieved successfully',
        userInfo,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false as const,
        status: 'server_error' as const,
        message: `Failed to retrieve user info: ${errorMessage}`,
      };
    }
  },
});