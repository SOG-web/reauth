import { BaseSessionStorage, SessionData, DeviceData, MetadataData } from './base';
import type { OrmLike } from '../../../types.v2';

export class DatabaseSessionStorage extends BaseSessionStorage {
  constructor(orm: OrmLike) {
    super(orm);
  }

  async createSession(session: Omit<SessionData, 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date();
    
    // Insert into base sessions table
    await this.orm.insertOne('sessions', {
      id: session.sessionId,
      subject_type: session.subjectType,
      subject_id: session.subjectId,
      token: session.token,
      expires_at: session.expiresAt,
      created_at: now,
      updated_at: now,
    });

    // Insert into enhanced_sessions table
    await this.orm.insertOne('enhanced_sessions', {
      session_id: session.sessionId,
      rotation_count: 0,
      last_rotated_at: null,
      max_concurrent_reached: false,
      security_flags: null,
      created_at: now,
      updated_at: now,
    });
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const session = await this.orm.findFirst('sessions', {
      where: (b: any) => b('id', '=', sessionId),
    });

    if (!session) return null;

    return {
      sessionId: session.id,
      subjectType: session.subject_type,
      subjectId: session.subject_id,
      token: session.token,
      expiresAt: session.expires_at ? new Date(session.expires_at) : null,
      createdAt: new Date(session.created_at),
      updatedAt: new Date(session.updated_at),
    };
  }

  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    const updateData: any = {};
    
    if (updates.token !== undefined) updateData.token = updates.token;
    if (updates.expiresAt !== undefined) updateData.expires_at = updates.expiresAt;
    updateData.updated_at = new Date();

    await this.orm.updateOne('sessions', {
      where: (b: any) => b('id', '=', sessionId),
      set: updateData,
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    // Delete from enhanced_sessions first (foreign key constraint)
    await this.orm.deleteMany('enhanced_sessions', {
      where: (b: any) => b('session_id', '=', sessionId),
    });

    // Delete associated metadata
    await this.orm.deleteMany('session_metadata', {
      where: (b: any) => b('session_id', '=', sessionId),
    });

    // Delete associated device data
    await this.orm.deleteMany('session_devices', {
      where: (b: any) => b('session_id', '=', sessionId),
    });

    // Delete main session
    await this.orm.deleteMany('sessions', {
      where: (b: any) => b('id', '=', sessionId),
    });
  }

  async deleteAllUserSessions(
    subjectType: string, 
    subjectId: string, 
    exceptSessionId?: string
  ): Promise<number> {
    const whereCondition = (b: any) => {
      let condition = b('subject_type', '=', subjectType).and(b('subject_id', '=', subjectId));
      if (exceptSessionId) {
        condition = condition.and(b('id', '!=', exceptSessionId));
      }
      return condition;
    };

    // Get session IDs to delete
    const sessions = await this.orm.findMany('sessions', {
      where: whereCondition,
      select: ['id'],
    });

    const sessionIds = sessions.map((s: any) => s.id);
    
    if (sessionIds.length === 0) return 0;

    // Delete related data first
    await this.orm.deleteMany('enhanced_sessions', {
      where: (b: any) => b('session_id', 'in', sessionIds),
    });

    await this.orm.deleteMany('session_metadata', {
      where: (b: any) => b('session_id', 'in', sessionIds),
    });

    await this.orm.deleteMany('session_devices', {
      where: (b: any) => b('session_id', 'in', sessionIds),
    });

    // Delete main sessions
    await this.orm.deleteMany('sessions', {
      where: whereCondition,
    });

    return sessionIds.length;
  }

  async upsertDevice(device: Omit<DeviceData, 'firstSeenAt' | 'lastSeenAt'> & { lastSeenAt?: Date }): Promise<void> {
    const now = new Date();
    const existing = await this.orm.findFirst('session_devices', {
      where: (b: any) => b('session_id', '=', device.sessionId),
    });

    if (existing) {
      // Update existing device
      await this.orm.updateOne('session_devices', {
        where: (b: any) => b('session_id', '=', device.sessionId),
        set: {
          fingerprint: device.fingerprint,
          user_agent: device.userAgent,
          ip_address: device.ipAddress,
          location: device.location,
          last_seen_at: device.lastSeenAt || now,
          is_trusted: device.isTrusted,
          device_name: device.deviceName,
          updated_at: now,
        },
      });
    } else {
      // Insert new device
      await this.orm.insertOne('session_devices', {
        session_id: device.sessionId,
        fingerprint: device.fingerprint,
        user_agent: device.userAgent,
        ip_address: device.ipAddress,
        location: device.location,
        first_seen_at: now,
        last_seen_at: device.lastSeenAt || now,
        is_trusted: device.isTrusted,
        device_name: device.deviceName,
        created_at: now,
        updated_at: now,
      });
    }
  }

  async getDevice(sessionId: string): Promise<DeviceData | null> {
    const device = await this.orm.findFirst('session_devices', {
      where: (b: any) => b('session_id', '=', sessionId),
    });

    if (!device) return null;

    return {
      sessionId: device.session_id,
      fingerprint: device.fingerprint,
      userAgent: device.user_agent,
      ipAddress: device.ip_address,
      location: device.location,
      firstSeenAt: new Date(device.first_seen_at),
      lastSeenAt: new Date(device.last_seen_at),
      isTrusted: device.is_trusted,
      deviceName: device.device_name,
    };
  }

  async updateDevice(sessionId: string, updates: Partial<DeviceData>): Promise<void> {
    const updateData: any = { updated_at: new Date() };
    
    if (updates.fingerprint !== undefined) updateData.fingerprint = updates.fingerprint;
    if (updates.userAgent !== undefined) updateData.user_agent = updates.userAgent;
    if (updates.ipAddress !== undefined) updateData.ip_address = updates.ipAddress;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.lastSeenAt !== undefined) updateData.last_seen_at = updates.lastSeenAt;
    if (updates.isTrusted !== undefined) updateData.is_trusted = updates.isTrusted;
    if (updates.deviceName !== undefined) updateData.device_name = updates.deviceName;

    await this.orm.updateOne('session_devices', {
      where: (b: any) => b('session_id', '=', sessionId),
      set: updateData,
    });
  }

