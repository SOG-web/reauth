import { type } from 'arktype';
import type { AuthStepV2, OrmLike } from '../../../../types.v2';
import type { OAuthConfigV2 } from '../types';
import { 
  validateOAuthState, 
  exchangeCodeForTokens, 
  fetchOAuthUserProfile,
  getOAuthProvider,
  storeOAuthTokens,
  storeOAuthProfile,
  hashOAuthToken,
} from '../utils';

export const callbackOAuthStep: AuthStepV2<
  typeof callbackOAuthInputSchema.infer,
  typeof callbackOAuthOutputSchema.infer,
  OAuthConfigV2,
  OrmLike
> = {
  name: 'callback-oauth',
  inputs: type({
    provider: 'string',
    code: 'string',
    state: 'string',
    'error?': 'string',
    'error_description?': 'string',
  }),
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'token?': 'string',
    'subject?': 'unknown',
    'redirect?': 'string',
  }),
  protocol: {
    type: 'oauth-callback',
    description: 'Handle OAuth provider callback',
    method: 'GET',
    path: '/oauth/callback',
  },
  
  async handler(input, { orm, config, container }) {
    const { provider, code, state, error, error_description } = input;
    
    try {
      // Check for OAuth errors from provider
      if (error) {
        return {
          success: false,
          message: error_description || `OAuth error: ${error}`,
          status: 'oauth_provider_error',
        };
      }

      // Validate state parameter
      const stateData = validateOAuthState(state, provider);
      if (!stateData) {
        return {
          success: false,
          message: 'Invalid or expired OAuth state',
          status: 'invalid_state',
        };
      }

      // Get provider configuration
      const oauthProvider = await getOAuthProvider(orm, provider);
      if (!oauthProvider) {
        return {
          success: false,
          message: `OAuth provider '${provider}' not found or inactive`,
          status: 'provider_not_found',
        };
      }

      // Exchange authorization code for tokens
      const tokenResponse = await exchangeCodeForTokens(
        oauthProvider.token_url,
        oauthProvider.client_id,
        oauthProvider.client_secret, // Note: This should be decrypted in production
        code,
        oauthProvider.redirect_uri
      );

      // Fetch user profile from provider
      const userProfile = await fetchOAuthUserProfile(
        oauthProvider.user_info_url,
        tokenResponse.access_token
      );

      // Check if user already exists by looking up OAuth profile
      let existingProfile = await orm.findFirst('oauth_profiles', {
        where: (b: any) => b('provider_id', '=', oauthProvider.id)
          .and(b('provider_user_id', '=', userProfile.id)),
      });

      let subjectId: string;

      if (existingProfile) {
        // Existing user - update profile and tokens
        subjectId = existingProfile.subject_id;
        await storeOAuthProfile(orm, subjectId, oauthProvider.id, userProfile.id, userProfile);
      } else {
        // New user - create subject first
        const newSubject = await orm.insert('subjects', {
          type: 'user',
          created_at: new Date(),
          updated_at: new Date(),
        });
        subjectId = newSubject.id;
        
        await storeOAuthProfile(orm, subjectId, oauthProvider.id, userProfile.id, userProfile);
      }

      // Store OAuth tokens
      await storeOAuthTokens(orm, subjectId, oauthProvider.id, tokenResponse);

      // Get subject for return
      const subject = await orm.findFirst('subjects', {
        where: (b: any) => b('id', '=', subjectId),
      });

      // Create session token
      const sessionService = container.resolve('sessionService');
      const sessionTtl = config?.sessionTtlSeconds || 24 * 60 * 60; // Default 24 hours
      const token = await sessionService.createSession('subject', subjectId, sessionTtl);

      return {
        success: true,
        message: 'OAuth authentication successful',
        status: 'oauth_success',
        token,
        subject,
        redirect: stateData.redirectUrl,
      };
    } catch (error) {
      console.error('OAuth callback error:', error);
      return {
        success: false,
        message: 'OAuth authentication failed',
        status: 'oauth_callback_failed',
      };
    }
  },
};

const callbackOAuthInputSchema = callbackOAuthStep.inputs;
const callbackOAuthOutputSchema = callbackOAuthStep.outputs;