/**
 * Begin SAML SSO Step
 * Initiates SAML SSO authentication flow
 */

import { type } from 'arktype';
import type { AuthStepV2 } from '../../../types.v2';
import type { 
  SingleSignOnConfigV2, 
  BeginSamlSsoInput, 
  BeginSamlSsoOutput 
} from '../types';
import { SamlUtils } from '../utils/saml';
import { CrossPlatformCrypto } from '../utils/crypto';

// Input validation schema
export const beginSamlSsoValidation = type({
  providerId: 'string',
  relayState: 'string?',
  forceAuthn: 'boolean?',
  isPassive: 'boolean?',
  nameIdPolicy: 'string?',
});

// Output schema
export const beginSamlSsoOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  requestId: 'string?',
  samlRequest: 'string?',
  redirectUrl: 'string?',
  relayState: 'string?',
  error: 'string?',
});

export const beginSamlSsoStep: AuthStepV2<
  BeginSamlSsoInput,
  BeginSamlSsoOutput,
  SingleSignOnConfigV2
> = {
  name: 'begin-saml-sso',
  description: 'Initiate SAML SSO authentication flow',
  validationSchema: beginSamlSsoValidation,
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
  inputs: ['providerId', 'relayState', 'forceAuthn', 'isPassive', 'nameIdPolicy'],
  outputs: beginSamlSsoOutputSchema,

  async run(input: BeginSamlSsoInput, ctx): Promise<BeginSamlSsoOutput> {
    const { orm, config, engine } = ctx;

    try {
      // Validate provider exists and is SAML
      const provider = config.identityProviders[input.providerId];
      if (!provider) {
        return {
          success: false,
          message: `Identity provider not found: ${input.providerId}`,
          status: 'provider_not_found',
          error: 'PROVIDER_NOT_FOUND',
        };
      }

      if (provider.type !== 'saml' || !provider.saml) {
        return {
          success: false,
          message: `Provider ${input.providerId} is not configured for SAML SSO`,
          status: 'invalid_config',
          error: 'INVALID_PROVIDER_TYPE',
        };
      }

      // Generate SAML AuthnRequest
      const authnRequest = await SamlUtils.generateAuthnRequest({
        providerId: input.providerId,
        config,
        relayState: input.relayState,
        forceAuthn: input.forceAuthn,
        isPassive: input.isPassive,
      });

      // Store the request for later validation
      const requestId = authnRequest.requestId;
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      await orm.insert('sso_requests', {
        id: await CrossPlatformCrypto.generateId('req'),
        request_id: requestId,
        provider_id: input.providerId,
        request_type: 'auth',
        relay_state: input.relayState || null,
        destination_url: provider.saml.singleSignOnServiceUrl,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      });

      // Build redirect URL
      const redirectUrl = SamlUtils.buildSamlRedirectUrl(
        provider.saml.singleSignOnServiceUrl,
        authnRequest.samlRequest,
        authnRequest.relayState
      );

      return {
        success: true,
        message: 'SAML SSO request generated successfully',
        status: 'success',
        requestId: authnRequest.requestId,
        samlRequest: authnRequest.samlRequest,
        redirectUrl,
        relayState: authnRequest.relayState,
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to initiate SAML SSO',
        status: 'server_error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};