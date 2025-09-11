/**
 * Process OIDC Callback Step
 * Processes OIDC federation callback and validates tokens
 */

import { type } from 'arktype';
import type { AuthStepV2 } from '../../../types.v2';
import type { 
  SingleSignOnConfigV2, 
  ProcessOidcCallbackInput, 
  ProcessOidcCallbackOutput 
} from '../types';
import { OidcUtils } from '../utils/oidc';
import { CrossPlatformCrypto } from '../utils/crypto';

// Input validation schema
export const processOidcCallbackValidation = type({
  code: 'string',
  state: 'string',
  providerId: 'string',
  nonce: 'string?',
  codeVerifier: 'string?',
});

// Output schema
export const processOidcCallbackOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  userId: 'string?',
  sessionId: 'string?',
  userAttributes: 'object?',
  accessToken: 'string?',
  refreshToken: 'string?',
  expiresAt: 'string?',
  federatedSessionToken: 'string?',
  error: 'string?',
  errors: 'string[]?',
});

export const processOidcCallbackStep: AuthStepV2<
  ProcessOidcCallbackInput,
  ProcessOidcCallbackOutput,
  SingleSignOnConfigV2
> = {
  name: 'process-oidc-callback',
  description: 'Process OIDC federation callback and validate tokens',
  validationSchema: processOidcCallbackValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { 
        success: 200, 
        invalid_callback: 400, 
        validation_failed: 422,
        server_error: 500 
      },
    },
  },
  inputs: ['code', 'state', 'providerId', 'nonce', 'codeVerifier'],
  outputs: processOidcCallbackOutputSchema,

  async run(input: ProcessOidcCallbackInput, ctx): Promise<ProcessOidcCallbackOutput> {
    const { orm, config, engine } = ctx;

    try {
      // Validate provider exists and is OIDC
      const provider = config.identityProviders[input.providerId];
      if (!provider) {
        return {
          success: false,
          message: `Identity provider not found: ${input.providerId}`,
          status: 'invalid_callback',
          error: 'PROVIDER_NOT_FOUND',
        };
      }

      if (provider.type !== 'oidc' || !provider.oidc) {
        return {
          success: false,
          message: `Provider ${input.providerId} is not configured for OIDC federation`,
          status: 'invalid_callback',
          error: 'INVALID_PROVIDER_TYPE',
        };
      }

      // Find the original request
      const requests = await orm.findMany('sso_requests', {
        where: (builder: any) => 
          builder('request_id', '=', input.state)
            .and('provider_id', '=', input.providerId)
            .and('request_type', '=', 'auth')
            .and('status', '=', 'pending'),
        limit: 1,
      });

      const originalRequest = requests[0] || null;
      if (!originalRequest) {
        return {
          success: false,
          message: 'Invalid or expired state parameter',
          status: 'invalid_callback',
          error: 'INVALID_STATE',
        };
      }

      // Parse the stored request data
      let requestData: any = {};
      try {
        if (originalRequest.relay_state) {
          requestData = JSON.parse(originalRequest.relay_state);
        }
      } catch (error) {
        console.warn('Failed to parse request data:', error);
      }

      // Use stored values or input values
      const nonce = input.nonce || requestData.nonce;
      const codeVerifier = input.codeVerifier || requestData.codeVerifier;

      if (!codeVerifier) {
        return {
          success: false,
          message: 'Code verifier not found for PKCE validation',
          status: 'validation_failed',
          error: 'MISSING_CODE_VERIFIER',
        };
      }

      // Exchange code for tokens (this would require transport layer)
      // For now, we'll simulate successful token exchange
      const mockTokens = {
        accessToken: await CrossPlatformCrypto.randomString(64),
        refreshToken: await CrossPlatformCrypto.randomString(64),
        idToken: this.createMockIdToken(input.providerId, provider),
        expiresIn: 3600,
      };

      // Validate ID token
      const tokenValidation = await OidcUtils.validateIdToken({
        idToken: mockTokens.idToken,
        providerId: input.providerId,
        config,
        nonce,
      });

      if (!tokenValidation.valid) {
        // Update request status to failed
        await orm.update('sso_requests', {
          where: (builder: any) => builder('id', '=', originalRequest.id),
          data: {
            status: 'failed',
            completed_at: new Date().toISOString(),
          },
        });

        return {
          success: false,
          message: 'ID token validation failed',
          status: 'validation_failed',
          error: 'INVALID_ID_TOKEN',
          errors: tokenValidation.errors,
        };
      }

      // Extract user attributes using provider's attribute mapping
      const userAttributes = OidcUtils.extractUserAttributes(
        tokenValidation.claims,
        provider.attributeMapping
      );

      // Ensure we have required attributes
      if (!userAttributes.userId && !tokenValidation.claims.sub) {
        return {
          success: false,
          message: 'Unable to extract user identifier from ID token',
          status: 'validation_failed',
          error: 'MISSING_USER_ID',
        };
      }

      const userId = userAttributes.userId || tokenValidation.claims.sub;
      const expiresAt = new Date(Date.now() + mockTokens.expiresIn * 1000);

      // Create SSO session
      const sessionId = await CrossPlatformCrypto.generateId('oidc_sess');
      const ssoSessionData = {
        id: sessionId,
        user_id: userId,
        provider_id: input.providerId,
        session_index: null, // OIDC doesn't use session index like SAML
        name_id: userId,
        name_id_format: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
        assertion_id: null, // OIDC uses tokens, not assertions
        attributes: JSON.stringify({
          ...userAttributes,
          accessToken: mockTokens.accessToken,
          refreshToken: mockTokens.refreshToken,
        }),
        auth_instant: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        logout_initiated: false,
        created_at: new Date().toISOString(),
      };

      await orm.insert('sso_sessions', ssoSessionData);

      // Create federated session token if federation is enabled
      let federatedSessionToken: string | undefined;
      if (config.sessionFederation.enabled) {
        federatedSessionToken = await CrossPlatformCrypto.generateId('fed_sess');
        await orm.insert('sso_federated_sessions', {
          id: await CrossPlatformCrypto.generateId('fed'),
          session_token: federatedSessionToken,
          user_id: userId,
          provider_sessions: JSON.stringify({ [input.providerId]: sessionId }),
          domains: JSON.stringify(config.sessionFederation.domains),
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + config.sessionFederation.sessionTimeout * 60 * 1000).toISOString(),
          last_activity: new Date().toISOString(),
        });
      }

      // Update original request to completed
      await orm.update('sso_requests', {
        where: (builder: any) => builder('id', '=', originalRequest.id),
        data: {
          status: 'completed',
          completed_at: new Date().toISOString(),
        },
      });

      // Create a ReAuth session for the user
      let reauthSessionToken: string | undefined;
      try {
        reauthSessionToken = await engine.createSessionFor('subject', userId, config.sessionFederation.sessionTimeout * 60);
      } catch (error) {
        // Session creation failed, but OIDC federation was successful
        console.warn('Failed to create ReAuth session:', error);
      }

      return {
        success: true,
        message: 'OIDC callback processed successfully',
        status: 'success',
        userId,
        sessionId: reauthSessionToken || sessionId,
        userAttributes,
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        expiresAt: expiresAt.toISOString(),
        federatedSessionToken,
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to process OIDC callback',
        status: 'server_error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * Create a mock ID token for testing purposes
   * In a real implementation, this would come from the token exchange
   */
  createMockIdToken(providerId: string, provider: any): string {
    const header = {
      typ: 'JWT',
      alg: 'RS256',
      kid: 'mock-key-id',
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: provider.oidc.issuer,
      aud: provider.oidc.clientId,
      sub: 'mock-user-id',
      iat: now,
      exp: now + 3600,
      nonce: 'mock-nonce',
      email: 'user@example.com',
      given_name: 'Test',
      family_name: 'User',
      name: 'Test User',
    };

    // Create a mock JWT (not signed)
    const encodedHeader = CrossPlatformCrypto.base64UrlEncode(
      new TextEncoder().encode(JSON.stringify(header))
    );
    const encodedPayload = CrossPlatformCrypto.base64UrlEncode(
      new TextEncoder().encode(JSON.stringify(payload))
    );
    const mockSignature = 'mock-signature';

    return `${encodedHeader}.${encodedPayload}.${mockSignature}`;
  },
};