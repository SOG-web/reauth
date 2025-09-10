export type AnonymousConfigV2 = {
  sessionTtlSeconds?: number; // default shorter than regular sessions (e.g., 1800 = 30 minutes)
  maxGuestsPerFingerprint?: number; // limit concurrent guests per device (default 3)
  guestDataRetentionDays?: number; // how long to keep guest data (default 7 days)
  allowSessionExtension?: boolean; // whether guests can extend their session (default true)
  maxSessionExtensions?: number; // max number of extensions per session (default 3)
  fingerprintRequired?: boolean; // whether device fingerprint is required (default true)
};