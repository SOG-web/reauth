import type { AuthPlugin, AuthStep, OrmLike } from '../../types';
import type { AnonymousConfig } from './types';
export type { AnonymousConfig } from './types';
import { createGuestStep } from './steps/create-guest.step';
import { extendGuestStep } from './steps/extend-guest.step';
import { convertGuestStep } from './steps/convert-guest.step';
import { createAuthPlugin } from '../../utils/create-plugin';
import { cleanupExpiredSessions } from './utils';

export const baseAnonymousPlugin = {
  name: 'anonymous',
  initialize(engine) {
    // Register session resolver for guest subjects
    engine.registerSessionResolver('guest', {
      async getById(id: string, orm: OrmLike) {
        // First check if it's a regular subject
        const subject = await orm.findFirst('subjects', {
          where: (b: any) => b('id', '=', id),
        });

        if (!subject) return null;

        // Check if it has an anonymous session
        const anonymousSession = await orm.findFirst('anonymous_sessions', {
          where: (b: any) => b('subject_id', '=', id),
        });

        if (anonymousSession) {
          // Return guest subject with session metadata
          return {
            id: subject.id,
            type: 'guest',
            temporary: true,
            fingerprint: anonymousSession.fingerprint,
            expiresAt: anonymousSession.expires_at,
            metadata: anonymousSession.metadata || {},
            extensionsUsed: anonymousSession.extension_count || 0,
          } as unknown as import('../../types').Subject;
        }

        // If no anonymous session, treat as regular subject
        return subject as unknown as import('../../types').Subject;
      },
      sanitize(subject: any) {
        // Remove sensitive fields from guest subjects
        const { fingerprint, ...sanitized } = subject;
        return sanitized;
      },
    });

    // Register background cleanup task if enabled
    const config = this.config || {};

    const cleanupIntervalMs = config.cleanupIntervalMs || 300000; // Default 5 minutes

    engine.registerCleanupTask({
      name: 'expired-sessions',
      pluginName: 'anonymous',
      intervalMs: cleanupIntervalMs,
      enabled: true,
      runner: async (orm, pluginConfig) => {
        try {
          const result = await cleanupExpiredSessions(orm, pluginConfig);
          return {
            cleaned: result.sessionsDeleted + result.subjectsDeleted,
            sessionsDeleted: result.sessionsDeleted,
            subjectsDeleted: result.subjectsDeleted,
          };
        } catch (error) {
          return {
            cleaned: 0,
            sessionsDeleted: 0,
            subjectsDeleted: 0,
            errors: [
              `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
            ],
          };
        }
      },
    });
  },
  config: {
    sessionTtlSeconds: 1800, // 30 minutes (shorter than regular sessions)
    maxGuestsPerFingerprint: 3,
    guestDataRetentionDays: 7,
    guestSubjectRetentionDays: 7, // Same as session retention by default
    allowSessionExtension: true,
    maxSessionExtensions: 3,
    fingerprintRequired: true,
    cleanupIntervalMs: 300000, // 5 minutes
  },
  steps: [createGuestStep, extendGuestStep, convertGuestStep],
  // Removed rootHooks to avoid affecting response time
  // Background cleanup now handles expired session removal
  async getProfile(subjectId, ctx) {
    const orm = await ctx.engine.getOrm();
    const session = await orm.findFirst('anonymous_sessions', {
      where: (b: any) => b('subject_id', '=', subjectId),
      orderBy: [['created_at', 'desc']],
    });

    if (!session) return {};

    const createdAt = session?.created_at
      ? session.created_at instanceof Date
        ? session.created_at.toISOString()
        : new Date(String(session.created_at)).toISOString()
      : undefined;
    const expiresAt = session?.expires_at
      ? session.expires_at instanceof Date
        ? session.expires_at.toISOString()
        : new Date(String(session.expires_at)).toISOString()
      : undefined;

    return {
      anonymous_session: {
        fingerprint: String(session.fingerprint ?? ''), // stored hashed upstream
        created_at: createdAt,
        expires_at: expiresAt,
        extension_count:
          typeof session.extension_count === 'number'
            ? session.extension_count
            : 0,
        metadata: session.metadata ?? undefined,
      },
    };
  },
} satisfies AuthPlugin<AnonymousConfig, 'anonymous'>;

// Export a factory function that creates a configured plugin
const anonymousPlugin = (
  config: Partial<AnonymousConfig>,
  overrideStep?: Array<{
    name: string;
    override: Partial<AuthStep<AnonymousConfig>>;
  }>,
) => {
  const pl = createAuthPlugin<
    AnonymousConfig,
    'anonymous',
    typeof baseAnonymousPlugin
  >(baseAnonymousPlugin, {
    config,
    stepOverrides: overrideStep,
    validateConfig: (config) => {
      const errs: string[] = [];

      if (config.sessionTtlSeconds && config.sessionTtlSeconds < 300) {
        errs.push('sessionTtlSeconds must be at least 300 seconds (5 minutes)');
      }

      if (config.sessionTtlSeconds && config.sessionTtlSeconds > 86400) {
        errs.push(
          'sessionTtlSeconds cannot exceed 86400 seconds (24 hours) for security',
        );
      }

      if (
        config.maxGuestsPerFingerprint &&
        config.maxGuestsPerFingerprint < 1
      ) {
        errs.push('maxGuestsPerFingerprint must be at least 1');
      }

      if (
        config.maxGuestsPerFingerprint &&
        config.maxGuestsPerFingerprint > 10
      ) {
        errs.push(
          'maxGuestsPerFingerprint cannot exceed 10 for performance reasons',
        );
      }

      if (config.guestDataRetentionDays && config.guestDataRetentionDays < 1) {
        errs.push('guestDataRetentionDays must be at least 1 day');
      }

      if (
        config.guestSubjectRetentionDays &&
        config.guestSubjectRetentionDays < 1
      ) {
        errs.push('guestSubjectRetentionDays must be at least 1 day');
      }

      if (config.maxSessionExtensions && config.maxSessionExtensions < 0) {
        errs.push('maxSessionExtensions cannot be negative');
      }

      if (config.maxSessionExtensions && config.maxSessionExtensions > 10) {
        errs.push('maxSessionExtensions cannot exceed 10 for security reasons');
      }

      if (config.cleanupIntervalMs && config.cleanupIntervalMs < 60000) {
        errs.push(
          'cleanupIntervalMs must be at least 60000ms (1 minute) to avoid excessive cleanup frequency',
        );
      }

      if (config.cleanupIntervalMs && config.cleanupIntervalMs > 86400000) {
        errs.push(
          'cleanupIntervalMs cannot exceed 86400000ms (24 hours) for effective cleanup',
        );
      }

      return errs.length ? errs : null;
    },
  }) satisfies typeof baseAnonymousPlugin;

  return pl;
};

export default anonymousPlugin;
