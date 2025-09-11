import type { OrmLike } from '../../types.v2';
import type { SessionConfigV2 } from './types';
import type { SessionStorage } from './backends/base';
import { DatabaseSessionStorage } from './backends/database';
import { MemorySessionStorage } from './backends/memory';
import { RedisSessionStorage } from './backends/redis';

/**
 * Generate a cryptographically secure session token
 */
export function generateSessionToken(): string {
  // In a real implementation, use crypto.randomBytes or similar
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a device fingerprint hash from request data
 */
export function generateDeviceFingerprint(userAgent?: string, ipAddress?: string): string {
  // Simple fingerprint - in production, use more sophisticated fingerprinting
  const data = `${userAgent || 'unknown'}:${ipAddress || 'unknown'}`;
  return Buffer.from(data).toString('base64').substring(0, 32);
}

/**
 * Extract location from IP address (mock implementation)
 */
export function extractLocationFromIP(ipAddress: string): string | null {
  // Mock implementation - in production, use a GeoIP service
  if (ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress.startsWith('127.')) {
    return 'Local Network';
  }
  return null; // Would return city, country from real GeoIP lookup
}

/**
 * Check if a session is expired
 */
export function isSessionExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false; // No expiry means never expires
  return new Date() > expiresAt;
}

/**
 * Calculate session expiry date
 */
export function calculateSessionExpiry(ttlSeconds: number): Date {
  const expiry = new Date();
  expiry.setSeconds(expiry.getSeconds() + ttlSeconds);
  return expiry;
}

/**
 * Create appropriate storage backend based on configuration
 */
export function createSessionStorage(config: SessionConfigV2, orm: OrmLike): SessionStorage {
  const backend = config.storageBackend || 'database';

  switch (backend) {
    case 'memory':
      return new MemorySessionStorage(orm);
      
    case 'redis':
      // In a real implementation, create Redis client from config
      throw new Error('Redis backend not implemented - requires Redis client');
      
    case 'database':
    default:
      return new DatabaseSessionStorage(orm);
  }
}

/**
 * Validate session configuration
 */
export function validateSessionConfig(config: Partial<SessionConfigV2>): string[] {
  const errors: string[] = [];

  if (config.maxConcurrentSessions !== undefined && config.maxConcurrentSessions < 0) {
    errors.push('maxConcurrentSessions cannot be negative');
  }

  if (config.sessionRotationInterval !== undefined && config.sessionRotationInterval < 0) {
    errors.push('sessionRotationInterval cannot be negative');
  }

  if (config.cleanupIntervalMinutes !== undefined && config.cleanupIntervalMinutes < 1) {
    errors.push('cleanupIntervalMinutes must be at least 1 minute');
  }

  if (config.cleanupIntervalMinutes !== undefined && config.cleanupIntervalMinutes > 1440) {
    errors.push('cleanupIntervalMinutes cannot exceed 1440 minutes (24 hours)');
  }

  if (config.sessionRetentionDays !== undefined && config.sessionRetentionDays < 1) {
    errors.push('sessionRetentionDays must be at least 1 day');
  }

  if (config.deviceRetentionDays !== undefined && config.deviceRetentionDays < 1) {
    errors.push('deviceRetentionDays must be at least 1 day');
  }

  if (config.cleanupBatchSize !== undefined && config.cleanupBatchSize < 1) {
    errors.push('cleanupBatchSize must be at least 1');
  }

  if (config.cleanupBatchSize !== undefined && config.cleanupBatchSize > 1000) {
    errors.push('cleanupBatchSize cannot exceed 1000 for performance reasons');
  }

  if (config.maxSessionsPerDevice !== undefined && config.maxSessionsPerDevice < 0) {
    errors.push('maxSessionsPerDevice cannot be negative');
  }

  if (config.storageBackend === 'redis' && !config.redisConfig) {
    errors.push('redisConfig is required when using Redis storage backend');
  }

  return errors;
}

/**
 * Cleanup expired sessions, devices, and metadata
 */
export async function cleanupExpiredSessionData(
  storage: SessionStorage,
  config: SessionConfigV2
): Promise<{
  sessionsDeleted: number;
  devicesDeleted: number;
  metadataDeleted: number;
}> {
  const retentionDays = config.sessionRetentionDays || 7;
  const batchSize = config.cleanupBatchSize || 100;

  return await storage.cleanupExpiredSessions(retentionDays, batchSize);
}

/**
 * Check if user has reached concurrent session limit
 */
export async function checkConcurrentSessionLimit(
  storage: SessionStorage,
  subjectType: string,
  subjectId: string,
  maxSessions: number
): Promise<{ allowed: boolean; currentCount: number }> {
  if (maxSessions <= 0) {
    return { allowed: true, currentCount: 0 }; // No limit
  }

  const currentCount = await storage.countUserSessions(subjectType, subjectId);
  return { 
    allowed: currentCount < maxSessions, 
    currentCount 
  };
}

/**
 * Rotate session token for security
 */
export async function rotateSessionToken(
  storage: SessionStorage,
  sessionId: string
): Promise<{ success: boolean; newToken?: string; error?: string }> {
  try {
    const session = await storage.getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (isSessionExpired(session.expiresAt)) {
      return { success: false, error: 'Session is expired' };
    }

    const newToken = generateSessionToken();
    await storage.updateSession(sessionId, { token: newToken });

    return { success: true, newToken };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}