import type { AuthPluginV2, OrmLike, SessionServiceV2 } from '../../types.v2';
import type { SessionConfigV2 } from './types';
export type { SessionConfigV2 } from './types';
export { sessionSchemaV2 } from './schema.v2';
import { createAuthPluginV2 } from '../../utils/create-plugin.v2';
import { cleanupExpiredSessionData, createSessionManager } from './utils';
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
function validateSessionConfig(config: Partial<SessionConfigV2>): string[] {
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

  if (
    config.sessionRetentionDays !== undefined &&
    config.sessionRetentionDays < 1
  ) {
    errors.push('sessionRetentionDays must be at least 1 day');
  }

  if (config.cleanupBatchSize !== undefined && config.cleanupBatchSize < 1) {
    errors.push('cleanupBatchSize must be at least 1');
  }

  if (config.cleanupBatchSize !== undefined && config.cleanupBatchSize > 1000) {
    errors.push('cleanupBatchSize cannot exceed 1000 for performance reasons');
  }

  return errors;
}

export const baseSessionPluginV2: AuthPluginV2<SessionConfigV2> = {
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

        return subject as unknown as import('../../types.v2').Subject;
      },
      sanitize(subject: any) {
        // Remove sensitive data from client responses
        return subject;
      },
    });

    // Register background cleanup task for expired sessions
    const config = this.config || {};
    if (config.cleanupEnabled !== false) {
      const cleanupIntervalMs =
        (config.cleanupIntervalMinutes || 30) * 60 * 1000; // Default 30 minutes

      engine.registerCleanupTask({
        name: 'enhanced-sessions-cleanup',
        pluginName: 'session',
        intervalMs: cleanupIntervalMs,
        enabled: true,
        runner: async (orm, pluginConfig) => {
          try {
            const result = await cleanupExpiredSessionData(
              createSessionManager(pluginConfig, orm),
              pluginConfig,
            );
            return {
              cleaned:
                result.sessionsDeleted +
                result.devicesDeleted +
                result.metadataDeleted,
              sessionsDeleted: result.sessionsDeleted,
              devicesDeleted: result.devicesDeleted,
              metadataDeleted: result.metadataDeleted,
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
    }
  },
  config: {
    // Session management defaults
    maxConcurrentSessions: 0, // Unlimited
    sessionRotationInterval: 0, // Disabled by default

    // Device tracking defaults
    deviceTrackingEnabled: true,
    trustDeviceByDefault: false,
    deviceRetentionDays: 90,

    // Cleanup configuration (integrates with SimpleCleanupScheduler)
    cleanupEnabled: true,
    cleanupIntervalMinutes: 30, // Every 30 minutes
    sessionRetentionDays: 7, // Keep expired session data for 7 days
    cleanupBatchSize: 100,

    // Security features
    requireDeviceFingerprint: false,
    enableGeoLocation: false, // Privacy-conscious default
    maxSessionsPerDevice: 0, // Unlimited
  },
  steps: [
    listSessionsStep,
    cleanupExpiredStep,
    logoutStep,
    logoutAllStep,
    getSessionStep,
  ],
  // Background cleanup now handles expired session removal via SimpleCleanupScheduler
  async getProfile(subjectId, ctx) {
    const sessionService = ctx.container.resolve<SessionServiceV2>('sessionServiceV2');
    const collect = async (subjectType: string) => {
      if (!sessionService?.listSessionsForSubject) return [] as any[];
      const rows = await sessionService.listSessionsForSubject(subjectType, subjectId);
      return rows.map((s: any) => ({
        sessionId: String(s.sessionId),
        token: s.token ? s.token.substring(0, 8) + '...' : undefined,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : new Date(String(s.createdAt)).toISOString(),
        expiresAt: s.expiresAt ? (s.expiresAt instanceof Date ? s.expiresAt.toISOString() : new Date(String(s.expiresAt)).toISOString()) : undefined,
        deviceInfo: s.deviceInfo,
        metadata: s.metadata,
      }));
    };

    const subjSessions = await collect('subject');
    const guestSessions = await collect('guest');

    const sessions = [...subjSessions, ...guestSessions];
    return { sessions, totalSessions: sessions.length };
  },
};

// Export a configured plugin creator that validates config at construction time.
const sessionPluginV2: AuthPluginV2<SessionConfigV2> =
  createAuthPluginV2<SessionConfigV2>(baseSessionPluginV2, {
    validateConfig: (config) => {
      return validateSessionConfig(config);
    },
  });

export default sessionPluginV2;
