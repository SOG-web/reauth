import { column, idColumn, table } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../../types';

// API key table for storing hashed keys and metadata
export const apiKeys = table('api_keys', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  subject_id: column('subject_id', 'varchar(255)'),
  name: column('name', 'varchar(255)'), // Human-readable name for the key
  key_hash: column('key_hash', 'varchar(255)'), // Hashed API key (never store plaintext)
  permissions: column('permissions', 'json').nullable(), // JSON array of permissions
  scopes: column('scopes', 'json').nullable(), // JSON array of scopes
  last_used_at: column('last_used_at', 'timestamp').nullable(),
  expires_at: column('expires_at', 'timestamp').nullable(),
  is_active: column('is_active', 'bool').defaultTo(true), // For revocation
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
}).unique('api_keys_subject_name_uk', ['subject_id', 'name']); // Fast lookups by subject

// Optional usage tracking table for audit logging
export const apiKeyUsage = table('api_key_usage', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  api_key_id: column('api_key_id', 'varchar(255)'),
  endpoint: column('endpoint', 'varchar(500)').nullable(),
  ip_address: column('ip_address', 'varchar(45)').nullable(), // IPv4/IPv6
  user_agent: column('user_agent', 'varchar(1000)').nullable(),
  success: column('success', 'bool').defaultTo(true),
  error_message: column('error_message', 'varchar(500)').nullable(),
  used_at: column('used_at', 'timestamp').defaultTo$('now'),
});

export const apiKeySchemaV2: ReauthSchemaPlugin = {
  tables: {
    api_keys: apiKeys,
    api_key_usage: apiKeyUsage,
  },
  relations: {},
};
