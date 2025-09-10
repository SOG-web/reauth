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
    'sessionsDeleted?': 'number',
    'subjectsDeleted?': 'number',
    'expiredSessionsCount?': 'number',
    'retentionDays?': 'number',
    'subjectRetentionDays?': 'number',
    'dryRun?': 'boolean',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { force = false, dryRun = false, others } = input;
    const orm = await ctx.engine.getOrm();

    try {
      const now = new Date();
      const retentionDays = ctx.config?.guestDataRetentionDays ?? 7;
      const subjectRetentionDays = ctx.config?.guestSubjectRetentionDays ?? retentionDays;

      // Count expired sessions first
      const expiredCountResult = await orm.count('anonymous_sessions', {
        where: (b: any) => b('expires_at', '<', now),
      });
      const expiredCount = typeof expiredCountResult === 'number' ? expiredCountResult : 0;

      if (dryRun) {
        // For dry run, calculate what would be deleted
        const sessionCutoffDate = force 
          ? now 
          : new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
        const subjectCutoffDate = force 
          ? now 
          : new Date(now.getTime() - subjectRetentionDays * 24 * 60 * 60 * 1000);

        const wouldCleanSessionsResult = await orm.count('anonymous_sessions', {
          where: (b: any) =>
            force
              ? b('expires_at', '<', now)
              : b.and(
                  b('expires_at', '<', now),
                  b('created_at', '<', sessionCutoffDate)
                ),
        });
        const wouldCleanSessions = typeof wouldCleanSessionsResult === 'number' ? wouldCleanSessionsResult : 0;

        // Estimate orphaned subjects (simplified for dry run)
        const oldSubjectsResult = await orm.count('subjects', {
          where: (b: any) => b('created_at', '<', subjectCutoffDate),
        });
        const wouldCleanSubjects = typeof oldSubjectsResult === 'number' ? Math.min(oldSubjectsResult, wouldCleanSessions) : 0;

        const totalWouldClean = wouldCleanSessions + wouldCleanSubjects;

        return {
          success: true,
          message: `Dry run: ${wouldCleanSessions} sessions and ${wouldCleanSubjects} subjects would be cleaned up`,
          status: 'su',
          cleanedCount: totalWouldClean,
          sessionsDeleted: wouldCleanSessions,
          subjectsDeleted: wouldCleanSubjects,
          expiredSessionsCount: expiredCount,
          retentionDays,
          subjectRetentionDays,
          dryRun: true,
          others,
        };
      }

      let result = { sessionsDeleted: 0, subjectsDeleted: 0 };

      if (force) {
        // Force cleanup removes all expired sessions immediately
        const sessionResult = await orm.deleteMany('anonymous_sessions', {
          where: (b: any) => b('expires_at', '<', now),
        });
        result.sessionsDeleted = typeof sessionResult === 'number' ? sessionResult : 0;

        // For force cleanup, also clean up any orphaned subjects
        // This is a simplified approach - in production you might want more sophisticated logic
        const oldSubjects = await orm.findMany('subjects', {
          where: (b: any) => b('created_at', '<', now),
        });

        if (oldSubjects && Array.isArray(oldSubjects)) {
          for (const subject of oldSubjects) {
            const hasActiveSessions = await orm.findFirst('anonymous_sessions', {
              where: (b: any) => b('subject_id', '=', subject.id),
            });
            
            if (!hasActiveSessions) {
              try {
                await orm.deleteMany('subjects', {
                  where: (b: any) => b('id', '=', subject.id),
                });
                result.subjectsDeleted++;
              } catch (error) {
                continue;
              }
            }
          }
        }
      } else {
        // Normal cleanup respects retention period
        result = await cleanupExpiredSessions(orm, ctx.config);
      }

      const totalCleaned = result.sessionsDeleted + result.subjectsDeleted;

      return {
        success: true,
        message: `Cleanup completed: ${result.sessionsDeleted} sessions and ${result.subjectsDeleted} subjects removed`,
        status: 'su',
        cleanedCount: totalCleaned,
        sessionsDeleted: result.sessionsDeleted,
        subjectsDeleted: result.subjectsDeleted,
        expiredSessionsCount: expiredCount,
        retentionDays,
        subjectRetentionDays,
        dryRun: false,
        others,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to cleanup expired sessions and subjects',
        status: 'ic',
        others,
      };
    }
  },
};