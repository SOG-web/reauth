import type { AuthPluginV2, OrmLike } from '../../types.v2';
import type { ApiKeyConfigV2 } from './types';
export type { ApiKeyConfigV2 } from './types';
import { authenticateApiKeyStep } from './steps/authenticate-api-key.step';
import { createApiKeyStep } from './steps/create-api-key.step';
import { listApiKeysStep } from './steps/list-api-keys.step';
import { revokeApiKeyStep } from './steps/revoke-api-key.step';
import { updateApiKeyStep } from './steps/update-api-key.step';
import { createAuthPluginV2 } from '../../utils/create-plugin.v2';
import { cleanupExpiredApiKeys, cleanupOldUsageLogs } from './utils';

export const baseApiKeyPluginV2: AuthPluginV2<ApiKeyConfigV2> = {
  name: 'api-key',
  initialize(engine) {
    // Register session resolver for API key subjects
    engine.registerSessionResolver('subject', {
      async getById(id: string, orm: OrmLike) {
        const subject = await orm.findFirst('subjects', {
          where: (b: any) => b('id', '=', id),
        });
        return (subject ?? null) as unknown as
          | import('../../types.v2').Subject
          | null;
      },
      sanitize(subject: any) {
        return subject; // subjects table has no sensitive fields
      },
    });
  },
  config: {
    keyLength: 32,
    keyPrefix: 'ak_',
    defaultTtlDays: 365,
    maxKeysPerUser: 10,
    requireScopes: false,
    enableUsageTracking: false,
    rateLimitPerMinute: undefined,
    cleanupExpiredKeys: true,
    cleanupUsageOlderThanDays: 90,
    allowedScopes: ['read', 'write', 'delete', 'admin'], // Default scopes
  },
  steps: [
    authenticateApiKeyStep,
    createApiKeyStep,
    listApiKeysStep,
    revokeApiKeyStep,
    updateApiKeyStep,
  ],
  getSensitiveFields() {
    return ['key_hash']; // Never expose hashed keys
  },
  rootHooks: {
    // Opportunistic cleanup for expired keys and old usage logs
    async before(_input, ctx) {
      const config = ctx.config || {};
      
      try {
        const orm = await ctx.engine.getOrm();
        
        // Clean up expired API keys if enabled
        if (config.cleanupExpiredKeys) {
          await cleanupExpiredApiKeys(orm);
        }
        
        // Clean up old usage logs if tracking is enabled
        if (config.enableUsageTracking && config.cleanupUsageOlderThanDays) {
          await cleanupOldUsageLogs(orm, config.cleanupUsageOlderThanDays);
        }
      } catch (_) {
        // Best effort cleanup; never block auth flows
      }
    },
  },
};

// Export a configured plugin creator that validates config at construction time
const apiKeyPluginV2: AuthPluginV2<ApiKeyConfigV2> = createAuthPluginV2<ApiKeyConfigV2>(
  baseApiKeyPluginV2,
  {
    validateConfig: (config) => {
      const errs: string[] = [];
      
      if (config.keyLength && config.keyLength < 16) {
        errs.push('keyLength must be at least 16 characters for security');
      }
      
      if (config.maxKeysPerUser && config.maxKeysPerUser < 1) {
        errs.push('maxKeysPerUser must be at least 1');
      }
      
      if (config.defaultTtlDays && config.defaultTtlDays < 1) {
        errs.push('defaultTtlDays must be at least 1 day');
      }
      
      if (config.rateLimitPerMinute && config.rateLimitPerMinute < 1) {
        errs.push('rateLimitPerMinute must be at least 1');
      }
      
      if (config.cleanupUsageOlderThanDays && config.cleanupUsageOlderThanDays < 1) {
        errs.push('cleanupUsageOlderThanDays must be at least 1 day');
      }
      
      return errs.length ? errs : null;
    },
  },
);

export default apiKeyPluginV2;