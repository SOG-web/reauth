import type { OrmLike } from '../../types.';
import type { SessionConfig } from './types';

/**
 * Simple session information interface
 */
export interface SessionInfo {
  sessionId: string;
  subjectType: string;
  subjectId: string;
  token: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deviceInfo?: {
    fingerprint?: string;
    userAgent?: string;
    ipAddress?: string;
    isTrusted: boolean;
    deviceName?: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Simple session manager that works with  architecture
 */
export class SimpleSessionManager {
  private sessions: Map<string, SessionInfo> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();

  constructor(
    private orm: OrmLike,
    private config: SessionConfig,
  ) {}

  /**
   * Get user key for indexing
   */
  private getUserKey(subjectType: string, subjectId: string): string {
    return `${subjectType}:${subjectId}`;
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(
    retentionDays: number,
    batchSize: number,
  ): Promise<{
    sessionsDeleted: number;
    devicesDeleted: number;
    metadataDeleted: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let sessionsDeleted = 0;
    let devicesDeleted = 0;
    let metadataDeleted = 0;
    let processed = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (processed >= batchSize) break;

      const isExpired = session.expiresAt
        ? session.expiresAt < cutoffDate
        : session.updatedAt < cutoffDate;

      if (isExpired) {
        if (session.deviceInfo) devicesDeleted++;
        if (session.metadata)
          metadataDeleted += Object.keys(session.metadata).length;

        // Remove session
        const userKey = this.getUserKey(session.subjectType, session.subjectId);
        const userSet = this.userSessions.get(userKey);
        if (userSet) {
          userSet.delete(sessionId);
          if (userSet.size === 0) {
            this.userSessions.delete(userKey);
          }
        }
        this.sessions.delete(sessionId);
        sessionsDeleted++;
      }

      processed++;
    }

    return { sessionsDeleted, devicesDeleted, metadataDeleted };
  }
}

/**
 * Create a session manager instance
 */
export function createSessionManager(
  config: SessionConfig,
  orm: OrmLike,
): SimpleSessionManager {
  return new SimpleSessionManager(orm, config);
}

/**
 * Cleanup expired session data helper
 */
export async function cleanupExpiredSessionData(
  manager: SimpleSessionManager,
  config: SessionConfig,
): Promise<{
  sessionsDeleted: number;
  devicesDeleted: number;
  metadataDeleted: number;
}> {
  const retentionDays = config.sessionRetentionDays || 7;
  const batchSize = config.cleanupBatchSize || 100;

  return await manager.cleanupExpiredSessions(retentionDays, batchSize);
}
