import { column, idColumn, table } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../types';

// OAuth-style client registration
export const reauthClients = table('reauth_clients', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  client_secret_hash: column('client_secret_hash', 'varchar(255)').nullable(),
  client_type: column('client_type', 'varchar(20)'), // 'public' | 'confidential'
  name: column('name', 'varchar(255)'),
  description: column('description', 'string').nullable(),
  is_active: column('is_active', 'bool').defaultTo(true),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
});

// Enhanced JWKS key management
export const jwksKeys = table('jwks_keys', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  key_id: column('key_id', 'varchar(255)'), // kid claim
  algorithm: column('algorithm', 'varchar(10)').defaultTo('RS256'),
  public_key: column('public_key', 'string'), // JWK format
  private_key: column('private_key', 'string'), // JWK format
  is_active: column('is_active', 'bool').defaultTo(true),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  expires_at: column('expires_at', 'timestamp').nullable(), // For key rotation
  last_used_at: column('last_used_at', 'timestamp').nullable(),
  usage_count: column('usage_count', 'integer').defaultTo(0),
}).unique('jwks_keys_key_id_uk', ['key_id']);

// Key rotation history
export const jwksKeyRotations = table('jwks_key_rotations', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  old_key_id: column('old_key_id', 'varchar(255)').nullable(),
  new_key_id: column('new_key_id', 'varchar(255)'),
  rotation_reason: column('rotation_reason', 'varchar(20)'), // 'scheduled' | 'manual' | 'compromise'
  rotated_at: column('rotated_at', 'timestamp').defaultTo$('now'),
});

// JWT token blacklist (for logout/revocation)
export const jwtBlacklist = table('jwt_blacklist', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  token: column('token', 'varchar(255)'), // JWT token
  blacklisted_at: column('blacklisted_at', 'timestamp').defaultTo$('now'),
  reason: column('reason', 'varchar(20)'), // 'logout' | 'revocation' | 'security'
});

// Refresh tokens storage
export const refreshTokens = table('refresh_tokens', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  token_id: column('token_id', 'varchar(255)'), // Unique identifier for the refresh token
  subject_type: column('subject_type', 'varchar(255)'),
  subject_id: column('subject_id', 'varchar(255)'),
  token_hash: column('token_hash', 'varchar(255)'), // Hashed refresh token for security
  expires_at: column('expires_at', 'timestamp'),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  last_used_at: column('last_used_at', 'timestamp').nullable(),
  is_revoked: column('is_revoked', 'bool').defaultTo(false),
  revoked_at: column('revoked_at', 'timestamp').nullable(),
  revocation_reason: column('revocation_reason', 'varchar(50)').nullable(), // 'logout' | 'rotation' | 'security' | 'expired'
  device_fingerprint: column('device_fingerprint', 'varchar(255)').nullable(),
  ip_address: column('ip_address', 'varchar(45)').nullable(), // IPv6 compatible
  user_agent: column('user_agent', 'string').nullable(),
}).unique('refresh_tokens_token_id_uk', ['token_id']);

// Export all tables for use in schema migrations
export const jwtPluginTables = [
  reauthClients,
  jwksKeys,
  jwksKeyRotations,
  jwtBlacklist,
  refreshTokens,
];

export const jwtSchema: ReauthSchemaPlugin = {
  tables: {
    reauth_clients: reauthClients,
    jwks_keys: jwksKeys,
    jwks_key_rotations: jwksKeyRotations,
    jwt_blacklist: jwtBlacklist,
    refresh_tokens: refreshTokens,
  },
  relations: {},
};
