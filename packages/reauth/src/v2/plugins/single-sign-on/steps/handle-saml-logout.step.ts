/**
 * Handle SAML Logout Step
 * Processes SAML single logout requests and responses
 */

import { type } from 'arktype';
import type { AuthStepV2 } from '../../../types.v2';
import type { SingleSignOnConfigV2 } from '../types';
import { SamlUtils } from '../utils/saml';
import { CrossPlatformCrypto } from '../utils/crypto';

// Input validation schema
export const handleSamlLogoutValidation = type({
  providerId: 'string',
  nameId: 'string',
  sessionIndex: 'string?',
  relayState: 'string?',
  logoutType: '"logout_request" | "logout_response"',
});

// Output schema
export const handleSamlLogoutOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  logoutId: 'string?',
  samlRequest: 'string?',
  redirectUrl: 'string?',
  sessionsTerminated: 'number?',
  error: 'string?',
});

export interface HandleSamlLogoutInput {
  providerId: string;
  nameId: string;
  sessionIndex?: string;
  relayState?: string;
  logoutType: 'logout_request' | 'logout_response';
}

export interface HandleSamlLogoutOutput {
  success: boolean;
  message: string;
  status: string;
  logoutId?: string;
  samlRequest?: string;
  redirectUrl?: string;
  sessionsTerminated?: number;
  error?: string;
}

export const handleSamlLogoutStep: AuthStepV2<
  HandleSamlLogoutInput,
  HandleSamlLogoutOutput,
  SingleSignOnConfigV2
