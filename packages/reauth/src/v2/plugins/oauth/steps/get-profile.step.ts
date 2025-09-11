import { type } from 'arktype';
import type { AuthStepV2, OrmLike } from '../../../../types.v2';
import type { OAuthConfigV2 } from '../types';
import { getOAuthProvider, fetchOAuthUserProfile, storeOAuthProfile } from '../utils';

export const getProfileStep: AuthStepV2<
  typeof getProfileInputSchema.infer,
  typeof getProfileOutputSchema.infer,
  OAuthConfigV2,
  OrmLike
> = {
  name: 'get-profile',
  inputs: type({
    provider: 'string',
    'token?': 'string',
    'sync?': 'boolean', // Whether to sync/update the stored profile
  }),
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'profile?': 'unknown',
    'synced?': 'boolean',
  }),
  protocol: {
    type: 'oauth-profile',
    description: 'Fetch user profile from OAuth provider',
    method: 'GET',
    path: '/oauth/profile',
    requiresAuth: true,
  },
  
  async handler(input, { orm, config, container }) {
    const { provider, token, sync = false } = input;
    
    try {
      // Verify user is authenticated
      if (!token) {
        return {
          success: false,
          message: 'Authentication required for getting profile',
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

      // Get stored OAuth profile for this user and provider
      const storedProfile = await orm.findFirst('oauth_profiles', {
        where: (b: any) => b('subject_id', '=', currentSubjectId)
          .and(b('provider_id', '=', oauthProvider.id)),
      });

      if (!storedProfile) {
        return {
          success: false,
          message: `No ${provider} account linked to your account`,
          status: 'provider_not_linked',
        };
      }

      // If not syncing, return stored profile
      if (!sync) {
        return {
          success: true,
          message: 'Profile retrieved from local storage',
          status: 'profile_retrieved',
          profile: {
            provider: provider,
            id: storedProfile.provider_user_id,
            email: storedProfile.email,
            name: storedProfile.name,
            avatar_url: storedProfile.avatar_url,
            profile_data: storedProfile.profile_data,
            updated_at: storedProfile.updated_at,
          },
          synced: false,
        };
      }

      // For syncing, we need to fetch fresh data from the provider
      // First get the access token
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

      // Check if token is expired
      const now = new Date();
      if (storedToken.expires_at && new Date(storedToken.expires_at) <= now) {
        return {
          success: false,
          message: `${provider} access token expired. Please refresh token first.`,
          status: 'token_expired',
        };
      }

      try {
        // Note: In a real implementation, you would decrypt the access token
        // For this example, we'll assume it's stored in a way that can be retrieved
        const accessToken = storedToken.access_token_hash; // This should be decrypted

        // Fetch fresh profile from provider
        const freshProfile = await fetchOAuthUserProfile(
          oauthProvider.user_info_url,
          accessToken
        );

        // Update stored profile with fresh data
        await storeOAuthProfile(
          orm, 
          currentSubjectId, 
          oauthProvider.id, 
          freshProfile.id, 
          freshProfile
        );

        return {
          success: true,
          message: 'Profile synced successfully from provider',
          status: 'profile_synced',
          profile: {
            provider: provider,
            id: freshProfile.id,
            email: freshProfile.email,
            name: freshProfile.name,
            avatar_url: freshProfile.picture,
            profile_data: freshProfile,
            updated_at: new Date().toISOString(),
          },
          synced: true,
        };
      } catch (fetchError) {
        console.error('Profile fetch error:', fetchError);
        
        // If fetching fails due to invalid token, suggest refresh
        if (fetchError.message.includes('401') || fetchError.message.includes('Unauthorized')) {
          return {
            success: false,
            message: `${provider} access token invalid. Please refresh token.`,
            status: 'token_invalid',
          };
        }

        return {
          success: false,
          message: 'Failed to sync profile from provider',
          status: 'profile_sync_failed',
        };
      }
    } catch (error) {
      console.error('OAuth profile retrieval error:', error);
      return {
        success: false,
        message: 'Failed to get OAuth profile',
        status: 'profile_retrieval_failed',
      };
    }
  },
};

const getProfileInputSchema = getProfileStep.inputs;
const getProfileOutputSchema = getProfileStep.outputs;