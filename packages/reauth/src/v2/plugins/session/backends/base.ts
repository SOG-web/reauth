import type { OrmLike } from '../../../types.v2';

export interface SessionData {
  sessionId: string;
  subjectType: string;
  subjectId: string;
  token: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceData {
  sessionId: string;
  fingerprint?: string;
  userAgent?: string;
  ipAddress?: string;
  location?: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  isTrusted: boolean;
  deviceName?: string;
}

export interface MetadataData {
  sessionId: string;
  key: string;
  value: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionStorage {
  // Core session operations
  createSession(session: Omit<SessionData, 'createdAt' | 'updatedAt'>): Promise<void>;
  getSession(sessionId: string): Promise<SessionData | null>;
  updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  deleteAllUserSessions(subjectType: string, subjectId: string, exceptSessionId?: string): Promise<number>;
  
  // Device tracking
  upsertDevice(device: Omit<DeviceData, 'firstSeenAt' | 'lastSeenAt'> & { lastSeenAt?: Date }): Promise<void>;
  getDevice(sessionId: string): Promise<DeviceData | null>;
  updateDevice(sessionId: string, updates: Partial<DeviceData>): Promise<void>;
  deleteDevice(sessionId: string): Promise<void>;
  
  // Metadata operations
  setMetadata(sessionId: string, key: string, value: any): Promise<void>;
  getMetadata(sessionId: string, key?: string): Promise<MetadataData[]>;
  deleteMetadata(sessionId: string, key?: string): Promise<void>;
  
  // List operations  
  listUserSessions(subjectType: string, subjectId: string): Promise<SessionData[]>;
  countUserSessions(subjectType: string, subjectId: string): Promise<number>;
  
  // Cleanup operations
  cleanupExpiredSessions(retentionDays: number, batchSize: number): Promise<{
    sessionsDeleted: number;
    devicesDeleted: number;
    metadataDeleted: number;
  }>;
}

export abstract class BaseSessionStorage implements SessionStorage {
  protected orm: OrmLike;

  constructor(orm: OrmLike) {
    this.orm = orm;
  }

  abstract createSession(session: Omit<SessionData, 'createdAt' | 'updatedAt'>): Promise<void>;
  abstract getSession(sessionId: string): Promise<SessionData | null>;
  abstract updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void>;
  abstract deleteSession(sessionId: string): Promise<void>;
  abstract deleteAllUserSessions(subjectType: string, subjectId: string, exceptSessionId?: string): Promise<number>;
  abstract upsertDevice(device: Omit<DeviceData, 'firstSeenAt' | 'lastSeenAt'> & { lastSeenAt?: Date }): Promise<void>;
  abstract getDevice(sessionId: string): Promise<DeviceData | null>;
  abstract updateDevice(sessionId: string, updates: Partial<DeviceData>): Promise<void>;
  abstract deleteDevice(sessionId: string): Promise<void>;
  abstract setMetadata(sessionId: string, key: string, value: any): Promise<void>;
  abstract getMetadata(sessionId: string, key?: string): Promise<MetadataData[]>;
  abstract deleteMetadata(sessionId: string, key?: string): Promise<void>;
  abstract listUserSessions(subjectType: string, subjectId: string): Promise<SessionData[]>;
  abstract countUserSessions(subjectType: string, subjectId: string): Promise<number>;
  abstract cleanupExpiredSessions(retentionDays: number, batchSize: number): Promise<{
    sessionsDeleted: number;
    devicesDeleted: number;
    metadataDeleted: number;
  }>;
}