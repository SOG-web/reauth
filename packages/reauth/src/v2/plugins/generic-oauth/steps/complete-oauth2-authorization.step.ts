import { type } from 'arktype';
import type { AuthStepV2, OrmLike } from '../../../types.v2';
import type { GenericOAuthConfigV2, OAuthUserProfile } from '../types';
import { 
  validateOAuthState,
  parseUserProfile,
  TokenEncryption,
} from '../utils';

const completeOAuth2AuthorizationInputSchema = type({
  sessionId: 'string',
  code: 'string',
  state: 'string',
  'error?': 'string',
  'errorDescription?': 'string',
});

const completeOAuth2AuthorizationOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  'accessToken?': 'string',
  'refreshToken?': 'string',
  'tokenType?': 'string',
  'expiresIn?': 'number',
  'scopes?': 'string[]',
  'userProfile?': {
    id: 'string',
    'email?': 'string',
    'name?': 'string',
    'avatar?': 'string',
    raw: 'record<unknown>',
  },
  'connectionId?': 'string',
});

export const completeOAuth2AuthorizationStep: AuthStepV2<
  typeof completeOAuth2AuthorizationInputSchema.infer,
  typeof completeOAuth2AuthorizationOutputSchema.infer,
  GenericOAuthConfigV2,
  OrmLike
> = {
  name: 'complete-oauth2-authorization',
  validationSchema: completeOAuth2AuthorizationInputSchema,
  inputs: ['sessionId', 'code', 'state', 'error', 'errorDescription'],
  outputs: completeOAuth2AuthorizationOutputSchema,
  protocol: {
    type: 'generic-oauth.complete-oauth2-authorization.v1',
    description: 'Complete OAuth 2.0 authorization',
    method: 'POST',
    path: '/oauth2/complete',
  },
  
  async run(input, ctx) {
    const { sessionId, code, state, error, errorDescription } = input;
    
    try {
      // Handle OAuth error responses
      if (error) {
        return {
          success: false,
          message: `OAuth authorization failed: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`,
          status: 'oauth_error',
        };
      }

      // Get authorization session
      const session = await ctx.orm.findFirst('generic_oauth_authorization_sessions', {
        where: (b: any) => b('id', '=', sessionId),
      });

      if (!session) {
        return {
          success: false,
          message: 'Authorization session not found',
          status: 'session_not_found',
        };
      }

      // Check session expiration
      if (new Date() > new Date(session.expires_at)) {
        return {
          success: false,
          message: 'Authorization session has expired',
          status: 'session_expired',
        };
      }

      // Validate state parameter
      if (!validateOAuthState(state, session.state)) {
        return {
          success: false,
          message: 'Invalid state parameter - possible CSRF attack',
          status: 'invalid_state',
        };
      }

      // Get provider configuration
      const providerConfig = ctx.config?.providers?.[session.provider_id];
      if (!providerConfig) {
        return {
          success: false,
          message: `OAuth provider '${session.provider_id}' not found in configuration`,
          status: 'provider_not_found',
        };
      }

      // Exchange authorization code for tokens
      // Note: This would require HTTP transport layer in a real implementation
      // For protocol-agnostic design, we simulate the token exchange here
      const tokenExchangeResult = await simulateTokenExchange(code, session, providerConfig);
      
      if (!tokenExchangeResult.success) {
        return {
          success: false,
          message: tokenExchangeResult.error || 'Token exchange failed',
          status: 'token_exchange_failed',
        };
      }

      // Fetch user profile
      // Note: This would also require HTTP transport layer
      const userProfileResult = await simulateUserProfileFetch(
        tokenExchangeResult.accessToken!,
        providerConfig
      );

      if (!userProfileResult.success) {
        return {
          success: false,
          message: userProfileResult.error || 'Failed to fetch user profile',
          status: 'profile_fetch_failed',
        };
      }

      const userProfile = parseUserProfile(userProfileResult.profile!, providerConfig);

      // Encrypt tokens for storage
      const accessTokenEncrypted = await TokenEncryption.encrypt(tokenExchangeResult.accessToken!);
      const refreshTokenEncrypted = tokenExchangeResult.refreshToken 
        ? await TokenEncryption.encrypt(tokenExchangeResult.refreshToken)
        : null;

      // Create or update OAuth connection
      let connectionId: string;
      const existingConnection = await ctx.orm.findFirst('generic_oauth_connections', {
        where: (b: any) => b('provider_id', '=', session.provider_id)
          .and(b('provider_user_id', '=', userProfile.id)),
      });

      if (existingConnection) {
        // Update existing connection
        connectionId = existingConnection.id;
        await ctx.orm.update('generic_oauth_connections', {
          where: (b: any) => b('id', '=', connectionId),
          set: {
            access_token_encrypted: accessTokenEncrypted,
            refresh_token_encrypted: refreshTokenEncrypted,
            token_type: tokenExchangeResult.tokenType || 'Bearer',
            expires_at: tokenExchangeResult.expiresAt || null,
            scopes: session.scopes || [],
            profile_data: userProfile,
            updated_at: new Date(),
            last_used_at: new Date(),
          },
        });
      } else {
        // Create new connection
        connectionId = `oauth_conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Determine user ID (from session or create new user)
        let userId = session.user_id;
        if (!userId) {
          // Create new user - in real implementation, this would use the user management system
          userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Note: In a complete implementation, you would create the user record here
          // This is simplified for the protocol-agnostic design
        }

        await ctx.orm.insertOne('generic_oauth_connections', {
          id: connectionId,
          user_id: userId,
          provider_id: session.provider_id,
          provider_user_id: userProfile.id,
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: refreshTokenEncrypted,
          token_type: tokenExchangeResult.tokenType || 'Bearer',
          expires_at: tokenExchangeResult.expiresAt || null,
          scopes: session.scopes || [],
          profile_data: userProfile,
          created_at: new Date(),
          updated_at: new Date(),
          last_used_at: new Date(),
        });
      }

      // Mark session as completed
      await ctx.orm.update('generic_oauth_authorization_sessions', {
        where: (b: any) => b('id', '=', sessionId),
        set: {
          completed_at: new Date(),
        },
      });

      return {
        success: true,
        message: 'OAuth 2.0 authorization completed successfully',
        status: 'authorization_completed',
        accessToken: tokenExchangeResult.accessToken,
        refreshToken: tokenExchangeResult.refreshToken,
        tokenType: tokenExchangeResult.tokenType,
        expiresIn: tokenExchangeResult.expiresIn,
        scopes: session.scopes,
        userProfile,
        connectionId,
      };

    } catch (error) {
      return {
        success: false,
        message: `OAuth 2.0 authorization completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'authorization_completion_failed',
      };
    }
  },
};

