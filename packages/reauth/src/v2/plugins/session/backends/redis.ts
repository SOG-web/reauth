import { BaseSessionStorage, SessionData, DeviceData, MetadataData } from './base';
import type { OrmLike } from '../../../types.v2';

// Simple Redis interface - in a real implementation, this would use redis package
interface RedisClient {
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  keys(pattern: string): Promise<string[]>;
  hset(key: string, field: string, value: string): Promise<void>;
  hget(key: string, field: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  hdel(key: string, field: string): Promise<void>;
  scan(cursor: string, options?: { MATCH?: string; COUNT?: number }): Promise<{ cursor: string; keys: string[] }>;
}

export class RedisSessionStorage extends BaseSessionStorage {
  private redis: RedisClient;
  private keyPrefix: string;

  constructor(orm: OrmLike, redis: RedisClient, keyPrefix = 'reauth:session:') {
    super(orm);
    this.redis = redis;
    this.keyPrefix = keyPrefix;
  }

  private sessionKey(sessionId: string): string {
    return `${this.keyPrefix}session:${sessionId}`;
  }

  private deviceKey(sessionId: string): string {
    return `${this.keyPrefix}device:${sessionId}`;
  }

  private metadataKey(sessionId: string): string {
    return `${this.keyPrefix}metadata:${sessionId}`;
  }

  private userSessionsKey(subjectType: string, subjectId: string): string {
    return `${this.keyPrefix}user:${subjectType}:${subjectId}`;
  }

  async createSession(session: Omit<SessionData, 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date();
    const sessionData: SessionData = {
      ...session,
      createdAt: now,
      updatedAt: now,
    };

    const key = this.sessionKey(session.sessionId);
    const userKey = this.userSessionsKey(session.subjectType, session.subjectId);
    
    // Store session data
    await this.redis.set(key, JSON.stringify(sessionData));
    
    // Add to user sessions set
    await this.redis.hset(userKey, session.sessionId, now.toISOString());
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const data = await this.redis.get(this.sessionKey(sessionId));
    if (!data) return null;

    const session = JSON.parse(data);
    return {
      ...session,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
      expiresAt: session.expiresAt ? new Date(session.expiresAt) : null,
    };
  }

  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    const existing = await this.getSession(sessionId);
    if (!existing) return;

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await this.redis.set(this.sessionKey(sessionId), JSON.stringify(updated));
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    // Remove from user sessions
    const userKey = this.userSessionsKey(session.subjectType, session.subjectId);
    await this.redis.hdel(userKey, sessionId);

    // Delete session data
    await this.redis.del(this.sessionKey(sessionId));
    await this.redis.del(this.deviceKey(sessionId));
    await this.redis.del(this.metadataKey(sessionId));
  }

  async deleteAllUserSessions(
    subjectType: string, 
    subjectId: string, 
    exceptSessionId?: string
  ): Promise<number> {
    const userKey = this.userSessionsKey(subjectType, subjectId);
    const userSessions = await this.redis.hgetall(userKey);
    
    let deleted = 0;
    for (const sessionId of Object.keys(userSessions)) {
      if (sessionId !== exceptSessionId) {
        await this.deleteSession(sessionId);
        deleted++;
      }
    }
    
    return deleted;
  }

  async upsertDevice(device: Omit<DeviceData, 'firstSeenAt' | 'lastSeenAt'> & { lastSeenAt?: Date }): Promise<void> {
    const now = new Date();
    const existing = await this.getDevice(device.sessionId);
    
    const deviceData: DeviceData = {
      ...device,
      firstSeenAt: existing?.firstSeenAt || now,
      lastSeenAt: device.lastSeenAt || now,
    };

    await this.redis.set(this.deviceKey(device.sessionId), JSON.stringify(deviceData));
  }

  async getDevice(sessionId: string): Promise<DeviceData | null> {
    const data = await this.redis.get(this.deviceKey(sessionId));
    if (!data) return null;

    const device = JSON.parse(data);
    return {
      ...device,
      firstSeenAt: new Date(device.firstSeenAt),
      lastSeenAt: new Date(device.lastSeenAt),
    };
  }

