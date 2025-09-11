/**
 * Single Sign-On (SSO) Plugin V2
 * Comprehensive SSO plugin for ReAuth V2 with SAML 2.0 and OIDC federation support
 */

import type { AuthPluginV2, OrmLike } from '../../types.v2';
import type { SingleSignOnConfigV2 } from './types';
import { createAuthPluginV2 } from '../../utils/create-plugin.v2';
import { cleanupAllSsoEntities } from './utils/cleanup';

// Import all steps
import { beginSamlSsoStep } from './steps/begin-saml-sso.step';
import { processSamlResponseStep } from './steps/process-saml-response.step';
import { handleSamlLogoutStep } from './steps/handle-saml-logout.step';
import { beginOidcFederationStep } from './steps/begin-oidc-federation.step';
import { processOidcCallbackStep } from './steps/process-oidc-callback.step';
import { createFederatedSessionStep } from './steps/create-federated-session.step';
import { validateFederatedSessionStep } from './steps/validate-federated-session.step';
import { registerIdentityProviderStep } from './steps/register-identity-provider.step';

// Export types
export type { SingleSignOnConfigV2 } from './types';

// Default configuration
const defaultConfig: SingleSignOnConfigV2 = {
  serviceProvider: {
    entityId: 'urn:reauth:sp:default',
    assertionConsumerServiceUrl: 'https://localhost:3000/sso/acs',
    singleLogoutServiceUrl: 'https://localhost:3000/sso/sls',
    certificate: 'default-certificate-placeholder',
    privateKey: 'default-private-key-placeholder',
    nameIdFormat: 'emailAddress',
    signRequests: false,
    wantAssertionsSigned: true,
  },
  identityProviders: {},
  sessionFederation: {
    enabled: false,
    domains: [],
    cookieName: 'reauth_fed_session',
    cookieDomain: '',
    cookieSecure: true,
    cookieSameSite: 'lax',
    sessionTimeout: 480, // 8 hours in minutes
  },
  singleLogout: {
    enabled: true,
    propagateToAll: false,
    timeoutSeconds: 30,
    retryAttempts: 3,
  },
  security: {
    encryptAssertions: false,
    requireSignedRequests: false,
    allowUnsolicited: false,
    maxClockSkew: 300, // 5 minutes in seconds
    assertionLifetime: 480, // 8 hours in minutes
  },
  cleanup: {
    enabled: true,
    intervalMinutes: 60,
    expiredAssertionRetentionHours: 24,
    expiredSessionRetentionDays: 7,
    logoutRequestRetentionHours: 48,
  },
};

