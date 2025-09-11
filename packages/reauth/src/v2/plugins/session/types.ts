export type SessionConfigV2 = {
  // Storage configuration
  storageBackend?: 'database' | 'redis' | 'memory'; // default: 'database'
  redisConfig?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };

  // Session management
  maxConcurrentSessions?: number; // default: unlimited (0)
  sessionRotationInterval?: number; // auto-rotate sessions (ms), default: disabled (0)
  
  // Device tracking
  deviceTrackingEnabled?: boolean; // default: true
  trustDeviceByDefault?: boolean; // default: false
  deviceRetentionDays?: number; // how long to keep device data (default: 90)

  // Cleanup configuration (integrates with SimpleCleanupScheduler)
  cleanupEnabled?: boolean; // default: true
  cleanupIntervalMinutes?: number; // default: 30 (every 30 minutes)
  sessionRetentionDays?: number; // how long to keep expired session data (default: 7)
  cleanupBatchSize?: number; // process in batches (default: 100)
  
  // Security features
  requireDeviceFingerprint?: boolean; // default: false
  enableGeoLocation?: boolean; // default: false (privacy-conscious)
  maxSessionsPerDevice?: number; // default: unlimited (0)
};