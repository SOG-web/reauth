import { type } from 'arktype';
import type { AuthStepV2, OrmLike } from '../../../types.v2';
import type { GenericOAuthConfigV2, OAuthUserProfile } from '../types';
import { TokenEncryption, parseUserProfile } from '../utils';

const getUserProfileInputSchema = type({
  connectionId: 'string',
});

const getUserProfileOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  'userProfile?': {
    id: 'string',
    'email?': 'string',
    'name?': 'string',
    'avatar?': 'string',
    raw: 'object',
  },
});

export const getUserProfileStep: AuthStepV2<
  typeof getUserProfileInputSchema.infer,
  typeof getUserProfileOutputSchema.infer,
  GenericOAuthConfigV2,
  OrmLike
> = {
  name: 'get-user-profile',
  validationSchema: getUserProfileInputSchema,
  inputs: ['connectionId'],
  outputs: getUserProfileOutputSchema,
  protocol: {
    http: {
      method: 'GET',
      codes: {
        profile_retrieved: 200,
        connection_not_found: 404,
        provider_not_found: 404,
        no_access_token: 400,
        token_expired: 400,
        profile_error: 500,
        no_profile_data: 404,
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

      // Check if access token exists and is not expired
      if (!connection.access_token_encrypted) {
        return {
          success: false,
          message: 'No access token available for this connection',
          status: 'no_access_token',
        };
      }

      // Check token expiration
      if (connection.expires_at && new Date() > new Date(String(connection.expires_at))) {
        return {
          success: false,
          message: 'Access token has expired',
          status: 'token_expired',
        };
      }

      // Try to get fresh profile from provider first
      let userProfile: OAuthUserProfile | null = null;
      
      if (providerConfig.userInfoUrl) {
        try {
          const accessToken = await TokenEncryption.decrypt(String(connection.access_token_encrypted));
          const profileResult = await simulateUserProfileFetch(accessToken, providerConfig);
          
          if (profileResult.success && profileResult.profile) {
            userProfile = parseUserProfile(profileResult.profile, providerConfig);
            
            // Update stored profile data
            await orm.updateMany('generic_oauth_connections', {
              where: (b: any) => b('id', '=', connectionId),
              set: {
                profile_data: userProfile,
                updated_at: new Date(),
                last_used_at: new Date(),
              },
            });
          }
        } catch (error) {
          console.warn('Failed to fetch fresh profile, using cached data:', error);
        }
      }

      // Fall back to cached profile data
      if (!userProfile && connection.profile_data) {
        userProfile = connection.profile_data as OAuthUserProfile;
      }

      if (!userProfile) {
        return {
          success: false,
          message: 'No user profile data available',
          status: 'no_profile_data',
        };
      }

      return {
        success: true,
        message: 'User profile retrieved successfully',
        status: 'profile_retrieved',
        userProfile,
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to get user profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'profile_error',
      };
    }
  },
};

/**
 * Simulate user profile fetch (placeholder for HTTP transport)
 */
async function simulateUserProfileFetch(
  accessToken: string,
  provider: any
): Promise<{
  success: boolean;
  profile?: Record<string, unknown>;
  error?: string;
}> {
  try {
    // In a real implementation, this would:
    // 1. Make GET request to provider.userInfoUrl
    // 2. Include Authorization header with access token
    // 3. Parse response and return user profile data
    
    // Simulate user profile data based on provider
    const profile = {
      id: `user_${Date.now()}`,
      email: 'user@example.com',
      name: 'Example User',
      avatar_url: 'https://example.com/avatar.jpg',
      verified_email: true,
      // Add provider-specific fields
      ...generateProviderSpecificProfile(provider.name),
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

/**
 * Generate provider-specific profile fields for simulation
 */
function generateProviderSpecificProfile(providerName: string): Record<string, unknown> {
  switch (providerName.toLowerCase()) {
    case 'google':
      return {
        sub: `google_user_${Date.now()}`,
        picture: 'https://lh3.googleusercontent.com/a/example',
        email_verified: true,
        locale: 'en',
      };
    case 'github':
      return {
        login: `github_user_${Date.now()}`,
        avatar_url: 'https://avatars.githubusercontent.com/u/example',
        html_url: 'https://github.com/example',
        type: 'User',
      };
    case 'facebook':
      return {
        picture: {
          data: {
            url: 'https://graph.facebook.com/example/picture',
          },
        },
      };
    case 'twitter':
      return {
        screen_name: `twitter_user_${Date.now()}`,
        profile_image_url_https: 'https://pbs.twimg.com/profile_images/example',
        verified: false,
      };
    default:
      return {};
  }
}