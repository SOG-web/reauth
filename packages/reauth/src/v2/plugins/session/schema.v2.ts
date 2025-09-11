import { column, idColumn, table } from 'fumadb/schema';

// Extended session device tracking table
export const sessionDevices = table('session_devices', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  session_id: column('session_id', 'varchar(255)'),
  fingerprint: column('fingerprint', 'varchar(500)').nullable(),
  user_agent: column('user_agent', 'varchar(1000)').nullable(),
  ip_address: column('ip_address', 'varchar(45)').nullable(),
  location: column('location', 'varchar(255)').nullable(),
  first_seen_at: column('first_seen_at', 'timestamp').defaultTo$('now'),
  last_seen_at: column('last_seen_at', 'timestamp').defaultTo$('now'),
  is_trusted: column('is_trusted', 'bool').defaultTo$(() => false),
  device_name: column('device_name', 'varchar(255)').nullable(),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
});

// Session metadata for arbitrary key-value storage
export const sessionMetadata = table('session_metadata', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  session_id: column('session_id', 'varchar(255)'),
  key: column('key', 'varchar(255)'),
  value: column('value', 'json'),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
});

// Export all tables for use in schema migrations
export const sessionPluginTables = [
  sessionDevices,
  sessionMetadata,
];