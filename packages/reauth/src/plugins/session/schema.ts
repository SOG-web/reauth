import { column, idColumn, table } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../types';

// Extended session device tracking table
export const sessionDevices = table('session_devices', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  session_id: column('session_id', 'varchar(255)'),
  device_info: column('device_info', 'json'),
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
export const sessionPluginTables = [sessionDevices, sessionMetadata];

export const sessionSchema: ReauthSchemaPlugin = {
  tables: {
    session_devices: sessionDevices,
    session_metadata: sessionMetadata,
  },
  relations: {},
};
