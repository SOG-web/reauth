/**
 * Process SAML Response Step
 * Processes and validates SAML assertion responses
 */

import { type } from 'arktype';
import type { AuthStepV2 } from '../../../types.v2';
import type { 
  SingleSignOnConfigV2, 
  ProcessSamlResponseInput, 
  ProcessSamlResponseOutput 
} from '../types';
import { SamlUtils } from '../utils/saml';
import { CrossPlatformCrypto } from '../utils/crypto';

// Input validation schema
export const processSamlResponseValidation = type({
  samlResponse: 'string',
  relayState: 'string?',
  requestId: 'string?',
});

// Output schema
export const processSamlResponseOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  userId: 'string?',
  sessionId: 'string?',
  userAttributes: 'object?',
  nameId: 'string?',
  sessionIndex: 'string?',
  authInstant: 'string?',
  federatedSessionToken: 'string?',
  error: 'string?',
  errors: 'string[]?',
});

export const processSamlResponseStep: AuthStepV2<
  ProcessSamlResponseInput,
  ProcessSamlResponseOutput,
  SingleSignOnConfigV2
> = {
  name: 'process-saml-response',
  description: 'Process and validate SAML assertion responses',
  validationSchema: processSamlResponseValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { 
        success: 200, 
        invalid_response: 400, 
        validation_failed: 422,
        server_error: 500 
      },
    },
  },
  inputs: ['samlResponse', 'relayState', 'requestId'],
  outputs: processSamlResponseOutputSchema,

  async run(input: ProcessSamlResponseInput, ctx): Promise<ProcessSamlResponseOutput> {
    const { orm, config, engine } = ctx;

    try {
      // Find the original request if requestId provided
      let originalRequest = null;
      if (input.requestId) {
        const requests = await orm.findMany('sso_requests', {
          where: (builder: any) => 
            builder('request_id', '=', input.requestId)
              .and('request_type', '=', 'auth')
              .and('status', '=', 'pending'),
          limit: 1,
        });
        originalRequest = requests[0] || null;

        if (!originalRequest) {
          return {
            success: false,
            message: 'Invalid or expired request ID',
            status: 'invalid_response',
            error: 'INVALID_REQUEST_ID',
          };
        }
      }

      // Determine provider ID from request or try to extract from response
      let providerId = originalRequest?.provider_id;
      if (!providerId) {
        // In a real implementation, we might extract the issuer from the SAML response
        // and look up the provider by entity ID
        return {
          success: false,
          message: 'Unable to determine identity provider',
          status: 'invalid_response',
          error: 'PROVIDER_NOT_DETERMINED',
        };
      }

      // Validate SAML response
      const validation = await SamlUtils.validateSamlResponse({
        samlResponse: input.samlResponse,
        providerId,
        config,
        requestId: input.requestId,
      });

      if (!validation.valid) {
        // Update request status to failed
        if (originalRequest) {
          await orm.update('sso_requests', {
            where: (builder: any) => builder('id', '=', originalRequest.id),
            data: {
              status: 'failed',
              completed_at: new Date().toISOString(),
            },
          });
        }

        return {
          success: false,
          message: 'SAML response validation failed',
          status: 'validation_failed',
          error: 'VALIDATION_FAILED',
          errors: validation.errors,
        };
      }

      // Extract user attributes using provider's attribute mapping
      const provider = config.identityProviders[providerId];
      const userAttributes = SamlUtils.extractUserAttributes(
        validation.attributes,
        provider.attributeMapping
      );

      // Ensure we have required attributes
      if (!userAttributes.userId && !validation.nameId) {
        return {
          success: false,
          message: 'Unable to extract user identifier from SAML response',
          status: 'validation_failed',
          error: 'MISSING_USER_ID',
        };
      }

      const userId = userAttributes.userId || validation.nameId!;

      // Create or update SSO session
      const sessionId = await CrossPlatformCrypto.generateId('sso_sess');
      const ssoSessionData = {
        id: sessionId,
        user_id: userId,
        provider_id: providerId,
        session_index: validation.sessionIndex || null,
        name_id: validation.nameId!,
        name_id_format: provider.saml?.nameIdFormat || 'unspecified',
        assertion_id: await CrossPlatformCrypto.generateId('assertion'),
        attributes: JSON.stringify(userAttributes),
        auth_instant: validation.authInstant || new Date().toISOString(),
        expires_at: validation.expiresAt || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours default
        logout_initiated: false,
        created_at: new Date().toISOString(),
      };

      await orm.insert('sso_sessions', ssoSessionData);

      // Store the SAML assertion for audit/debugging
      if (validation.assertion) {
        await orm.insert('sso_saml_assertions', {
          id: await CrossPlatformCrypto.generateId('assertion'),
          assertion_id: ssoSessionData.assertion_id!,
          provider_id: providerId,
          user_id: userId,
          name_id: validation.nameId!,
          session_index: validation.sessionIndex || null,
          assertion_xml: input.samlResponse, // Store the original response
          signature_valid: true, // We validated it above
          issued_at: validation.authInstant || new Date().toISOString(),
          expires_at: validation.expiresAt || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          consumed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
      }

      // Create federated session token if federation is enabled
      let federatedSessionToken: string | undefined;
      if (config.sessionFederation.enabled) {
        federatedSessionToken = await CrossPlatformCrypto.generateId('fed_sess');
        await orm.insert('sso_federated_sessions', {
          id: await CrossPlatformCrypto.generateId('fed'),
          session_token: federatedSessionToken,
          user_id: userId,
          provider_sessions: JSON.stringify({ [providerId]: sessionId }),
          domains: JSON.stringify(config.sessionFederation.domains),
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + config.sessionFederation.sessionTimeout * 60 * 1000).toISOString(),
          last_activity: new Date().toISOString(),
        });
      }

      // Update original request to completed
      if (originalRequest) {
        await orm.update('sso_requests', {
          where: (builder: any) => builder('id', '=', originalRequest.id),
          data: {
            status: 'completed',
            completed_at: new Date().toISOString(),
          },
        });
      }

      // Create a ReAuth session for the user
      let reauthSessionToken: string | undefined;
      try {
        reauthSessionToken = await engine.createSessionFor('subject', userId, config.sessionFederation.sessionTimeout * 60);
      } catch (error) {
        // Session creation failed, but SSO was successful
        console.warn('Failed to create ReAuth session:', error);
      }

      return {
        success: true,
        message: 'SAML response processed successfully',
        status: 'success',
        userId,
        sessionId: reauthSessionToken || sessionId,
        userAttributes,
        nameId: validation.nameId,
        sessionIndex: validation.sessionIndex,
        authInstant: validation.authInstant,
        federatedSessionToken,
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to process SAML response',
        status: 'server_error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};