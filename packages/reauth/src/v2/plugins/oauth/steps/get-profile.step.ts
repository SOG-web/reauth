import { type } from 'arktype';
import type { AuthStepV2, OrmLike } from '../../../types.v2';
import type { OAuthConfigV2 } from '../types';
import { getOAuthProvider, fetchOAuthUserProfile, storeOAuthProfile } from '../utils';

// Explicit schemas to avoid circular references
const GetProfileInput = type({
  provider: 'string',
  'token?': 'string',
  'sync?': 'boolean',
});

const GetProfileOutput = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  'profile?': 'unknown',
  'synced?': 'boolean',
});

export const getProfileStep: AuthStepV2<
  typeof GetProfileInput.infer,
  typeof GetProfileOutput.infer,
  OAuthConfigV2,
  OrmLike
> = {
  name: 'get-profile',
  validationSchema: GetProfileInput,
  inputs: ['provider', 'token', 'sync'],
  outputs: GetProfileOutput,
  protocol: {
    http: {
      method: 'GET',
      codes: {
        profile_retrieved: 200,
        profile_synced: 200,
        authentication_required: 401,
        invalid_session: 401,
        provider_not_found: 404,
        token_expired: 400,
        token_invalid: 401,
        profile_sync_failed: 502,
        profile_retrieval_failed: 500,
      },
      auth: true,
    },
  },
  
  async run(input, ctx) {
    const orm = await ctx.engine.getOrm();
    const config = ctx.config;
    const container = ctx.container;
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
      const sessionService: any = container.resolve('sessionService');
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
      if (storedToken.expires_at && new Date(String(storedToken.expires_at)) <= now) {
        return {
          success: false,
          message: `${provider} access token expired. Please refresh token first.`,
          status: 'token_expired',
        };
      }

      try {
        // Note: In a real implementation, you would decrypt the access token
        // For this example, we'll assume it's stored in a way that can be retrieved
        const accessToken = String(storedToken.access_token_hash || ''); // This should be decrypted

        // Fetch fresh profile from provider
        const freshProfile = await fetchOAuthUserProfile(
          String(oauthProvider.user_info_url),
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
        const errMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
        console.error('Profile fetch error:', errMsg);
        
        // If fetching fails due to invalid token, suggest refresh
        if (errMsg.includes('401') || errMsg.includes('Unauthorized')) {
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