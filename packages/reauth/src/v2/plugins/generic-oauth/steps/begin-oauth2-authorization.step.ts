import { type } from 'arktype';
import type { AuthStepV2, OrmLike } from '../../../types.v2';
import type { GenericOAuthConfigV2 } from '../types';
import { 
  generateOAuthState, 
  generatePKCE, 
  buildOAuth2AuthorizationUrl 
} from '../utils';

const beginOAuth2AuthorizationInputSchema = type({
  providerId: 'string',
  redirectUri: 'string',
  'scopes?': 'string[]',
  'additionalParams?': 'object',
  'userId?': 'string', // For linking to existing user
});

const beginOAuth2AuthorizationOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  authorizationUrl: 'string',
  state: 'string',
  'codeChallenge?': 'string', // PKCE code challenge
  sessionId: 'string',
});

export const beginOAuth2AuthorizationStep: AuthStepV2<
  typeof beginOAuth2AuthorizationInputSchema.infer,
  typeof beginOAuth2AuthorizationOutputSchema.infer,
  GenericOAuthConfigV2,
  OrmLike
> = {
  name: 'begin-oauth2-authorization',
  validationSchema: beginOAuth2AuthorizationInputSchema,
  inputs: ['providerId', 'redirectUri', 'scopes', 'additionalParams', 'userId'],
  outputs: beginOAuth2AuthorizationOutputSchema,
  protocol: {
    type: 'generic-oauth.begin-oauth2-authorization.v1',
    description: 'Begin OAuth 2.0 authorization flow',
    method: 'POST',
    path: '/oauth2/begin',
  },
  
  async run(input, ctx) {
    const { providerId, redirectUri, scopes, userId } = input;
    const additionalParams = input.additionalParams as Record<string, string> | undefined;
    
    try {
      // Get provider configuration
      const providerConfig = ctx.config?.providers?.[providerId];
      if (!providerConfig) {
        return {
          success: false,
          message: `OAuth provider '${providerId}' not found in configuration`,
          status: 'provider_not_found',
          authorizationUrl: '',
          state: '',
          sessionId: '',
        };
      }

      if (providerConfig.version !== '2.0') {
        return {
          success: false,
          message: `Provider '${providerId}' is not configured for OAuth 2.0`,
          status: 'invalid_oauth_version',
          authorizationUrl: '',
          state: '',
          sessionId: '',
        };
      }

      if (!providerConfig.isActive) {
        return {
          success: false,
          message: `OAuth provider '${providerId}' is not active`,
          status: 'provider_inactive',
          authorizationUrl: '',
          state: '',
          sessionId: '',
        };
      }

      // Generate state for CSRF protection
      const state = await generateOAuthState(ctx.config?.security?.stateLength || 32);

      // Generate PKCE if enabled
      let codeVerifier: string | undefined;
      let codeChallenge: string | undefined;
      if (providerConfig.pkce !== false) {
        const pkce = await generatePKCE();
        codeVerifier = pkce.verifier;
        codeChallenge = pkce.challenge;
      }

      // Create authorization session (simplified for protocol-agnostic design)
      const sessionId = `oauth2_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // In a complete implementation, this would store the session in database
      // For protocol-agnostic design, we simulate session storage here

      // Build authorization URL
      let authorizationUrl: string;
      try {
        authorizationUrl = buildOAuth2AuthorizationUrl(providerConfig, {
          redirectUri,
          state,
          scopes,
          codeChallenge,
          additionalParams,
        });
      } catch (error) {
        return {
          success: false,
          message: `Failed to build authorization URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 'url_build_failed',
          authorizationUrl: '',
          state: '',
          sessionId: '',
        };
      }

      return {
        success: true,
        message: 'OAuth 2.0 authorization flow initiated successfully',
        status: 'authorization_initiated',
        authorizationUrl,
        state,
        codeChallenge,
        sessionId,
      };

    } catch (error) {
      return {
        success: false,
        message: `OAuth 2.0 authorization initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'authorization_failed',
        authorizationUrl: '',
        state: '',
        sessionId: '',
      };
    }
  },
};