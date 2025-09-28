import { type } from 'arktype';
import type { AuthStepV2, OrmLike } from '../../../types.v2';
import type { OAuthConfigV2 } from '../types';
import { 
  validateOAuthState, 
  exchangeCodeForTokens, 
  fetchOAuthUserProfile,
  getOAuthProvider,
  storeOAuthTokens,
  storeOAuthProfile,
} from '../utils';

// Explicit schemas
const linkOAuthInputSchema = type({
  provider: 'string',
  code: 'string',
  state: 'string',
  'token?': 'string',
});

const linkOAuthOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  'linkedProvider?': 'string',
});

export const linkOAuthStep: AuthStepV2<
  typeof linkOAuthInputSchema.infer,
  typeof linkOAuthOutputSchema.infer,
  OAuthConfigV2,
  OrmLike
> = {
  name: 'link-oauth',
  validationSchema: linkOAuthInputSchema,
  inputs: ['provider', 'code', 'state', 'token'],
  outputs: linkOAuthOutputSchema,
  protocol: {
    http: {
      method: 'POST',
      codes: {
        oauth_linked: 200,
        account_linking_disabled: 400,
        authentication_required: 401,
        invalid_session: 401,
        invalid_state: 400,
        provider_not_found: 404,
        account_already_linked: 409,
        provider_already_linked: 409,
        oauth_linking_failed: 500,
      },
      auth: true,
    },
  },
  
  async run(input, ctx) {
    const orm = await ctx.engine.getOrm();
    const config = ctx.config;
    const container = ctx.container;
    const { provider, code, state, token } = input;
    
    try {
      // Check if account linking is enabled
      if (config?.allowAccountLinking === false) {
        return {
          success: false,
          message: 'Account linking is disabled',
          status: 'account_linking_disabled',
        };
      }

      // Verify user is authenticated
      if (!token) {
        return {
          success: false,
          message: 'Authentication required for linking OAuth account',
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
        String(oauthProvider.token_url),
        String(oauthProvider.client_id),
        String(oauthProvider.client_secret), // Note: decrypt in production
        code,
        String(oauthProvider.redirect_uri)
      );

      // Fetch user profile from provider
      const userProfile = await fetchOAuthUserProfile(
        String(oauthProvider.user_info_url),
        tokenResponse.access_token
      );

      // Check if this OAuth account is already linked to another user
      const existingProfile = await orm.findFirst('oauth_profiles', {
        where: (b: any) => b('provider_id', '=', oauthProvider.id)
          .and(b('provider_user_id', '=', userProfile.id)),
      });

      if (existingProfile && existingProfile.subject_id !== currentSubjectId) {
        return {
          success: false,
          message: 'This OAuth account is already linked to another user',
          status: 'account_already_linked',
        };
      }

      // Check if user already has this provider linked
      const currentUserProfile = await orm.findFirst('oauth_profiles', {
        where: (b: any) => b('subject_id', '=', currentSubjectId)
          .and(b('provider_id', '=', oauthProvider.id)),
      });

      if (currentUserProfile) {
        return {
          success: false,
          message: `You already have a ${provider} account linked`,
          status: 'provider_already_linked',
        };
      }

      // Link OAuth account to current user
      await storeOAuthProfile(orm, currentSubjectId, String(oauthProvider.id), userProfile.id, userProfile);
      await storeOAuthTokens(orm, currentSubjectId, String(oauthProvider.id), tokenResponse);

      return {
        success: true,
        message: `${provider} account linked successfully`,
        status: 'oauth_linked',
        linkedProvider: provider,
      };
    } catch (error) {
      console.error('OAuth linking error:', error);
      return {
        success: false,
        message: 'Failed to link OAuth account',
        status: 'oauth_linking_failed',
      };
    }
  },
};