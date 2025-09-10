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
 * Clean up expired anonymous sessions
 */
export const cleanupExpiredSessions = async (
  orm: OrmLike,
  config?: AnonymousConfigV2
): Promise<number> => {
  const now = new Date();
  const retentionDays = config?.guestDataRetentionDays ?? 7;
  const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  
  // Delete sessions that are both expired AND past retention period
  const result = await orm.deleteMany('anonymous_sessions', {
    where: (b: any) =>
      b.and(
        b('expires_at', '<', now),
        b('created_at', '<', cutoffDate)
      ),
  });
  
  // Handle deleteMany return type
  return typeof result === 'number' ? result : 0;
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