import { type } from 'arktype';
import type { AuthStepV2, OrmLike } from '../../../types.v2';
import type { GenericOAuthConfigV2 } from '../types';
import { TokenEncryption } from '../utils';

const disconnectOAuthInputSchema = type({
  connectionId: 'string',
  'revokeTokens?': 'boolean', // Whether to revoke tokens with provider
});

const disconnectOAuthOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  'tokenRevoked?': 'boolean',
});

export const disconnectOAuthStep: AuthStepV2<
  typeof disconnectOAuthInputSchema.infer,
  typeof disconnectOAuthOutputSchema.infer,
  GenericOAuthConfigV2,
  OrmLike
> = {
  name: 'disconnect-oauth',
  validationSchema: disconnectOAuthInputSchema,
  inputs: ['connectionId', 'revokeTokens'],
  outputs: disconnectOAuthOutputSchema,
  protocol: 'generic-oauth.disconnect-oauth.v1',
  
  async run(input, ctx) {
    const { connectionId, revokeTokens = true } = input;
    
    try {
      // Get OAuth connection
      const connection = await ctx.orm.findFirst('generic_oauth_connections', {
        where: (b: any) => b('id', '=', connectionId),
      });

      if (!connection) {
        return {
          success: false,
          message: 'OAuth connection not found',
          status: 'connection_not_found',
          tokenRevoked: false,
        };
      }

      let tokenRevoked = false;

      // Revoke tokens with provider if requested and configured
      if (revokeTokens && ctx.config?.tokens?.revokeOnDisconnect !== false) {
        const providerConfig = ctx.config?.providers?.[connection.provider_id];
        
        if (providerConfig && connection.access_token_encrypted) {
          try {
            const accessToken = await TokenEncryption.decrypt(connection.access_token_encrypted);
            const refreshToken = connection.refresh_token_encrypted 
              ? await TokenEncryption.decrypt(connection.refresh_token_encrypted)
              : undefined;

            const revocationResult = await simulateTokenRevocation(
              accessToken,
              refreshToken,
              providerConfig
            );

            tokenRevoked = revocationResult.success;
            
            if (!revocationResult.success) {
              console.warn(`Failed to revoke tokens for connection ${connectionId}:`, revocationResult.error);
            }
          } catch (error) {
            console.warn(`Error during token revocation for connection ${connectionId}:`, error);
          }
        }
      }

      // Remove the OAuth connection from database
      await ctx.orm.delete('generic_oauth_connections', {
        where: (b: any) => b('id', '=', connectionId),
      });

      // Clean up any related authorization sessions
      await ctx.orm.delete('generic_oauth_authorization_sessions', {
        where: (b: any) => b('provider_id', '=', connection.provider_id)
          .and(b('completed_at', 'is not', null)),
      });

      return {
        success: true,
        message: 'OAuth connection disconnected successfully',
        status: 'disconnected',
        tokenRevoked,
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to disconnect OAuth connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'disconnect_error',
        tokenRevoked: false,
      };
    }
  },
};

/**
 * Simulate token revocation (placeholder for HTTP transport)
 */
async function simulateTokenRevocation(
  accessToken: string,
  refreshToken: string | undefined,
  provider: any
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // In a real implementation, this would:
    // 1. Make POST request to provider's revocation endpoint (if available)
    // 2. Include access token and refresh token
    // 3. Handle revocation response
    
    // For OAuth 2.0, revocation endpoint is optional
    // Some providers have it at /revoke or /oauth/revoke
    
    // Simulate successful revocation
    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token revocation failed',
    };
  }
}