// Base SSO plugin
export const baseSingleSignOnPluginV2: AuthPluginV2<SingleSignOnConfigV2> = {
  name: 'single-sign-on',
  
  initialize(engine) {
    // Register session resolver for SSO users
    engine.registerSessionResolver('sso_subject', {
      async getById(id: string, orm: OrmLike) {
        // First try to find the user in SSO sessions
        const ssoSessions = await orm.findMany('sso_sessions', {
          where: (builder: any) => 
            builder('user_id', '=', id)
              .and('logout_initiated', '=', false)
              .and('expires_at', '>', new Date().toISOString()),
          limit: 1,
        });

        if (ssoSessions.length > 0) {
          const session = ssoSessions[0];
          let attributes = {};
          try {
            attributes = JSON.parse(session.attributes || '{}');
          } catch (error) {
            console.warn('Failed to parse session attributes:', error);
          }
          
          return {
            id: session.user_id,
            provider: session.provider_id,
            nameId: session.name_id,
            attributes,
            verified: true,
            authInstant: session.auth_instant,
            expiresAt: session.expires_at,
          };
        }

        // Fallback to regular subjects table
        const subject = await orm.findFirst('subjects', {
          where: (builder: any) => builder('id', '=', id),
        });
        return (subject ?? null) as any;
      },
      
      sanitize(subject: any) {
        // Remove sensitive attributes
        if (subject && subject.attributes) {
          const sanitized = { ...subject };
          if (sanitized.attributes && typeof sanitized.attributes === 'object') {
            if (sanitized.attributes.accessToken) {
              delete sanitized.attributes.accessToken;
            }
            if (sanitized.attributes.refreshToken) {
              delete sanitized.attributes.refreshToken;
            }
          }
          return sanitized;
        }
        return subject;
      },
    });

    // Register background cleanup task for SSO entities
    const config = this.config as Partial<SingleSignOnConfigV2> || {};
    if (config.cleanup?.enabled !== false) {
      const cleanupIntervalMs = (config.cleanup?.intervalMinutes || 60) * 60 * 1000;

      engine.registerCleanupTask({
        name: 'sso-entities',
        pluginName: 'single-sign-on',
        intervalMs: cleanupIntervalMs,
        enabled: true,
        runner: async (orm, pluginConfig) => {
          try {
            const result = await cleanupAllSsoEntities(orm, pluginConfig);
            return {
              cleaned: result.totalCleaned,
              assertionsDeleted: result.assertionsDeleted,
              sessionsDeleted: result.sessionsDeleted,
              federatedSessionsDeleted: result.federatedSessionsDeleted,
              requestsDeleted: result.requestsDeleted,
              logoutRequestsDeleted: result.logoutRequestsDeleted,
              errors: result.errors,
            };
          } catch (error) {
            return {
              cleaned: 0,
              errors: [
                `SSO cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
              ],
            };
          }
        },
      });
    }
  },

  config: defaultConfig,

  steps: [
    // SAML 2.0 Steps
    beginSamlSsoStep,
    processSamlResponseStep,
    handleSamlLogoutStep,
    
    // OIDC Federation Steps
    beginOidcFederationStep,
    processOidcCallbackStep,
    
    // Session Federation Steps
    createFederatedSessionStep,
    validateFederatedSessionStep,
    
    // Provider Management Steps
    registerIdentityProviderStep,
    
    // Additional steps would go here:
    // - validateSamlAssertionStep
    // - generateSamlRequestStep
    // - validateOidcTokenStep
    // - refreshFederatedTokenStep
    // - propagateLogoutStep
    // - syncSessionStateStep
    // - updateIdentityProviderStep
    // - testIdentityProviderStep
    // - listIdentityProvidersStep
    // - mapUserAttributesStep
    // - transformClaimsStep
    // - validateAttributeMappingStep
    // - getUserFromAssertionStep
  ],

  // Plugin-level hooks for common SSO operations
  rootHooks: {
    before: async (input, ctx, step) => {
      // Log SSO operations for audit purposes
      const timestamp = new Date().toISOString();
      const stepName = step.name;
      
      console.log(`[SSO Plugin] ${timestamp} - Executing step: ${stepName}`);
      
      // Add common validation or preprocessing here
      return input;
    },

    after: async (output, ctx, step) => {
      // Log successful operations
      const timestamp = new Date().toISOString();
      const stepName = step.name;
      
      if (output && typeof output === 'object' && 'success' in output) {
        const status = output.success ? 'SUCCESS' : 'FAILED';
        console.log(`[SSO Plugin] ${timestamp} - Step ${stepName} completed: ${status}`);
      }

      return output;
    },

    onError: async (error, input, ctx, step) => {
      // Log errors for monitoring
      const timestamp = new Date().toISOString();
      const stepName = step.name;
      
      console.error(`[SSO Plugin] ${timestamp} - Step ${stepName} failed:`, error);
      
      // Could implement error reporting, metrics collection, etc.
      // For now, just log the error
      return;
    },
  },
};

// Create the configured plugin with validation
const singleSignOnPluginV2: AuthPluginV2<SingleSignOnConfigV2> = createAuthPluginV2<SingleSignOnConfigV2>(
  baseSingleSignOnPluginV2,
  {
    validateConfig: (config) => {
      const errors: string[] = [];

      // Validate service provider configuration (only check if defined)
      if (config.serviceProvider) {
        if (!config.serviceProvider.entityId || config.serviceProvider.entityId.trim() === '') {
          errors.push('serviceProvider.entityId cannot be empty when serviceProvider is configured');
        }
        if (!config.serviceProvider.assertionConsumerServiceUrl || config.serviceProvider.assertionConsumerServiceUrl.trim() === '') {
          errors.push('serviceProvider.assertionConsumerServiceUrl cannot be empty when serviceProvider is configured');
        }
      }

      // Validate session federation configuration
      if (config.sessionFederation?.enabled) {
        if (!config.sessionFederation.domains || config.sessionFederation.domains.length === 0) {
          errors.push('sessionFederation.domains must be specified when federation is enabled');
        }
        if (!config.sessionFederation.cookieDomain || config.sessionFederation.cookieDomain.trim() === '') {
          errors.push('sessionFederation.cookieDomain is required when federation is enabled');
        }
      }

      // Validate cleanup configuration
      if (config.cleanup?.intervalMinutes && config.cleanup.intervalMinutes < 1) {
        errors.push('cleanup.intervalMinutes must be at least 1 minute');
      }

      if (config.cleanup?.intervalMinutes && config.cleanup.intervalMinutes > 1440) {
        errors.push('cleanup.intervalMinutes cannot exceed 1440 minutes (24 hours)');
      }

      // Validate security settings
      if (config.security?.maxClockSkew && config.security.maxClockSkew < 0) {
        errors.push('security.maxClockSkew must be non-negative');
      }

      if (config.security?.assertionLifetime && config.security.assertionLifetime < 1) {
        errors.push('security.assertionLifetime must be at least 1 minute');
      }

      return errors.length ? errors : null;
    },
  }
);

export default singleSignOnPluginV2;