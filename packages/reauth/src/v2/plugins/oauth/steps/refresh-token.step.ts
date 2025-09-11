import { type } from 'arktype';
import type { AuthStepV2, OrmLike } from '../../../../types.v2';
import type { OAuthConfigV2 } from '../types';
import { getOAuthProvider, refreshOAuthToken, storeOAuthTokens, hashOAuthToken } from '../utils';

export const refreshTokenStep: AuthStepV2<
  typeof refreshTokenInputSchema.infer,
  typeof refreshTokenOutputSchema.infer,
  OAuthConfigV2,
  OrmLike
> = {
  name: 'refresh-token',
  inputs: type({
    provider: 'string',
    'token?': 'string',
  }),
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'refreshed?': 'boolean',
    'expiresAt?': 'string',
  }),
  protocol: {
    type: 'oauth-refresh',
    description: 'Refresh expired OAuth access token',
    method: 'POST',
    path: '/oauth/refresh',
    requiresAuth: true,
  },
  
  async handler(input, { orm, config, container }) {
    const { provider, token } = input;
    
    try {
      // Verify user is authenticated
      if (!token) {
        return {
          success: false,
          message: 'Authentication required for token refresh',
          status: 'authentication_required',
        };
      }

      // Verify session and get current user
      const sessionService = container.resolve('sessionService');
      const sessionResult = await sessionService.verifySession(token);
      if (!sessionResult.subject) {
        return {
          success: false,
          message: 'Invalid session token',
          status: 'invalid_session',
        };
      }

      const currentSubjectId = sessionResult.subject.id;

      // Get provider configuration
      const oauthProvider = await getOAuthProvider(orm, provider);
      if (!oauthProvider) {
        return {
          success: false,
          message: `OAuth provider '${provider}' not found or inactive`,
          status: 'provider_not_found',
        };
      }

      // Get stored OAuth tokens for this user and provider
      const storedToken = await orm.findFirst('oauth_tokens', {
        where: (b: any) => b('subject_id', '=', currentSubjectId)
          .and(b('provider_id', '=', oauthProvider.id)),
      });

      if (!storedToken) {
        return {
          success: false,
          message: `No ${provider} tokens found for your account`,
          status: 'no_tokens_found',
        };
      }

      if (!storedToken.refresh_token_hash) {
        return {
          success: false,
          message: `No refresh token available for ${provider}`,
          status: 'no_refresh_token',
        };
      }

      // Check if token needs refresh (if expires_at is set and in the past)
      const now = new Date();
      if (storedToken.expires_at && new Date(storedToken.expires_at) > now) {
        return {
          success: true,
          message: 'Token is still valid, no refresh needed',
          status: 'token_still_valid',
          refreshed: false,
          expiresAt: storedToken.expires_at,
        };
      }

      // Note: In a real implementation, you would need to decrypt the refresh token
      // For this example, we'll assume it's stored in a way that can be retrieved
      // This is a security consideration that needs proper implementation
      const refreshToken = storedToken.refresh_token_hash; // This should be decrypted

      try {
        // Refresh the access token
        const tokenResponse = await refreshOAuthToken(
          oauthProvider.token_url,
          oauthProvider.client_id,
          oauthProvider.client_secret, // This should be decrypted
          refreshToken
        );

        // Store the new tokens
        await storeOAuthTokens(orm, currentSubjectId, oauthProvider.id, tokenResponse);

        const expiresAt = tokenResponse.expires_in 
          ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
          : undefined;

        return {
          success: true,
          message: 'OAuth token refreshed successfully',
          status: 'token_refreshed',
          refreshed: true,
          expiresAt,
        };
      } catch (refreshError) {
        // If refresh fails, the refresh token might be expired or invalid
        console.error('Token refresh failed:', refreshError);
        
        // Clean up invalid tokens
        await orm.delete('oauth_tokens', {
          where: (b: any) => b('id', '=', storedToken.id),
        });

        return {
          success: false,
          message: 'Refresh token expired or invalid. Please re-authenticate.',
          status: 'refresh_token_expired',
        };
      }
    } catch (error) {
      console.error('OAuth token refresh error:', error);
      return {
        success: false,
        message: 'Failed to refresh OAuth token',
        status: 'token_refresh_failed',
      };
    }
  },
};

const refreshTokenInputSchema = refreshTokenStep.inputs;
const refreshTokenOutputSchema = refreshTokenStep.outputs;