import type { AuthPlugin, AuthStep, OrmLike, Subject } from '../../types';
import type { UsernamePasswordConfig } from './types';
export type { UsernamePasswordConfig } from './types';
import { loginStep } from './steps/login.step';
import { registerStep } from './steps/register.step';
import { changePasswordStep } from './steps/change-password.step';
import { createAuthPlugin } from '../../utils/create-plugin';
import { cleanupExpiredCodes } from './utils';

export const baseUsernamePasswordPlugin: AuthPlugin<UsernamePasswordConfig> = {
  name: 'username-password',
  initialize(engine) {
    engine.registerSessionResolver('subject', {
      async getById(id: string, orm: OrmLike) {
        const subject = await orm.findFirst('subjects', {
          where: (b: any) => b('id', '=', id),
        });
        return (subject ?? null) as unknown as Subject | null;
      },
      sanitize(subject: any) {
        return subject; // subjects table has no sensitive fields
      },
    });

    // Register background cleanup task for expired reset codes (if reset functionality is enabled)
    const config = this.config || {};
    if (config.enableResetByUsername) {
      const cleanupIntervalMs =
        (config.cleanupIntervalMinutes || 60) * 60 * 1000; // Default 1 hour

      engine.registerCleanupTask({
        name: 'expired-reset-codes',
        pluginName: 'username-password',
        intervalMs: cleanupIntervalMs,
        enabled: true,
        runner: async (orm, pluginConfig) => {
          try {
            const result = await cleanupExpiredCodes(orm);
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
    cleanupIntervalMinutes: 60, // 1 hour
  },
  steps: [
    loginStep,
    registerStep,
    changePasswordStep,
    // Note: No verification steps since username doesn't require verification
    //TODO: Optional: Add reset steps if enableResetByUsername is implemented in the future
  ],
  async getProfile(subjectId, ctx) {
    const orm = await ctx.engine.getOrm();
    const identities = await orm.findMany('identities', {
      where: (b: any) =>
        b.and(b('subject_id', '=', subjectId), b('provider', '=', 'username')),
      orderBy: [['created_at', 'desc']],
    });

    const usernames = (identities || []).map((ident: any) => ({
      username: String(ident.identifier),
      verified: Boolean(ident.verified),
      created_at: ident?.created_at
        ? ident.created_at instanceof Date
          ? ident.created_at.toISOString()
          : new Date(String(ident.created_at)).toISOString()
        : undefined,
      updated_at: ident?.updated_at
        ? ident.updated_at instanceof Date
          ? ident.updated_at.toISOString()
          : new Date(String(ident.updated_at)).toISOString()
        : undefined,
    }));

    const creds = await orm.findFirst('credentials', {
      where: (b: any) => b('subject_id', '=', subjectId),
    });

    return {
      usernames,
      password: { set: Boolean(creds?.password_hash) },
    };
  },
  // Background cleanup now handles expired reset codes via SimpleCleanupScheduler
};

// Export a factory function that creates a configured plugin
const usernamePasswordPlugin = (
  config: Partial<UsernamePasswordConfig>,
  overrideStep?: Array<{
    name: string;
    override: Partial<AuthStep<UsernamePasswordConfig>>;
  }>,
): AuthPlugin<UsernamePasswordConfig> =>
  createAuthPlugin<UsernamePasswordConfig>(baseUsernamePasswordPlugin, {
    config,
    stepOverrides: overrideStep,
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

      return errs.length ? errs : null;
    },
  });

export default usernamePasswordPlugin;
