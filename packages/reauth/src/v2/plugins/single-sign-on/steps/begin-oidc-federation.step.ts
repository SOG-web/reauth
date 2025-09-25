/**
 * Begin OIDC Federation Step
 * Initiates OIDC federation authentication flow
 */

import { type } from 'arktype';
import type { AuthStepV2 } from '../../../types.v2';
import type { 
  SingleSignOnConfigV2, 
  BeginOidcFederationInput, 
  BeginOidcFederationOutput 
} from '../types';
import { OidcUtils } from '../utils/oidc';
import { CrossPlatformCrypto } from '../utils/crypto';

// Input validation schema
export const beginOidcFederationValidation = type({
  providerId: 'string',
  state: 'string?',
  nonce: 'string?',
  scopes: 'string[]?',
});

// Output schema
export const beginOidcFederationOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  authorizationUrl: 'string?',
  state: 'string?',
  nonce: 'string?',
  codeVerifier: 'string?',
  error: 'string?',
});

export const beginOidcFederationStep: AuthStepV2<
  BeginOidcFederationInput,
  BeginOidcFederationOutput,
  SingleSignOnConfigV2
> = {
  name: 'begin-oidc-federation',
  description: 'Initiate OIDC federation authentication flow',
  validationSchema: beginOidcFederationValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { 
        success: 200, 
        provider_not_found: 404, 
        invalid_config: 400,
        server_error: 500 
      },
    },
  },
  inputs: ['providerId', 'state', 'nonce', 'scopes'],
  outputs: beginOidcFederationOutputSchema,

  async run(input: BeginOidcFederationInput, ctx): Promise<BeginOidcFederationOutput> {
    const { orm, config } = ctx;

    try {
      // Validate provider exists and is OIDC
      const provider = config.identityProviders[input.providerId];
      if (!provider) {
        return {
          success: false,
          message: `Identity provider not found: ${input.providerId}`,
          status: 'provider_not_found',
          error: 'PROVIDER_NOT_FOUND',
        };
      }

      if (provider.type !== 'oidc' || !provider.oidc) {
        return {
          success: false,
          message: `Provider ${input.providerId} is not configured for OIDC federation`,
          status: 'invalid_config',
          error: 'INVALID_PROVIDER_TYPE',
        };
      }

      // Generate OIDC authorization URL
      const authRequest = await OidcUtils.generateAuthorizationUrl({
        providerId: input.providerId,
        config,
        state: input.state,
        nonce: input.nonce,
        scopes: input.scopes,
      });

      // Store the request for later validation
      const requestId = await CrossPlatformCrypto.generateId('oidc_req');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      await orm.insert('sso_requests', {
        id: requestId,
        request_id: authRequest.state, // Use state as request ID for OIDC
        provider_id: input.providerId,
        request_type: 'auth',
        relay_state: JSON.stringify({
          state: authRequest.state,
          nonce: authRequest.nonce,
          codeVerifier: authRequest.codeVerifier,
        }),
        destination_url: authRequest.authorizationUrl,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'OIDC federation request generated successfully',
        status: 'success',
        authorizationUrl: authRequest.authorizationUrl,
        state: authRequest.state,
        nonce: authRequest.nonce,
        codeVerifier: authRequest.codeVerifier,
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to initiate OIDC federation',
        status: 'server_error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};