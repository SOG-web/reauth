import type { AuthPluginV2, OrmLike } from '../../types.v2';
import type { AnonymousConfigV2 } from './types';
export type { AnonymousConfigV2 } from './types';
import { createGuestStep } from './steps/create-guest.step';
import { extendGuestStep } from './steps/extend-guest.step';
import { convertGuestStep } from './steps/convert-guest.step';
import { cleanupExpiredStep } from './steps/cleanup-expired.step';
import { createAuthPluginV2 } from '../../utils/create-plugin.v2';
import { cleanupExpiredSessions } from './utils';

export const baseAnonymousPluginV2: AuthPluginV2<AnonymousConfigV2> = {
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
          } as unknown as import('../../types.v2').Subject;
        }

        // If no anonymous session, treat as regular subject
        return subject as unknown as import('../../types.v2').Subject;
      },
      sanitize(subject: any) {
        // Remove sensitive fields from guest subjects
        const { fingerprint, ...sanitized } = subject;
        return sanitized;
      },
    });
  },
  config: {
    sessionTtlSeconds: 1800, // 30 minutes (shorter than regular sessions)
    maxGuestsPerFingerprint: 3,
    guestDataRetentionDays: 7,
    allowSessionExtension: true,
    maxSessionExtensions: 3,
    fingerprintRequired: true,
  },
  steps: [
    createGuestStep,
    extendGuestStep,
    convertGuestStep,
    cleanupExpiredStep,
  ],
  rootHooks: {
    // Opportunistic cleanup for expired sessions before each operation
    async before(_input, ctx) {
      try {
        const orm = await ctx.engine.getOrm();
        await cleanupExpiredSessions(orm, ctx.config);
      } catch (_) {
        // Best effort cleanup; never block auth flows
      }
    },
  },
};

// Export a configured plugin creator that validates config at construction time.
const anonymousPluginV2: AuthPluginV2<AnonymousConfigV2> = createAuthPluginV2<AnonymousConfigV2>(
  baseAnonymousPluginV2,
  {
    validateConfig: (config) => {
      const errs: string[] = [];
      
      if (config.sessionTtlSeconds && config.sessionTtlSeconds < 300) {
        errs.push('sessionTtlSeconds must be at least 300 seconds (5 minutes)');
      }
      
      if (config.sessionTtlSeconds && config.sessionTtlSeconds > 86400) {
        errs.push('sessionTtlSeconds cannot exceed 86400 seconds (24 hours) for security');
      }
      
      if (config.maxGuestsPerFingerprint && config.maxGuestsPerFingerprint < 1) {
        errs.push('maxGuestsPerFingerprint must be at least 1');
      }
      
      if (config.maxGuestsPerFingerprint && config.maxGuestsPerFingerprint > 10) {
        errs.push('maxGuestsPerFingerprint cannot exceed 10 for performance reasons');
      }
      
      if (config.guestDataRetentionDays && config.guestDataRetentionDays < 1) {
        errs.push('guestDataRetentionDays must be at least 1 day');
      }
      
      if (config.maxSessionExtensions && config.maxSessionExtensions < 0) {
        errs.push('maxSessionExtensions cannot be negative');
      }
      
      if (config.maxSessionExtensions && config.maxSessionExtensions > 10) {
        errs.push('maxSessionExtensions cannot exceed 10 for security reasons');
      }
      
      return errs.length ? errs : null;
    },
  },
);

export default anonymousPluginV2;