import type { AuthPluginV2, OrmLike } from '../../types.v2';
import type { SessionConfigV2 } from './types';
export type { SessionConfigV2 } from './types';
import { createAuthPluginV2 } from '../../utils/create-plugin.v2';
import { cleanupExpiredSessionData, createSessionStorage, validateSessionConfig } from './utils';
import {
  listSessionsStep,
  revokeSessionStep,
  revokeAllSessionsStep,
  getSessionInfoStep,
  rotateSessionStep,
  trustDeviceStep,
  cleanupExpiredStep,
} from './steps';

export const baseSessionPluginV2: AuthPluginV2<SessionConfigV2> = {
  name: 'session',
  initialize(engine) {
    // Register session resolver for enhanced session management
    engine.registerSessionResolver('enhanced_subject', {
      async getById(id: string, orm: OrmLike) {
        // First get the base subject
        const subject = await orm.findFirst('subjects', {
          where: (b: any) => b('id', '=', id),
        });

        if (!subject) return null;

        // Get enhanced session data if available
        const enhancedSession = await orm.findFirst('enhanced_sessions', {
          where: (b: any) => b('session_id', '=', id), // Note: id here is session_id
        });

        return {
          ...subject,
          enhanced: enhancedSession ? {
            rotationCount: enhancedSession.rotation_count,
            lastRotatedAt: enhancedSession.last_rotated_at,
            maxConcurrentReached: enhancedSession.max_concurrent_reached,
            securityFlags: enhancedSession.security_flags,
          } : null,
        } as unknown as import('../../types.v2').Subject;
      },
      sanitize(subject: any) {
        // Remove sensitive enhanced data from client responses
        if (subject.enhanced) {
          const { securityFlags, ...safeEnhanced } = subject.enhanced;
          return { ...subject, enhanced: safeEnhanced };
        }
        return subject;
      },
    });

    // Register background cleanup task for expired sessions
    const config = this.config || {};
    if (config.cleanupEnabled !== false) {
      const cleanupIntervalMs = (config.cleanupIntervalMinutes || 30) * 60 * 1000; // Default 30 minutes

      engine.registerCleanupTask({
        name: 'expired-sessions',
        pluginName: 'session',
        intervalMs: cleanupIntervalMs,
        enabled: true,
        runner: async (orm, pluginConfig) => {
          try {
            const storage = createSessionStorage(pluginConfig, orm);
            const result = await cleanupExpiredSessionData(storage, pluginConfig);
            return {
              cleaned: result.sessionsDeleted + result.devicesDeleted + result.metadataDeleted,
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
              errors: [`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`],
            };
          }
        },
      });
    }
  },
  config: {
    // Storage configuration
    storageBackend: 'database' as const,
    
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
    revokeSessionStep,
    revokeAllSessionsStep,
    getSessionInfoStep,
    rotateSessionStep,
    trustDeviceStep,
    cleanupExpiredStep,
  ],
  // Background cleanup now handles expired session removal via SimpleCleanupScheduler
};

// Export a configured plugin creator that validates config at construction time.
const sessionPluginV2: AuthPluginV2<SessionConfigV2> = createAuthPluginV2<SessionConfigV2>(
  baseSessionPluginV2,
  {
    validateConfig: (config) => {
      return validateSessionConfig(config);
    },
  },
);

export default sessionPluginV2;