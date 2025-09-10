export type AnonymousConfigV2 = {
  sessionTtlSeconds?: number; // default shorter than regular sessions (e.g., 1800 = 30 minutes)
  maxGuestsPerFingerprint?: number; // limit concurrent guests per device (default 3)
  guestDataRetentionDays?: number; // how long to keep guest data (default 7 days)
  guestSubjectRetentionDays?: number; // how long to keep orphaned guest subjects (default same as guestDataRetentionDays)
  allowSessionExtension?: boolean; // whether guests can extend their session (default true)
  maxSessionExtensions?: number; // max number of extensions per session (default 3)
  fingerprintRequired?: boolean; // whether device fingerprint is required (default true)
  cleanupIntervalMs?: number; // how often to run cleanup in background (default 300000 = 5 minutes)
  enableBackgroundCleanup?: boolean; // whether to enable automatic background cleanup (default true)
};