/**
 * Simulate token exchange (placeholder for HTTP transport)
 * In a real implementation, this would make HTTP requests to the provider's token endpoint
 */
async function simulateTokenExchange(
  code: string,
  session: any,
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
  // This is a placeholder simulation
  // In real implementation, this would:
  // 1. Make POST request to provider.tokenUrl
  // 2. Include code, client_id, client_secret, redirect_uri
  // 3. Include code_verifier if PKCE was used
  // 4. Parse response and extract tokens
  
  try {
    // Simulate successful token exchange
    const accessToken = `simulated_access_token_${Date.now()}`;
    const refreshToken = `simulated_refresh_token_${Date.now()}`;
    const expiresIn = 3600; // 1 hour
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    
    return {
      success: true,
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn,
      expiresAt,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token exchange failed',
    };
  }
}

/**
 * Simulate user profile fetch (placeholder for HTTP transport)
 * In a real implementation, this would make HTTP requests to the provider's userinfo endpoint
 */
async function simulateUserProfileFetch(
  accessToken: string,
  provider: any
): Promise<{
  success: boolean;
  profile?: Record<string, unknown>;
  error?: string;
}> {
  // This is a placeholder simulation
  // In real implementation, this would:
  // 1. Make GET request to provider.userInfoUrl
  // 2. Include Authorization header with access token
  // 3. Parse response and return user profile data
  
  try {
    // Simulate user profile data
    const profile = {
      id: `simulated_user_${Date.now()}`,
      email: 'user@example.com',
      name: 'Simulated User',
      avatar_url: 'https://example.com/avatar.jpg',
      verified_email: true,
    };
    
    return {
      success: true,
      profile,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Profile fetch failed',
    };
  }
}