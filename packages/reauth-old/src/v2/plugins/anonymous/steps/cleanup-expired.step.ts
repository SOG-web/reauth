import { type } from 'arktype';
import type { AuthStep, AuthOutput } from '../../../types.';
import type { AnonymousConfig } from '../types';
import { cleanupExpiredSessions } from '../utils';

export type CleanupExpiredInput = {
  force?: boolean; // Force cleanup regardless of retention settings
  dryRun?: boolean; // Return count without actually deleting
  others?: Record<string, any>;
};

export const cleanupExpiredValidation = type({
  force: 'boolean?',
  dryRun: 'boolean?',
  'others?': 'object | undefined',
});

export const cleanupExpiredStep: AuthStep<
  CleanupExpiredInput,
  AuthOutput,
  AnonymousConfig
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
    'others?': 'object | undefined',
  }),
  async run(input, ctx) {
    const { force = false, dryRun = false, others } = input;
    const orm = await ctx.engine.getOrm();

    try {
      const now = new Date();
      const retentionDays = ctx.config?.guestDataRetentionDays ?? 7;
      const subjectRetentionDays =
        ctx.config?.guestSubjectRetentionDays ?? retentionDays;

      // Count expired sessions first
      const expiredCountResult = await orm.count('anonymous_sessions', {
        where: (b: any) => b('expires_at', '<', now),
      });
      const expiredCount =
        typeof expiredCountResult === 'number' ? expiredCountResult : 0;

      if (dryRun) {
        // For dry run, calculate what would be deleted
        const sessionCutoffDate = force
          ? now
          : new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
        const subjectCutoffDate = force
          ? now
          : new Date(
              now.getTime() - subjectRetentionDays * 24 * 60 * 60 * 1000,
            );

        const wouldCleanSessionsResult = await orm.count('anonymous_sessions', {
          where: (b: any) =>
            force
              ? b('expires_at', '<', now)
              : b.and(
                  b('expires_at', '<', now),
                  b('created_at', '<', sessionCutoffDate),
                ),
        });
        const wouldCleanSessions =
          typeof wouldCleanSessionsResult === 'number'
            ? wouldCleanSessionsResult
            : 0;

        // Estimate orphaned subjects that are tracked by anonymous plugin
        const trackedSubjectsResult = await orm.count('anonymous_subjects', {
          where: (b: any) => b('created_at', '<', subjectCutoffDate),
        });
        const wouldCleanSubjects =
          typeof trackedSubjectsResult === 'number'
            ? Math.min(trackedSubjectsResult, wouldCleanSessions)
            : 0;

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
        result.sessionsDeleted =
          typeof sessionResult === 'number' ? sessionResult : 0;

        // For force cleanup, also clean up any orphaned subjects that are tracked by anonymous plugin
        const trackedSubjects = await orm.findMany('anonymous_subjects', {
          where: (b: any) => b('created_at', '<', now),
        });

        if (trackedSubjects && Array.isArray(trackedSubjects)) {
          for (const trackedSubject of trackedSubjects) {
            const hasActiveSessions = await orm.findFirst(
              'anonymous_sessions',
              {
                where: (b: any) =>
                  b('subject_id', '=', trackedSubject.subject_id),
              },
            );

            if (!hasActiveSessions) {
              try {
                // Delete the actual subject
                await orm.deleteMany('subjects', {
                  where: (b: any) => b('id', '=', trackedSubject.subject_id),
                });

                // Remove from our tracking table
                await orm.deleteMany('anonymous_subjects', {
                  where: (b: any) =>
                    b('subject_id', '=', trackedSubject.subject_id),
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
