import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { AnonymousConfigV2 } from '../types';
import { cleanupExpiredSessions } from '../utils';

export type CleanupExpiredInput = {
  force?: boolean; // Force cleanup regardless of retention settings
  dryRun?: boolean; // Return count without actually deleting
  others?: Record<string, any>;
};

export const cleanupExpiredValidation = type({
  force: 'boolean?',
  dryRun: 'boolean?',
  others: 'object?',
});

export const cleanupExpiredStep: AuthStepV2<
  CleanupExpiredInput,
  AuthOutput,
  AnonymousConfigV2
> = {
  name: 'cleanup-expired',
  description: 'Remove expired anonymous sessions and cleanup stale data',
  validationSchema: cleanupExpiredValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ic: 400 },
    },
  },
  inputs: ['force', 'dryRun', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'cleanedCount?': 'number',
    'expiredSessionsCount?': 'number',
    'retentionDays?': 'number',
    'dryRun?': 'boolean',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { force = false, dryRun = false, others } = input;
    const orm = await ctx.engine.getOrm();

    try {
      const now = new Date();
      const retentionDays = ctx.config?.guestDataRetentionDays ?? 7;

      // Count expired sessions first
      const expiredCountResult = await orm.count('anonymous_sessions', {
        where: (b: any) => b('expires_at', '<', now),
      });
      const expiredCount = typeof expiredCountResult === 'number' ? expiredCountResult : 0;

      if (dryRun) {
        // For dry run, calculate what would be deleted
        const cutoffDate = force 
          ? now 
          : new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

        const wouldCleanCountResult = await orm.count('anonymous_sessions', {
          where: (b: any) =>
            force
              ? b('expires_at', '<', now)
              : b.and(
                  b('expires_at', '<', now),
                  b('created_at', '<', cutoffDate)
                ),
        });
        const wouldCleanCount = typeof wouldCleanCountResult === 'number' ? wouldCleanCountResult : 0;

        return {
          success: true,
          message: `Dry run: ${wouldCleanCount} sessions would be cleaned up`,
          status: 'su',
          cleanedCount: wouldCleanCount,
          expiredSessionsCount: expiredCount,
          retentionDays,
          dryRun: true,
          others,
        };
      }

      let cleanedCount = 0;

      if (force) {
        // Force cleanup removes all expired sessions immediately
        const result = await orm.deleteMany('anonymous_sessions', {
          where: (b: any) => b('expires_at', '<', now),
        });
        cleanedCount = typeof result === 'number' ? result : 0;
      } else {
        // Normal cleanup respects retention period
        cleanedCount = await cleanupExpiredSessions(orm, ctx.config);
      }

      // Simplified cleanup: just clean up expired sessions and trust the retention period
      // Complex orphaned subject cleanup would need more advanced ORM features

      return {
        success: true,
        message: `Cleanup completed: ${cleanedCount} expired sessions removed`,
        status: 'su',
        cleanedCount,
        expiredSessionsCount: expiredCount,
        retentionDays,
        dryRun: false,
        others,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to cleanup expired sessions',
        status: 'ic',
        others,
      };
    }
  },
};