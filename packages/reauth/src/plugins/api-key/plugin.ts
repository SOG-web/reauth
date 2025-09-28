import type { AuthPlugin, OrmLike } from '../../types';
import type { ApiKeyConfig } from './types';
export type { ApiKeyConfig } from './types';
import { authenticateApiKeyStep } from './steps/authenticate-api-key.step';
import { createApiKeyStep } from './steps/create-api-key.step';
import { listApiKeysStep } from './steps/list-api-keys.step';
import { revokeApiKeyStep } from './steps/revoke-api-key.step';
import { updateApiKeyStep } from './steps/update-api-key.step';
import { createAuthPlugin } from '../../utils/create-plugin';
import { cleanupExpiredApiKeys, cleanupOldUsageLogs } from './utils';

export const baseApiKeyPlugin: AuthPlugin<ApiKeyConfig> = {
  name: 'api-key',
  initialize(engine) {
    // Register session resolver for API key subjects
    engine.registerSessionResolver('subject', {
      async getById(id: string, orm: OrmLike) {
        const subject = await orm.findFirst('subjects', {
          where: (b: any) => b('id', '=', id),
        });
        return (subject ?? null) as unknown as
          | import('../../types').Subject
          | null;
      },
      sanitize(subject: any) {
        return subject; // subjects table has no sensitive fields
      },
    });

    // Register background cleanup tasks
    const config = this.config || {};
    const cleanupIntervalMs = (config.cleanupIntervalMinutes || 60) * 60 * 1000; // Default 1 hour

    // Cleanup task for expired API keys

    engine.registerCleanupTask({
      name: 'expired-keys',
      pluginName: 'api-key',
      intervalMs: cleanupIntervalMs,
      enabled: true,
      runner: async (orm, pluginConfig) => {
        try {
          const result = await cleanupExpiredApiKeys(orm);
          return {
            cleaned: result,
            expiredKeysDisabled: result,
          };
        } catch (error) {
          return {
            cleaned: 0,
            expiredKeysDisabled: 0,
            errors: [
              `Key cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
            ],
          };
        }
      },
    });

    // Cleanup task for old usage logs (if usage tracking is enabled)
    // if (config.enableUsageTracking) {
    //   engine.registerCleanupTask({
    //     name: 'old-usage-logs',
    //     pluginName: 'api-key',
    //     intervalMs: cleanupIntervalMs * 6, // Run less frequently (every 6 hours by default)
    //     enabled: true,
    //     runner: async (orm, pluginConfig) => {
    //       try {
    //         const result = await cleanupOldUsageLogs(
    //           orm,
    //           pluginConfig.cleanupUsageOlderThanDays,
    //         );
    //         return {
    //           cleaned: result,
    //           usageLogsDeleted: result,
    //         };
    //       } catch (error) {
    //         return {
    //           cleaned: 0,
    //           usageLogsDeleted: 0,
    //           errors: [
    //             `Usage cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
    //           ],
    //         };
    //       }
    //     },
    //   });
    // }
  },
  config: {
    keyLength: 32,
    keyPrefix: 'ak_',
    defaultTtlDays: 365,
    maxKeysPerUser: 10,
    requireScopes: false,
    enableUsageTracking: false,
    cleanupIntervalMinutes: 60, // 1 hour
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
  async getProfile(subjectId, ctx) {
    const orm = await ctx.engine.getOrm();
    const keys = await orm.findMany('api_keys', {
      where: (b: any) => b('subject_id', '=', subjectId),
      orderBy: [['created_at', 'desc']],
    });

    const items = (keys || []).map((k: any) => {
      const expiresAt = k?.expires_at
        ? k.expires_at instanceof Date
          ? k.expires_at.toISOString()
          : new Date(String(k.expires_at)).toISOString()
        : null;
      const createdAt = k?.created_at
        ? k.created_at instanceof Date
          ? k.created_at.toISOString()
          : new Date(String(k.created_at)).toISOString()
        : undefined;
      const updatedAt = k?.updated_at
        ? k.updated_at instanceof Date
          ? k.updated_at.toISOString()
          : new Date(String(k.updated_at)).toISOString()
        : undefined;
      const lastUsedAt = k?.last_used_at
        ? k.last_used_at instanceof Date
          ? k.last_used_at.toISOString()
          : new Date(String(k.last_used_at)).toISOString()
        : null;
      return {
        id: String(k.id),
        name: String(k.name ?? ''),
        permissions: Array.isArray(k.permissions)
          ? k.permissions.map((p: any) => String(p))
          : [],
        scopes: Array.isArray(k.scopes)
          ? k.scopes.map((s: any) => String(s))
          : [],
        expires_at: expiresAt,
        is_active: Boolean(k.is_active),
        created_at: createdAt,
        updated_at: updatedAt,
        last_used_at: lastUsedAt,
      };
    });

    return { api_keys: items };
  },
  // Background cleanup now handles expired keys and usage logs via SimpleCleanupScheduler
};

// Export a configured plugin creator that validates config at construction time
const apiKeyPlugin: AuthPlugin<ApiKeyConfig> = createAuthPlugin<ApiKeyConfig>(
  baseApiKeyPlugin,
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

      // Validate cleanup configuration
      if (config.cleanupIntervalMinutes && config.cleanupIntervalMinutes < 1) {
        errs.push('cleanupIntervalMinutes must be at least 1 minute');
      }

      if (
        config.cleanupIntervalMinutes &&
        config.cleanupIntervalMinutes > 1440
      ) {
        errs.push(
          'cleanupIntervalMinutes cannot exceed 1440 minutes (24 hours)',
        );
      }

      return errs.length ? errs : null;
    },
  },
);

export default apiKeyPlugin;