  async deleteDevice(sessionId: string): Promise<void> {
    await this.orm.deleteMany('session_devices', {
      where: (b: any) => b('session_id', '=', sessionId),
    });
  }

  async setMetadata(sessionId: string, key: string, value: any): Promise<void> {
    const now = new Date();
    const existing = await this.orm.findFirst('session_metadata', {
      where: (b: any) => b('session_id', '=', sessionId).and(b('key', '=', key)),
    });

    if (existing) {
      await this.orm.updateOne('session_metadata', {
        where: (b: any) => b('session_id', '=', sessionId).and(b('key', '=', key)),
        set: {
          value,
          updated_at: now,
        },
      });
    } else {
      await this.orm.insertOne('session_metadata', {
        session_id: sessionId,
        key,
        value,
        created_at: now,
        updated_at: now,
      });
    }
  }

  async getMetadata(sessionId: string, key?: string): Promise<MetadataData[]> {
    const where = key 
      ? (b: any) => b('session_id', '=', sessionId).and(b('key', '=', key))
      : (b: any) => b('session_id', '=', sessionId);

    const metadata = await this.orm.findMany('session_metadata', { where });

    return metadata.map((m: any) => ({
      sessionId: m.session_id,
      key: m.key,
      value: m.value,
      createdAt: new Date(m.created_at),
      updatedAt: new Date(m.updated_at),
    }));
  }

  async deleteMetadata(sessionId: string, key?: string): Promise<void> {
    const where = key 
      ? (b: any) => b('session_id', '=', sessionId).and(b('key', '=', key))
      : (b: any) => b('session_id', '=', sessionId);

    await this.orm.deleteMany('session_metadata', { where });
  }

  async listUserSessions(subjectType: string, subjectId: string): Promise<SessionData[]> {
    const sessions = await this.orm.findMany('sessions', {
      where: (b: any) => b('subject_type', '=', subjectType).and(b('subject_id', '=', subjectId)),
      orderBy: [{ column: 'updated_at', direction: 'desc' }],
    });

    return sessions.map((s: any) => ({
      sessionId: s.id,
      subjectType: s.subject_type,
      subjectId: s.subject_id,
      token: s.token,
      expiresAt: s.expires_at ? new Date(s.expires_at) : null,
      createdAt: new Date(s.created_at),
      updatedAt: new Date(s.updated_at),
    }));
  }

  async countUserSessions(subjectType: string, subjectId: string): Promise<number> {
    const result = await this.orm.findMany('sessions', {
      where: (b: any) => b('subject_type', '=', subjectType).and(b('subject_id', '=', subjectId)),
      select: ['id'],
    });

    return result.length;
  }

  async cleanupExpiredSessions(retentionDays: number, batchSize: number): Promise<{
    sessionsDeleted: number;
    devicesDeleted: number;
    metadataDeleted: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Find expired sessions in batches
    const expiredSessions = await this.orm.findMany('sessions', {
      where: (b: any) => b('expires_at', '<', cutoffDate).or(
        b('expires_at', 'is', null).and(b('updated_at', '<', cutoffDate))
      ),
      select: ['id'],
      limit: batchSize,
    });

    if (expiredSessions.length === 0) {
      return { sessionsDeleted: 0, devicesDeleted: 0, metadataDeleted: 0 };
    }

    const sessionIds = expiredSessions.map((s: any) => s.id);

    // Count what we'll delete
    const devicesCount = await this.orm.findMany('session_devices', {
      where: (b: any) => b('session_id', 'in', sessionIds),
      select: ['id'],
    });

    const metadataCount = await this.orm.findMany('session_metadata', {
      where: (b: any) => b('session_id', 'in', sessionIds),
      select: ['id'],
    });

    // Delete in order (foreign key constraints)
    await this.orm.deleteMany('enhanced_sessions', {
      where: (b: any) => b('session_id', 'in', sessionIds),
    });

    await this.orm.deleteMany('session_metadata', {
      where: (b: any) => b('session_id', 'in', sessionIds),
    });

    await this.orm.deleteMany('session_devices', {
      where: (b: any) => b('session_id', 'in', sessionIds),
    });

    await this.orm.deleteMany('sessions', {
      where: (b: any) => b('id', 'in', sessionIds),
    });

    return {
      sessionsDeleted: sessionIds.length,
      devicesDeleted: devicesCount.length,
      metadataDeleted: metadataCount.length,
    };
  }
}