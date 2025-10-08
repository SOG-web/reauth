import type { AuthPlugin, AuthStep } from '../../types';
import type { OAuthPluginConfig } from './types';
import { startOAuthStep } from './steps/start.step';
import { callbackOAuthStep } from './steps/callback.step';
import { linkOAuthStep } from './steps/link.step';
import { unlinkOAuthStep } from './steps/unlink.step';
import { oauthSchema } from './schema';
import { createAuthPlugin } from '../../utils/create-plugin';

/**
 * Base OAuth plugin
 */
export const baseOAuthPlugin = {
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
  steps: [startOAuthStep, callbackOAuthStep, linkOAuthStep, unlinkOAuthStep],
  getSensitiveFields() {
    return ['access_token', 'refresh_token', 'provider_data'];
  },
} satisfies AuthPlugin<OAuthPluginConfig, 'oauth'>;

/**
 * Create OAuth plugin factory
 */
const createOAuthPlugin = (
  config: OAuthPluginConfig,
  overrideStep?: Array<{
    name: string;
    override: Partial<AuthStep<OAuthPluginConfig>>;
  }>,
) => {
  // Initialize clients for providers
  if (config.providers) {
    config.providers.forEach((provider) => {
      provider.client = provider.clientFactory(provider.config);
    });
  }

  const pl = createAuthPlugin<
    OAuthPluginConfig,
    'oauth',
    typeof baseOAuthPlugin
  >(baseOAuthPlugin, {
    config,
    stepOverrides: overrideStep,
    validateConfig: (config) => {
      const errs: string[] = [];
      if (!config.providers || config.providers.length === 0) {
        errs.push('At least one OAuth provider must be configured');
      }
      return errs;
    },
    rootHooks: config.rootHooks,
  }) satisfies typeof baseOAuthPlugin;

  return pl;
};

export default createOAuthPlugin;
