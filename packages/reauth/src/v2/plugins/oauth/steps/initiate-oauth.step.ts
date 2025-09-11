import { type } from 'arktype';
import type { AuthStepV2, OrmLike } from '../../../../types.v2';
import type { OAuthConfigV2 } from '../types';
import { generateOAuthState, generateAuthorizationUrl, getOAuthProvider } from '../utils';

export const initiateOAuthStep: AuthStepV2<
  typeof initiateOAuthInputSchema.infer,
  typeof initiateOAuthOutputSchema.infer,
  OAuthConfigV2,
  OrmLike
> = {
  name: 'initiate-oauth',
  inputs: type({
    provider: 'string',
    'redirectUrl?': 'string',
  }),
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    authorizationUrl: 'string',
    state: 'string',
  }),
  protocol: {
    type: 'oauth-initiate',
    description: 'Initiate OAuth authentication flow',
    method: 'POST',
    path: '/oauth/initiate',
  },
  
  async handler(input, { orm, config, container }) {
    const { provider, redirectUrl } = input;
    
    try {
      // Get provider configuration from database
      const oauthProvider = await getOAuthProvider(orm, provider);
      if (!oauthProvider) {
        return {
          success: false,
          message: `OAuth provider '${provider}' not found or inactive`,
          status: 'provider_not_found',
          authorizationUrl: '',
          state: '',
        };
      }

      // Generate state parameter for CSRF protection
      const state = generateOAuthState(provider, redirectUrl);

      // Get scopes for this provider
      const scopes = oauthProvider.scopes || config?.defaultScopes || [];

      // Generate authorization URL
      const authorizationUrl = generateAuthorizationUrl(
        oauthProvider.authorization_url,
        oauthProvider.client_id,
        oauthProvider.redirect_uri,
        scopes,
        state
      );

      return {
        success: true,
        message: 'OAuth authorization URL generated successfully',
        status: 'authorization_url_generated',
        authorizationUrl,
        state,
      };
    } catch (error) {
      console.error('OAuth initiation error:', error);
      return {
        success: false,
        message: 'Failed to initiate OAuth flow',
        status: 'oauth_initiation_failed',
        authorizationUrl: '',
        state: '',
      };
    }
  },
};

const initiateOAuthInputSchema = initiateOAuthStep.inputs;
const initiateOAuthOutputSchema = initiateOAuthStep.outputs;