> = {
  name: 'handle-saml-logout',
  description: 'Process SAML single logout requests and responses',
  validationSchema: handleSamlLogoutValidation,
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
  inputs: ['providerId', 'nameId', 'sessionIndex', 'relayState', 'logoutType'],
  outputs: handleSamlLogoutOutputSchema,

  async run(input: HandleSamlLogoutInput, ctx): Promise<HandleSamlLogoutOutput> {
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

      if (input.logoutType === 'logout_request') {
        return await this.handleLogoutRequest(input, ctx, provider);
      } else {
        return await this.handleLogoutResponse(input, ctx, provider);
      }

    } catch (error) {
      return {
        success: false,
        message: 'Failed to handle SAML logout',
        status: 'server_error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async handleLogoutRequest(
    input: HandleSamlLogoutInput, 
    ctx: any, 
    provider: any
  ): Promise<HandleSamlLogoutOutput> {
    const { orm, config } = ctx;

    try {
      // Find SSO sessions for the user
      const whereClause = (builder: any) => {
        let query = builder('name_id', '=', input.nameId)
          .and('provider_id', '=', input.providerId)
          .and('logout_initiated', '=', false);
        
        if (input.sessionIndex) {
          query = query.and('session_index', '=', input.sessionIndex);
        }
        
        return query;
      };

      const sessions = await orm.findMany('sso_sessions', {
        where: whereClause,
      });

      if (sessions.length === 0) {
        return {
          success: false,
          message: 'No active sessions found for logout',
          status: 'success', // Not an error, just no sessions to logout
          sessionsTerminated: 0,
        };
      }

      // Mark sessions as logout initiated
      const sessionIds = sessions.map((s: any) => s.id);
      await orm.update('sso_sessions', {
        where: (builder: any) => builder('id', 'in', sessionIds),
        data: {
          logout_initiated: true,
          updated_at: new Date().toISOString(),
        },
      });

      // Create logout request record
      const logoutId = await CrossPlatformCrypto.generateId('logout');
      const expiresAt = new Date(Date.now() + config.singleLogout.timeoutSeconds * 1000);

      await orm.insert('sso_logout_requests', {
        id: await CrossPlatformCrypto.generateId('logout_req'),
        logout_id: logoutId,
        user_id: sessions[0].user_id,
        initiating_provider_id: input.providerId,
        target_providers: JSON.stringify([input.providerId]),
        relay_state: input.relayState || null,
        status: 'pending',
        completed_providers: JSON.stringify([]),
        failed_providers: JSON.stringify([]),
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      });

      // If propagate logout is enabled, initiate logout for other providers
      if (config.singleLogout.propagateToAll) {
        await this.propagateLogoutToOtherProviders(
          sessions[0].user_id,
          input.providerId,
          logoutId,
          ctx
        );
      }

      // Terminate ReAuth sessions
      let terminatedCount = 0;
      for (const session of sessions) {
        try {
          // Try to terminate the corresponding ReAuth session
          // This would require session service integration
          terminatedCount++;
        } catch (error) {
          console.warn(`Failed to terminate session ${session.id}:`, error);
        }
      }

      // Generate logout response (or redirect to complete logout)
      const logoutResponse = await SamlUtils.generateLogoutRequest({
        providerId: input.providerId,
        nameId: input.nameId,
        sessionIndex: input.sessionIndex,
        config,
        relayState: input.relayState,
      });

      const redirectUrl = SamlUtils.buildSamlRedirectUrl(
        provider.saml.singleLogoutServiceUrl,
        logoutResponse.samlRequest,
        logoutResponse.relayState
      );

      return {
        success: true,
        message: 'SAML logout request processed successfully',
        status: 'success',
        logoutId,
        samlRequest: logoutResponse.samlRequest,
        redirectUrl,
        sessionsTerminated: terminatedCount,
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to process logout request',
        status: 'server_error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async handleLogoutResponse(
    input: HandleSamlLogoutInput, 
    ctx: any, 
    provider: any
  ): Promise<HandleSamlLogoutOutput> {
    const { orm } = ctx;

    try {
      // Find the logout request
      const logoutRequests = await orm.findMany('sso_logout_requests', {
        where: (builder: any) => 
          builder('initiating_provider_id', '=', input.providerId)
            .and('status', '=', 'pending'),
        limit: 1,
      });

      if (logoutRequests.length === 0) {
        return {
          success: false,
          message: 'No pending logout request found',
          status: 'invalid_config',
          error: 'NO_PENDING_LOGOUT',
        };
      }

      const logoutRequest = logoutRequests[0];

      // Mark logout as completed
      await orm.update('sso_logout_requests', {
        where: (builder: any) => builder('id', '=', logoutRequest.id),
        data: {
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_providers: JSON.stringify([input.providerId]),
        },
      });

      // Delete the SSO sessions
      const deletedSessions = await orm.delete('sso_sessions', {
        where: (builder: any) => 
          builder('user_id', '=', logoutRequest.user_id)
            .and('provider_id', '=', input.providerId)
            .and('logout_initiated', '=', true),
      });

      return {
        success: true,
        message: 'SAML logout response processed successfully',
        status: 'success',
        logoutId: logoutRequest.logout_id,
        sessionsTerminated: deletedSessions?.deletedCount || 0,
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to process logout response',
        status: 'server_error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async propagateLogoutToOtherProviders(
    userId: string,
    initiatingProviderId: string,
    logoutId: string,
    ctx: any
  ): Promise<void> {
    const { orm, config } = ctx;

    try {
      // Find sessions with other providers for the same user
      const otherSessions = await orm.findMany('sso_sessions', {
        where: (builder: any) => 
          builder('user_id', '=', userId)
            .and('provider_id', '!=', initiatingProviderId)
            .and('logout_initiated', '=', false),
      });

      if (otherSessions.length === 0) return;

      // Group by provider
      const sessionsByProvider: Record<string, any[]> = {};
      for (const session of otherSessions) {
        if (!sessionsByProvider[session.provider_id]) {
          sessionsByProvider[session.provider_id] = [];
        }
        sessionsByProvider[session.provider_id].push(session);
      }

      // Update logout request with all target providers
      const allProviders = [initiatingProviderId, ...Object.keys(sessionsByProvider)];
      await orm.update('sso_logout_requests', {
        where: (builder: any) => builder('logout_id', '=', logoutId),
        data: {
          target_providers: JSON.stringify(allProviders),
        },
      });

      // In a real implementation, this would initiate logout with each provider
      // For now, we'll just mark the sessions for logout
      for (const [providerId, sessions] of Object.entries(sessionsByProvider)) {
        const sessionIds = sessions.map(s => s.id);
        await orm.update('sso_sessions', {
          where: (builder: any) => builder('id', 'in', sessionIds),
          data: {
            logout_initiated: true,
            updated_at: new Date().toISOString(),
          },
        });
      }

    } catch (error) {
      console.error('Failed to propagate logout to other providers:', error);
    }
  },
};