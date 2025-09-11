/**
 * Validate Federated Session Step
 * Validates cross-domain federated sessions
 */

import { type } from 'arktype';
import type { AuthStepV2 } from '../../../types.v2';
import type { 
  SingleSignOnConfigV2, 
  ValidateFederatedSessionInput, 
  ValidateFederatedSessionOutput 
} from '../types';

// Input validation schema
export const validateFederatedSessionValidation = type({
  sessionToken: 'string',
  domain: 'string?',
});

// Output schema
export const validateFederatedSessionOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  valid: 'boolean',
  userId: 'string?',
  providerSessions: 'object?',
  expiresAt: 'string?',
  domains: 'string[]?',
  error: 'string?',
});

export const validateFederatedSessionStep: AuthStepV2<
  ValidateFederatedSessionInput,
  ValidateFederatedSessionOutput,
  SingleSignOnConfigV2
> = {
  name: 'validate-federated-session',
  description: 'Validate cross-domain federated sessions',
  validationSchema: validateFederatedSessionValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { 
        success: 200, 
        invalid_token: 401, 
        forbidden: 403,
        server_error: 500 
      },
    },
  },
  inputs: ['sessionToken', 'domain'],
  outputs: validateFederatedSessionOutputSchema,

  async run(input: ValidateFederatedSessionInput, ctx): Promise<ValidateFederatedSessionOutput> {
    const { orm, config } = ctx;

    try {
      // Check if session federation is enabled
      if (!config.sessionFederation.enabled) {
        return {
          success: false,
          message: 'Session federation is not enabled',
          status: 'forbidden',
          valid: false,
          error: 'FEDERATION_DISABLED',
        };
      }

      // Find the federated session
      const sessions = await orm.findMany('sso_federated_sessions', {
        where: (builder: any) => builder('session_token', '=', input.sessionToken),
        limit: 1,
      });

      if (sessions.length === 0) {
        return {
          success: false,
          message: 'Federated session not found',
          status: 'invalid_token',
          valid: false,
          error: 'SESSION_NOT_FOUND',
        };
      }

      const session = sessions[0];

      // Check if session has expired
      const now = new Date();
      const expiresAt = new Date(session.expires_at);
      
      if (now > expiresAt) {
        // Clean up expired session
        await orm.delete('sso_federated_sessions', {
          where: (builder: any) => builder('id', '=', session.id),
        });

        return {
          success: false,
          message: 'Federated session has expired',
          status: 'invalid_token',
          valid: false,
          error: 'SESSION_EXPIRED',
        };
      }

      // Parse session data
      let providerSessions: Record<string, any> = {};
      let domains: string[] = [];

      try {
        providerSessions = JSON.parse(session.provider_sessions || '{}');
        domains = JSON.parse(session.domains || '[]');
      } catch (error) {
        return {
          success: false,
          message: 'Invalid session data format',
          status: 'invalid_token',
          valid: false,
          error: 'INVALID_SESSION_DATA',
        };
      }

      // Validate domain if provided
      if (input.domain) {
        if (!domains.includes(input.domain)) {
          return {
            success: false,
            message: `Domain ${input.domain} is not authorized for this session`,
            status: 'forbidden',
            valid: false,
            error: 'UNAUTHORIZED_DOMAIN',
          };
        }
      }

      // Validate underlying provider sessions are still active
      const activeProviderSessions: Record<string, any> = {};
      
      for (const [providerId, sessionInfo] of Object.entries(providerSessions)) {
        const ssoSessions = await orm.findMany('sso_sessions', {
          where: (builder: any) => 
            builder('user_id', '=', session.user_id)
              .and('provider_id', '=', providerId)
              .and('logout_initiated', '=', false)
              .and('expires_at', '>', now.toISOString()),
          limit: 1,
        });

        if (ssoSessions.length > 0) {
          activeProviderSessions[providerId] = sessionInfo;
        }
      }

      // If no provider sessions are active, invalidate the federated session
      if (Object.keys(activeProviderSessions).length === 0) {
        await orm.delete('sso_federated_sessions', {
          where: (builder: any) => builder('id', '=', session.id),
        });

        return {
          success: false,
          message: 'No active provider sessions found',
          status: 'invalid_token',
          valid: false,
          error: 'NO_ACTIVE_PROVIDERS',
        };
      }

      // Update last activity time
      await orm.update('sso_federated_sessions', {
        where: (builder: any) => builder('id', '=', session.id),
        data: {
          last_activity: new Date().toISOString(),
          provider_sessions: JSON.stringify(activeProviderSessions),
        },
      });

      return {
        success: true,
        message: 'Federated session is valid',
        status: 'success',
        valid: true,
        userId: session.user_id,
        providerSessions: activeProviderSessions,
        expiresAt: session.expires_at,
        domains: domains,
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to validate federated session',
        status: 'server_error',
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};