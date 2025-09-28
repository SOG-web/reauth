export type SessionConfig = {
  // Session management
  maxConcurrentSessions?: number; // default: unlimited (0)
  sessionRotationInterval?: number; // auto-rotate sessions (ms), default: disabled (0)

  // Device tracking
  deviceTrackingEnabled?: boolean; // default: true
  trustDeviceByDefault?: boolean; // default: false
  deviceRetentionDays?: number; // how long to keep device data (default: 90)

  cleanupIntervalMinutes?: number; // default: 30 (every 30 minutes)

  // Security features
  requireDeviceFingerprint?: boolean; // default: false
  enableGeoLocation?: boolean; // default: false (privacy-conscious)
  maxSessionsPerDevice?: number; // default: unlimited (0)
};
