import type { AuthPlugin } from '../../types';
import type { OAuthPluginConfig } from './types';
import { startOAuthStep } from './steps/start.step';
import { callbackOAuthStep } from './steps/callback.step';
import { linkOAuthStep } from './steps/link.step';
import { unlinkOAuthStep } from './steps/unlink.step';
import { oauthSchema } from './schema';

/**
 * Base OAuth plugin
 */
export const baseOAuthPlugin: AuthPlugin<OAuthPluginConfig> = {
  name: 'oauth',
  initialize(engine) {
    // Register session resolver for OAuth subjects
    engine.registerSessionResolver('oauth-subject', {
      async getById(id: string, orm) {
        // OAuth subjects are resolved through the identities table
        const identity = await orm.findFirst('identities', {
          where: (b) => b('id', '=', id),
        });
        return identity ? { id: String(identity.subject_id) } : null;
      },
      sanitize(subject: any) {
        return subject; // OAuth subjects don't have sensitive fields
      },
    });
  },
  config: {
    sessionTtlSeconds: 3600, // 1 hour
  },
  steps: [
    startOAuthStep,
    callbackOAuthStep,
    linkOAuthStep,
    unlinkOAuthStep,
  ],
  getSensitiveFields() {
    return ['access_token', 'refresh_token', 'provider_data'];
  },
};

/**
 * Create OAuth plugin factory
 */
const createOAuthPlugin = (
  config: OAuthPluginConfig,
): AuthPlugin<OAuthPluginConfig> => {
  // Initialize clients for providers
  if (config.providers) {
    config.providers.forEach(provider => {
      provider.client = provider.clientFactory(provider.config);
    });
  }

  return {
    ...baseOAuthPlugin,
    config,
  };
};

export default createOAuthPlugin;
