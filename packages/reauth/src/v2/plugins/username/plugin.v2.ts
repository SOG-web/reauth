import type { AuthPluginV2, OrmLike } from '../../types.v2';
import type { UsernamePasswordConfigV2 } from './types';
export type { UsernamePasswordConfigV2 } from './types';
import { loginStep } from './steps/login.step';
import { registerStep } from './steps/register.step';
import { changePasswordStep } from './steps/change-password.step';
import { createAuthPluginV2 } from '../../utils/create-plugin.v2';
import { cleanupExpiredCodes } from './utils';

export const baseUsernamePasswordPluginV2: AuthPluginV2<UsernamePasswordConfigV2> =
  {
    name: 'username-password',
    initialize(engine) {
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

      // Register background cleanup task for expired reset codes (if reset functionality is enabled)
      const config = this.config || {};
      if (config.cleanupEnabled !== false && config.enableResetByUsername) {
        const cleanupIntervalMs =
          (config.cleanupIntervalMinutes || 60) * 60 * 1000; // Default 1 hour

        engine.registerCleanupTask({
          name: 'expired-reset-codes',
          pluginName: 'username-password',
          intervalMs: cleanupIntervalMs,
          enabled: true,
          runner: async (orm, pluginConfig) => {
            try {
              const result = await cleanupExpiredCodes(orm, pluginConfig);
              return {
                cleaned: result.resetCodesDeleted,
                resetCodesDeleted: result.resetCodesDeleted,
              };
            } catch (error) {
              return {
                cleaned: 0,
                resetCodesDeleted: 0,
                errors: [
                  `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
                ],
              };
            }
          },
        });
      }
    },
    config: {
      loginOnRegister: true,
      sessionTtlSeconds: 3600,
      // Username has no verification flow by design
      enableResetByUsername: false,
      resetPasswordCodeExpiresIn: 30 * 60 * 1000,
      codeType: 'numeric',
      codeLength: 4,
      cleanupEnabled: true,
      cleanupIntervalMinutes: 60, // 1 hour
      retentionDays: 1,
      cleanupBatchSize: 100,
    },
    steps: [
      loginStep,
      registerStep,
      changePasswordStep,
      // Note: No verification steps since username doesn't require verification
      // Optional: Add reset steps if enableResetByUsername is implemented in the future
    ],
    // Background cleanup now handles expired reset codes via SimpleCleanupScheduler
  };

// Export a configured plugin creator with minimal validation (no complex config validation needed)
const usernamePasswordPluginV2: AuthPluginV2<UsernamePasswordConfigV2> =
  createAuthPluginV2<UsernamePasswordConfigV2>(baseUsernamePasswordPluginV2, {
    validateConfig: (config) => {
      const errs: string[] = [];

      // Username plugin has minimal config validation requirements
      // Future: Add validation for enableResetByUsername if implemented

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

      if (config.retentionDays && config.retentionDays < 1) {
        errs.push('retentionDays must be at least 1 day');
      }

      if (config.cleanupBatchSize && config.cleanupBatchSize < 1) {
        errs.push('cleanupBatchSize must be at least 1');
      }

      if (config.cleanupBatchSize && config.cleanupBatchSize > 1000) {
        errs.push(
          'cleanupBatchSize cannot exceed 1000 for performance reasons',
        );
      }

      return errs.length ? errs : null;
    },
  });

export default usernamePasswordPluginV2;
