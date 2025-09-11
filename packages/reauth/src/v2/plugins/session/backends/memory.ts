import { BaseSessionStorage, SessionData, DeviceData, MetadataData } from './base';
import type { OrmLike } from '../../../types.v2';

export class MemorySessionStorage extends BaseSessionStorage {
  private sessions: Map<string, SessionData> = new Map();
  private devices: Map<string, DeviceData> = new Map();
  private metadata: Map<string, Map<string, MetadataData>> = new Map();

  constructor(orm: OrmLike) {
    super(orm);
  }

  async createSession(session: Omit<SessionData, 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date();
    this.sessions.set(session.sessionId, {
      ...session,
      createdAt: now,
      updatedAt: now,
    });
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    return this.sessions.get(sessionId) || null;
  }

  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    const existing = this.sessions.get(sessionId);
    if (!existing) return;

    this.sessions.set(sessionId, {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.devices.delete(sessionId);
    this.metadata.delete(sessionId);
  }

  async deleteAllUserSessions(
    subjectType: string, 
    subjectId: string, 
    exceptSessionId?: string
  ): Promise<number> {
    let deleted = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.subjectType === subjectType && 
          session.subjectId === subjectId && 
          sessionId !== exceptSessionId) {
        await this.deleteSession(sessionId);
        deleted++;
      }
    }
    
    return deleted;
  }

  async upsertDevice(device: Omit<DeviceData, 'firstSeenAt' | 'lastSeenAt'> & { lastSeenAt?: Date }): Promise<void> {
    const now = new Date();
    const existing = this.devices.get(device.sessionId);

    this.devices.set(device.sessionId, {
      ...device,
      firstSeenAt: existing?.firstSeenAt || now,
      lastSeenAt: device.lastSeenAt || now,
    });
  }

  async getDevice(sessionId: string): Promise<DeviceData | null> {
    return this.devices.get(sessionId) || null;
  }

  async updateDevice(sessionId: string, updates: Partial<DeviceData>): Promise<void> {
    const existing = this.devices.get(sessionId);
    if (!existing) return;

    this.devices.set(sessionId, {
      ...existing,
      ...updates,
    });
  }

  async deleteDevice(sessionId: string): Promise<void> {
    this.devices.delete(sessionId);
  }

  async setMetadata(sessionId: string, key: string, value: any): Promise<void> {
    const now = new Date();
    
    if (!this.metadata.has(sessionId)) {
      this.metadata.set(sessionId, new Map());
    }
    
    const sessionMeta = this.metadata.get(sessionId)!;
    const existing = sessionMeta.get(key);
    
    sessionMeta.set(key, {
      sessionId,
      key,
      value,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
  }

  async getMetadata(sessionId: string, key?: string): Promise<MetadataData[]> {
    const sessionMeta = this.metadata.get(sessionId);
    if (!sessionMeta) return [];

    if (key) {
      const meta = sessionMeta.get(key);
      return meta ? [meta] : [];
    }

    return Array.from(sessionMeta.values());
  }

  async deleteMetadata(sessionId: string, key?: string): Promise<void> {
    const sessionMeta = this.metadata.get(sessionId);
    if (!sessionMeta) return;

    if (key) {
      sessionMeta.delete(key);
    } else {
      this.metadata.delete(sessionId);
    }
  }

  async listUserSessions(subjectType: string, subjectId: string): Promise<SessionData[]> {
    const userSessions: SessionData[] = [];
    
    for (const session of this.sessions.values()) {
      if (session.subjectType === subjectType && session.subjectId === subjectId) {
        userSessions.push(session);
      }
    }
    
    // Sort by updated_at descending
    return userSessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async countUserSessions(subjectType: string, subjectId: string): Promise<number> {
    let count = 0;
    
    for (const session of this.sessions.values()) {
      if (session.subjectType === subjectType && session.subjectId === subjectId) {
        count++;
      }
    }
    
    return count;
  }

  async cleanupExpiredSessions(retentionDays: number, batchSize: number): Promise<{
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

      const isExpired = session.expiresAt ? 
        session.expiresAt < cutoffDate :
        session.updatedAt < cutoffDate;

      if (isExpired) {
        // Count what we'll delete
        if (this.devices.has(sessionId)) devicesDeleted++;
        if (this.metadata.has(sessionId)) {
          metadataDeleted += this.metadata.get(sessionId)!.size;
        }

        await this.deleteSession(sessionId);
        sessionsDeleted++;
      }
      
      processed++;
    }

    return { sessionsDeleted, devicesDeleted, metadataDeleted };
  }
}