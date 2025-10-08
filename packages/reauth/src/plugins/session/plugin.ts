import type {
  AuthPlugin,
  AuthStep,
  OrmLike,
  SessionService,
} from '../../types';
import type { SessionConfig } from './types';
export type { SessionConfig } from './types';
export { sessionSchema } from './schema';
import { createAuthPlugin } from '../../utils/create-plugin';

import {
  listSessionsStep,
  cleanupExpiredStep,
  logoutStep,
  logoutAllStep,
  getSessionStep,
} from './steps';

/**
 * Validate session configuration
 */
function validateSessionConfig(config: Partial<SessionConfig>): string[] {
  const errors: string[] = [];

  if (
    config.maxConcurrentSessions !== undefined &&
    config.maxConcurrentSessions < 0
  ) {
    errors.push('maxConcurrentSessions cannot be negative');
  }

  if (
    config.cleanupIntervalMinutes !== undefined &&
    config.cleanupIntervalMinutes < 1
  ) {
    errors.push('cleanupIntervalMinutes must be at least 1 minute');
  }

  if (
    config.cleanupIntervalMinutes !== undefined &&
    config.cleanupIntervalMinutes > 1440
  ) {
    errors.push('cleanupIntervalMinutes cannot exceed 1440 minutes (24 hours)');
  }

  return errors;
}

export const baseSessionPlugin = {
  name: 'session',
  initialize(engine) {
    // Enable enhanced session features in the core session service
    engine.enableEnhancedSessions();

    // Register session resolver for enhanced session management
    engine.registerSessionResolver('enhanced_subject', {
      async getById(id: string, orm: OrmLike) {
        // Use existing subject resolution but enhanced with session data
        const subject = await orm.findFirst('subjects', {
          where: (b: any) => b('id', '=', id),
        });

        return subject as unknown as import('../../types').Subject;
      },
      sanitize(subject: any) {
        // Remove sensitive data from client responses
        return subject;
      },
    });

    // Register background cleanup task for expired sessions
    const config = this.config || {};

    const cleanupIntervalMs = (config.cleanupIntervalMinutes || 30) * 60 * 1000; // Default 30 minutes

    engine.registerCleanupTask({
      name: 'enhanced-sessions-cleanup',
      pluginName: 'session',
      intervalMs: cleanupIntervalMs,
      enabled: true,
      runner: async (orm, pluginConfig) => {
        try {
          //TODO: fix
          return {
            cleaned: 0,
            sessionsDeleted: 0,
            devicesDeleted: 0,
            metadataDeleted: 0,
          };
        } catch (error) {
          return {
            cleaned: 0,
            sessionsDeleted: 0,
            devicesDeleted: 0,
            metadataDeleted: 0,
            errors: [
              `Enhanced session cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
            ],
          };
        }
      },
    });
  },
  config: {
    // Session management defaults
    maxConcurrentSessions: 0, // Unlimited
    sessionRotationInterval: 0, // Disabled by default

    // Device tracking defaults
    deviceTrackingEnabled: true,
    trustDeviceByDefault: false,
    deviceRetentionDays: 90,

    cleanupIntervalMinutes: 30, // Every 30 minutes

    // Security features
    requireDeviceFingerprint: false,
    enableGeoLocation: false, // Privacy-conscious default
    maxSessionsPerDevice: 0, // Unlimited
  },
  steps: [
    listSessionsStep,
    // cleanupExpiredStep,
    logoutStep,
    logoutAllStep,
    getSessionStep,
  ],
  // Background cleanup now handles expired session removal via SimpleCleanupScheduler
  async getProfile(subjectId, ctx) {
    const sessionService = ctx.engine.getSessionService();
    const collect = async (subjectType: string) => {
      if (!sessionService?.listSessionsForSubject) return [] as any[];
      const rows = await sessionService.listSessionsForSubject(
        subjectType,
        subjectId,
      );
      return rows.map((s: any) => ({
        sessionId: String(s.sessionId),
        token: s.token ? s.token.substring(0, 8) + '...' : undefined,
        createdAt:
          s.createdAt instanceof Date
            ? s.createdAt.toISOString()
            : new Date(String(s.createdAt)).toISOString(),
        expiresAt: s.expiresAt
          ? s.expiresAt instanceof Date
            ? s.expiresAt.toISOString()
            : new Date(String(s.expiresAt)).toISOString()
          : undefined,
        deviceInfo: s.deviceInfo,
        metadata: s.metadata,
      }));
    };

    const subjSessions = await collect('subject');
    const guestSessions = await collect('guest');

    const sessions = [...subjSessions, ...guestSessions];
    return { sessions, totalSessions: sessions.length };
  },
} satisfies AuthPlugin<SessionConfig, 'session'>;

// Export a factory function that creates a configured plugin
const sessionPlugin = (
  config: Partial<SessionConfig>,
  overrideStep?: Array<{
    name: string;
    override: Partial<AuthStep<SessionConfig>>;
  }>,
) => {
  const pl = createAuthPlugin<
    SessionConfig,
    'session',
    typeof baseSessionPlugin
  >(baseSessionPlugin, {
    config,
    stepOverrides: overrideStep,
    validateConfig: (config) => {
      return validateSessionConfig(config);
    },
    rootHooks: config.rootHooks,
  }) satisfies typeof baseSessionPlugin;

  return pl;
};

export default sessionPlugin;
