import type { AnonymousConfigV2 } from './types';
import type { OrmLike } from '../../types.v2';

/**
 * Generate a device fingerprint based on provided data
 * In a real implementation, this would combine browser features, IP, etc.
 */
export const generateFingerprint = (
  userAgent?: string,
  ip?: string,
  additional?: Record<string, any>
): string => {
  const components = [
    userAgent || 'unknown-ua',
    ip || 'unknown-ip',
    JSON.stringify(additional || {}),
  ];
  
  // Simple hash - in production use a proper fingerprinting library
  return Buffer.from(components.join('|')).toString('base64').substring(0, 32);
};

/**
 * Calculate expiration time for a guest session
 */
export const calculateExpiresAt = (config?: AnonymousConfigV2): Date => {
  const ttlSeconds = config?.sessionTtlSeconds ?? 1800; // Default 30 minutes
  return new Date(Date.now() + ttlSeconds * 1000);
};

/**
 * Check if a fingerprint has exceeded the maximum allowed concurrent sessions
 */
export const canCreateGuestSession = async (
  fingerprint: string,
  orm: OrmLike,
  config?: AnonymousConfigV2
): Promise<boolean> => {
  const maxGuests = config?.maxGuestsPerFingerprint ?? 3;
  
  const existingCount = await orm.count('anonymous_sessions', {
    where: (b: any) => 
      b.and(
        b('fingerprint', '=', fingerprint),
        b('expires_at', '>', new Date())
      ),
  });
  
  // Handle count return type (might be number or void)
  const count = typeof existingCount === 'number' ? existingCount : 0;
  return count < maxGuests;
};

/**
 * Clean up expired anonymous sessions and orphaned guest subjects
 */
export const cleanupExpiredSessions = async (
  orm: OrmLike,
  config?: AnonymousConfigV2
): Promise<{ sessionsDeleted: number; subjectsDeleted: number }> => {
  const now = new Date();
  const sessionRetentionDays = config?.guestDataRetentionDays ?? 7;
  const subjectRetentionDays = config?.guestSubjectRetentionDays ?? sessionRetentionDays;
  
  const sessionCutoffDate = new Date(now.getTime() - sessionRetentionDays * 24 * 60 * 60 * 1000);
  const subjectCutoffDate = new Date(now.getTime() - subjectRetentionDays * 24 * 60 * 60 * 1000);

  // Step 1: Delete sessions that are both expired AND past retention period
  const sessionResult = await orm.deleteMany('anonymous_sessions', {
    where: (b: any) =>
      b.and(
        b('expires_at', '<', now),
        b('created_at', '<', sessionCutoffDate)
      ),
  });
  
  const sessionsDeleted = typeof sessionResult === 'number' ? sessionResult : 0;

  // Step 2: Find and delete orphaned subjects that were created for anonymous sessions
  // but no longer have any anonymous_sessions records
  
  // First, get all subjects that have ever had anonymous sessions (to identify guest subjects)
  const guestSubjects = await orm.findMany('subjects', {
    where: (b: any) => b('created_at', '<', subjectCutoffDate),
  });

  let subjectsDeleted = 0;
  
  if (guestSubjects && Array.isArray(guestSubjects)) {
    for (const subject of guestSubjects) {
      // Check if this subject still has any anonymous_sessions
      const hasActiveSessions = await orm.findFirst('anonymous_sessions', {
        where: (b: any) => b('subject_id', '=', subject.id),
      });
      
      // If no active sessions and subject is old enough, it's an orphaned guest subject
      if (!hasActiveSessions) {
        try {
          await orm.deleteMany('subjects', {
            where: (b: any) => b('id', '=', subject.id),
          });
          subjectsDeleted++;
        } catch (error) {
          // Continue with other subjects if one fails
          continue;
        }
      }
    }
  }

  return { sessionsDeleted, subjectsDeleted };
};

/**
 * Check if a session can be extended
 */
export const canExtendSession = async (
  subjectId: string,
  orm: OrmLike,
  config?: AnonymousConfigV2
): Promise<boolean> => {
  if (!config?.allowSessionExtension) return false;
  
  const session = await orm.findFirst('anonymous_sessions', {
    where: (b: any) => b('subject_id', '=', subjectId),
  });
  
  if (!session) return false;
  
  const maxExtensions = config?.maxSessionExtensions ?? 3;
  const extensionCount = typeof session.extension_count === 'number' ? session.extension_count : 0;
  return extensionCount < maxExtensions;
};

/**
 * Generate a temporary guest subject ID
 */
export const generateGuestSubjectId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `guest_${timestamp}_${random}`;
};