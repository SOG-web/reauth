import { type } from 'arktype';
import type { AuthStepV2, OrmLike } from '../../../types.v2';
import type { GenericOAuthConfigV2 } from '../types';
import { TokenEncryption } from '../utils';

const refreshOAuth2TokenInputSchema = type({
  connectionId: 'string',
});

const refreshOAuth2TokenOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  'accessToken?': 'string',
  'refreshToken?': 'string',
  'tokenType?': 'string',
  'expiresIn?': 'number',
});

export const refreshOAuth2TokenStep: AuthStepV2<
  typeof refreshOAuth2TokenInputSchema.infer,
  typeof refreshOAuth2TokenOutputSchema.infer,
  GenericOAuthConfigV2,
  OrmLike
> = {
  name: 'refresh-oauth2-token',
  validationSchema: refreshOAuth2TokenInputSchema,
  inputs: ['connectionId'],
  outputs: refreshOAuth2TokenOutputSchema,
  protocol: {
    http: {
      method: 'POST',
      codes: {
        token_refreshed: 200,
        connection_not_found: 404,
        no_refresh_token: 400,
        provider_not_found: 404,
        invalid_oauth_version: 400,
        refresh_failed: 502,
        refresh_error: 500,
      },
      auth: false,
    },
  },
  
  async run(input, ctx) {
    const { connectionId } = input;
    const orm = await ctx.engine.getOrm();
    
    try {
      // Get OAuth connection
      const connection = await orm.findFirst('generic_oauth_connections', {
        where: (b: any) => b('id', '=', connectionId),
      });

      if (!connection) {
        return {
          success: false,
          message: 'OAuth connection not found',
          status: 'connection_not_found',
        };
      }

      // Check if refresh token exists
      if (!connection.refresh_token_encrypted) {
        return {
          success: false,
          message: 'No refresh token available for this connection',
          status: 'no_refresh_token',
        };
      }

      // Get provider configuration
      const providerKey = String(connection.provider_id);
      const providerConfig = (ctx.config?.providers as any)?.[providerKey];
      if (!providerConfig) {
        return {
          success: false,
          message: `OAuth provider '${connection.provider_id}' not found in configuration`,
          status: 'provider_not_found',
        };
      }

      if (providerConfig.version !== '2.0') {
        return {
          success: false,
          message: `Provider '${connection.provider_id}' is not configured for OAuth 2.0`,
          status: 'invalid_oauth_version',
        };
      }

      // Decrypt refresh token
      const refreshToken = await TokenEncryption.decrypt(String(connection.refresh_token_encrypted));

      // Perform token refresh
      const refreshResult = await simulateTokenRefresh(refreshToken, providerConfig);

      if (!refreshResult.success) {
        return {
          success: false,
          message: refreshResult.error || 'Token refresh failed',
          status: 'refresh_failed',
        };
      }

      // Encrypt new tokens
      const newAccessTokenEncrypted = await TokenEncryption.encrypt(refreshResult.accessToken!);
      const newRefreshTokenEncrypted = refreshResult.refreshToken 
        ? await TokenEncryption.encrypt(refreshResult.refreshToken)
        : connection.refresh_token_encrypted; // Keep existing if not provided

      // Update connection with new tokens
      const newExpiresAt = refreshResult.expiresAt || 
        new Date(Date.now() + (refreshResult.expiresIn || 3600) * 1000);

      await orm.updateMany('generic_oauth_connections', {
        where: (b: any) => b('id', '=', connectionId),
        set: {
          access_token_encrypted: newAccessTokenEncrypted,
          refresh_token_encrypted: newRefreshTokenEncrypted,
          expires_at: newExpiresAt,
          updated_at: new Date(),
          last_used_at: new Date(),
        },
      });

      return {
        success: true,
        message: 'OAuth 2.0 token refreshed successfully',
        status: 'token_refreshed',
        accessToken: refreshResult.accessToken,
        refreshToken: refreshResult.refreshToken,
        tokenType: refreshResult.tokenType,
        expiresIn: refreshResult.expiresIn,
      };

    } catch (error) {
      return {
        success: false,
        message: `OAuth 2.0 token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'refresh_error',
      };
    }
  },
};

/**
 * Simulate token refresh (placeholder for HTTP transport)
 */
async function simulateTokenRefresh(
  refreshToken: string,
  provider: any
): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  expiresAt?: Date;
  error?: string;
}> {
  try {
    // In a real implementation, this would:
    // 1. Make POST request to provider.tokenUrl
    // 2. Include refresh_token, client_id, client_secret, grant_type=refresh_token
    // 3. Parse response and extract new tokens
    
    // Simulate successful token refresh
    const accessToken = `refreshed_access_token_${Date.now()}`;
    const newRefreshToken = `refreshed_refresh_token_${Date.now()}`;
    const expiresIn = 3600; // 1 hour
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    
    return {
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn,
      expiresAt,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token refresh failed',
    };
  }
}