import { column, idColumn, table } from 'fumadb/schema';

// Extended session device tracking table
export const sessionDevices = table('session_devices', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  session_id: column('session_id', 'varchar(255)'),
  fingerprint: column('fingerprint', 'varchar(500)').nullable(), // device fingerprint hash
  user_agent: column('user_agent', 'varchar(1000)').nullable(),
  ip_address: column('ip_address', 'varchar(45)').nullable(), // IPv4/IPv6
  location: column('location', 'varchar(255)').nullable(), // city, country from IP
  first_seen_at: column('first_seen_at', 'timestamp').defaultTo$('now'),
  last_seen_at: column('last_seen_at', 'timestamp').defaultTo$('now'),
  is_trusted: column('is_trusted', 'bool').defaultTo$(false),
  device_name: column('device_name', 'varchar(255)').nullable(), // user-provided device name
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
})
  .unique('session_devices_session_id_uk', ['session_id'])
  .index('session_devices_fingerprint_idx', ['fingerprint'])
  .index('session_devices_last_seen_idx', ['last_seen_at']);

// Session metadata for arbitrary key-value storage
export const sessionMetadata = table('session_metadata', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  session_id: column('session_id', 'varchar(255)'),
  key: column('key', 'varchar(255)'),
  value: column('value', 'json'), // JSON for flexible data types
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
})
  .unique('session_metadata_session_key_uk', ['session_id', 'key'])
  .index('session_metadata_session_id_idx', ['session_id']);

// Enhanced session table for V2 - extends the base sessions table
export const enhancedSessions = table('enhanced_sessions', {
  session_id: column('session_id', 'varchar(255)'),
  rotation_count: column('rotation_count', 'integer').defaultTo$(0),
  last_rotated_at: column('last_rotated_at', 'timestamp').nullable(),
  max_concurrent_reached: column('max_concurrent_reached', 'bool').defaultTo$(false),
  security_flags: column('security_flags', 'json').nullable(), // for additional security metadata
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
})
  .unique('enhanced_sessions_session_id_pk', ['session_id'])
  .index('enhanced_sessions_last_rotated_idx', ['last_rotated_at']);

// Export all tables for use in schema migrations
export const sessionPluginTables = [
  sessionDevices,
  sessionMetadata,
  enhancedSessions,
];