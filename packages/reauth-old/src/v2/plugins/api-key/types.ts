export type ApiKeyConfig = {
  keyLength?: number; // Length of generated API key (default: 32)
  keyPrefix?: string; // Prefix for generated keys (default: 'ak_')
  defaultTtlDays?: number; // Default expiration period in days (default: 365)
  maxKeysPerUser?: number; // Maximum keys per subject (default: 10)
  allowedScopes?: string[]; // Available permission scopes
  requireScopes?: boolean; // Whether scopes are mandatory (default: false)
  enableUsageTracking?: boolean; // Enable usage logging (default: false)

  // Rate limiting options
  rateLimitPerMinute?: number; // Requests per minute per key (default: no limit)

  // Cleanup options
  cleanupExpiredKeys?: boolean; // Auto-remove expired keys (default: true)
  cleanupUsageOlderThanDays?: number; // Remove usage logs older than N days (default: 90)
  cleanupEnabled?: boolean; // Enable background cleanup (default: true)
  cleanupIntervalMinutes?: number; // Cleanup frequency in minutes (default: 60)
  cleanupBatchSize?: number; // Process in batches (default: 100)
};

// Supported scopes for API key permissions
export type ApiKeyScope =
  | 'read' // Read-only access
  | 'write' // Write access
  | 'delete' // Delete access
  | 'admin' // Administrative access
  | string; // Custom scopes

// API key metadata (what gets returned to users, never includes raw key)
export type ApiKeyMetadata = {
  id: string;
  name: string;
  subject_id: string;
  permissions?: string[];
  scopes?: string[];
  last_used_at?: Date | null;
  expires_at?: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

// Input for creating a new API key
export type CreateApiKeyInput = {
  name: string;
  permissions?: string[];
  scopes?: string[];
  expires_at?: Date | null;
  ttl_days?: number; // Alternative to expires_at
};

// Output when creating an API key (includes the raw key only once)
export type CreateApiKeyOutput = {
  api_key: string; // The actual key - only returned once!
  metadata: ApiKeyMetadata;
};

// Usage tracking entry
export type ApiKeyUsageEntry = {
  id: string;
  api_key_id: string;
  endpoint?: string;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  error_message?: string;
  used_at: Date;
};
