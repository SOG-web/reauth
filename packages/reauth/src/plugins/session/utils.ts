import type { OrmLike } from '../../types';
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