  async updateDevice(sessionId: string, updates: Partial<DeviceData>): Promise<void> {
    const existing = await this.getDevice(sessionId);
    if (!existing) return;

    const updated = { ...existing, ...updates };
    await this.redis.set(this.deviceKey(sessionId), JSON.stringify(updated));
  }

  async deleteDevice(sessionId: string): Promise<void> {
    await this.redis.del(this.deviceKey(sessionId));
  }

  async setMetadata(sessionId: string, key: string, value: any): Promise<void> {
    const now = new Date();
    const existing = await this.getMetadata(sessionId, key);
    
    const metadata: MetadataData = {
      sessionId,
      key,
      value,
      createdAt: existing[0]?.createdAt || now,
      updatedAt: now,
    };

    await this.redis.hset(this.metadataKey(sessionId), key, JSON.stringify(metadata));
  }

  async getMetadata(sessionId: string, key?: string): Promise<MetadataData[]> {
    if (key) {
      const data = await this.redis.hget(this.metadataKey(sessionId), key);
      if (!data) return [];
      
      const metadata = JSON.parse(data);
      return [{
        ...metadata,
        createdAt: new Date(metadata.createdAt),
        updatedAt: new Date(metadata.updatedAt),
      }];
    }

    const allData = await this.redis.hgetall(this.metadataKey(sessionId));
    return Object.values(allData).map(data => {
      const metadata = JSON.parse(data);
      return {
        ...metadata,
        createdAt: new Date(metadata.createdAt),
        updatedAt: new Date(metadata.updatedAt),
      };
    });
  }

  async deleteMetadata(sessionId: string, key?: string): Promise<void> {
    if (key) {
      await this.redis.hdel(this.metadataKey(sessionId), key);
    } else {
      await this.redis.del(this.metadataKey(sessionId));
    }
  }

  async listUserSessions(subjectType: string, subjectId: string): Promise<SessionData[]> {
    const userKey = this.userSessionsKey(subjectType, subjectId);
    const sessionIds = Object.keys(await this.redis.hgetall(userKey));
    
    const sessions: SessionData[] = [];
    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) sessions.push(session);
    }
    
    // Sort by updated_at descending
    return sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async countUserSessions(subjectType: string, subjectId: string): Promise<number> {
    const userKey = this.userSessionsKey(subjectType, subjectId);
    const userSessions = await this.redis.hgetall(userKey);
    return Object.keys(userSessions).length;
  }

  async cleanupExpiredSessions(retentionDays: number, batchSize: number): Promise<{
    sessionsDeleted: number;
    devicesDeleted: number;
    metadataDeleted: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    // Scan for session keys
    const sessionPattern = `${this.keyPrefix}session:*`;
    let cursor = '0';
    let sessionsDeleted = 0;
    let devicesDeleted = 0;
    let metadataDeleted = 0;
    let processed = 0;

    do {
      const result = await this.redis.scan(cursor, { MATCH: sessionPattern, COUNT: batchSize });
      cursor = result.cursor;
      
      for (const key of result.keys) {
        if (processed >= batchSize) break;
        
        const sessionId = key.replace(`${this.keyPrefix}session:`, '');
        const session = await this.getSession(sessionId);
        
        if (session) {
          const isExpired = session.expiresAt ? 
            session.expiresAt < cutoffDate :
            session.updatedAt < cutoffDate;
          
          if (isExpired) {
            // Count what exists before deletion
            if (await this.redis.exists(this.deviceKey(sessionId))) devicesDeleted++;
            
            const metadata = await this.getMetadata(sessionId);
            metadataDeleted += metadata.length;
            
            await this.deleteSession(sessionId);
            sessionsDeleted++;
          }
        }
        
        processed++;
      }
    } while (cursor !== '0' && processed < batchSize);

    return { sessionsDeleted, devicesDeleted, metadataDeleted };
  }
}