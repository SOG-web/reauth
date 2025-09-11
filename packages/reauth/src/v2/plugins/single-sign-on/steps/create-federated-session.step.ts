/**
 * Create Federated Session Step
 * Creates cross-domain federated sessions for SSO
 */

import { type } from 'arktype';
import type { AuthStepV2 } from '../../../types.v2';
import type { 
  SingleSignOnConfigV2, 
  CreateFederatedSessionInput, 
  CreateFederatedSessionOutput 
} from '../types';
import { CrossPlatformCrypto } from '../utils/crypto';

// Input validation schema
export const createFederatedSessionValidation = type({
  userId: 'string',
  providerSessions: 'object',
  domains: 'string[]',
});

// Output schema
export const createFederatedSessionOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  sessionToken: 'string?',
  expiresAt: 'string?',
  domains: 'string[]?',
  error: 'string?',
});

export const createFederatedSessionStep: AuthStepV2<
  CreateFederatedSessionInput,
  CreateFederatedSessionOutput,
  SingleSignOnConfigV2
> = {
  name: 'create-federated-session',
  description: 'Create cross-domain federated sessions for SSO',
  validationSchema: createFederatedSessionValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { 
        success: 200, 
        invalid_input: 400, 
        federation_disabled: 403,
        server_error: 500 
      },
    },
  },
  inputs: ['userId', 'providerSessions', 'domains'],
  outputs: createFederatedSessionOutputSchema,

  async run(input: CreateFederatedSessionInput, ctx): Promise<CreateFederatedSessionOutput> {
    const { orm, config } = ctx;

    try {
      // Check if session federation is enabled
      if (!config.sessionFederation.enabled) {
        return {
          success: false,
          message: 'Session federation is not enabled',
          status: 'federation_disabled',
          error: 'FEDERATION_DISABLED',
        };
      }

      // Validate domains are in the allowed list
      const allowedDomains = config.sessionFederation.domains;
      const invalidDomains = input.domains.filter(domain => !allowedDomains.includes(domain));
      
      if (invalidDomains.length > 0) {
        return {
          success: false,
          message: `Invalid domains: ${invalidDomains.join(', ')}`,
          status: 'invalid_input',
          error: 'INVALID_DOMAINS',
        };
      }

      // Validate provider sessions exist
      const providerIds = Object.keys(input.providerSessions);
      if (providerIds.length === 0) {
        return {
          success: false,
          message: 'At least one provider session is required',
          status: 'invalid_input',
          error: 'NO_PROVIDER_SESSIONS',
        };
      }

      // Validate all providers exist in config
      for (const providerId of providerIds) {
        if (!config.identityProviders[providerId]) {
          return {
            success: false,
            message: `Identity provider not found: ${providerId}`,
            status: 'invalid_input',
            error: 'UNKNOWN_PROVIDER',
          };
        }
      }

      // Check if user has active sessions with the specified providers
      for (const [providerId, sessionInfo] of Object.entries(input.providerSessions)) {
        const sessions = await orm.findMany('sso_sessions', {
          where: (builder: any) => 
            builder('user_id', '=', input.userId)
              .and('provider_id', '=', providerId)
              .and('logout_initiated', '=', false)
              .and('expires_at', '>', new Date().toISOString()),
          limit: 1,
        });

        if (sessions.length === 0) {
          return {
            success: false,
            message: `No active session found for provider ${providerId}`,
            status: 'invalid_input',
            error: 'NO_ACTIVE_SESSION',
          };
        }
      }

      // Generate federated session token
      const sessionToken = await CrossPlatformCrypto.generateId('fed_sess');
      const expiresAt = new Date(Date.now() + config.sessionFederation.sessionTimeout * 60 * 1000);

      // Check if there's already a federated session for this user
      const existingSessions = await orm.findMany('sso_federated_sessions', {
        where: (builder: any) => builder('user_id', '=', input.userId),
      });

      if (existingSessions.length > 0) {
        // Update existing session with new providers and domains
        const existingSession = existingSessions[0];
        const existingProviderSessions = JSON.parse(existingSession.provider_sessions || '{}');
        const existingDomains = JSON.parse(existingSession.domains || '[]');

        // Merge provider sessions
        const mergedProviderSessions = {
          ...existingProviderSessions,
          ...input.providerSessions,
        };

        // Merge domains (remove duplicates)
        const mergedDomains = Array.from(new Set([...existingDomains, ...input.domains]));

        await orm.update('sso_federated_sessions', {
          where: (builder: any) => builder('id', '=', existingSession.id),
          data: {
            provider_sessions: JSON.stringify(mergedProviderSessions),
            domains: JSON.stringify(mergedDomains),
            expires_at: expiresAt.toISOString(),
            last_activity: new Date().toISOString(),
          },
        });

        return {
          success: true,
          message: 'Federated session updated successfully',
          status: 'success',
          sessionToken: existingSession.session_token,
          expiresAt: expiresAt.toISOString(),
          domains: mergedDomains,
        };
      } else {
        // Create new federated session
        const sessionId = await CrossPlatformCrypto.generateId('fed');
        
        await orm.insert('sso_federated_sessions', {
          id: sessionId,
          session_token: sessionToken,
          user_id: input.userId,
          provider_sessions: JSON.stringify(input.providerSessions),
          domains: JSON.stringify(input.domains),
          created_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          last_activity: new Date().toISOString(),
        });

        return {
          success: true,
          message: 'Federated session created successfully',
          status: 'success',
          sessionToken,
          expiresAt: expiresAt.toISOString(),
          domains: input.domains,
        };
      }

    } catch (error) {
      return {
        success: false,
        message: 'Failed to create federated session',
        status: 'server_error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};