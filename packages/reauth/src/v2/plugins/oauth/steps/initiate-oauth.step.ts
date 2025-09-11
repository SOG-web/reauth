import { type } from 'arktype';
import type { AuthStepV2, OrmLike } from '../../../types.v2';
import type { OAuthConfigV2 } from '../types';
import { generateOAuthState, generateAuthorizationUrl, getOAuthProvider } from '../utils';

const initiateOAuthInputSchema = type({
  provider: 'string',
  'redirectUri?': 'string',
  'state?': 'string',
});

const initiateOAuthOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  authorizationUrl: 'string',
  state: 'string',
});

export const initiateOAuthStep: AuthStepV2<
  typeof initiateOAuthInputSchema.infer,
  typeof initiateOAuthOutputSchema.infer,
  OAuthConfigV2,
  OrmLike
> = {
  name: 'initiate-oauth',
  validationSchema: initiateOAuthInputSchema,
  inputs: ['provider', 'redirectUri', 'state'],
  outputs: initiateOAuthOutputSchema,
  protocol: {
    type: 'oauth-initiate',
    description: 'Initiate OAuth authentication flow',
    method: 'POST',
    path: '/oauth/initiate',
  },
  
  async run(input, ctx) {
    const { provider, redirectUri, state: inputState } = input;
    
    try {
      // Get provider configuration from plugin config
      const providerConfig = ctx.config?.providers?.find(p => p.name === provider);
      if (!providerConfig) {
        return {
          success: false,
          message: `Provider ${provider} not found`,
          status: 'provider_not_found',
          authorizationUrl: '',
          state: '',
        };
      }

      // Generate state parameter for CSRF protection
      const state = inputState || generateOAuthState(provider, redirectUri);

      // Get scopes for this provider
      const scopes = providerConfig.scopes || ctx.config?.defaultScopes || [];

      // Generate authorization URL
      const authorizationUrl = generateAuthorizationUrl(
        providerConfig.authorizationUrl,
        providerConfig.clientId,
        providerConfig.redirectUri,
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