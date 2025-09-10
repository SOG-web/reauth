import { column, idColumn, table } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../../types';

// Anonymous session metadata and tracking
export const anonymousSessions = table('anonymous_sessions', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  subject_id: column('subject_id', 'varchar(255)'),
  fingerprint: column('fingerprint', 'varchar(255)'), // browser/device identifier
  metadata: column('metadata', 'json').nullable(), // JSON for temporary data storage
  extension_count: column('extension_count', 'integer').defaultTo$(() => 0),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  expires_at: column('expires_at', 'timestamp'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
})
  .unique('anonymous_session_uk', ['subject_id']);

export const anonymousSchemaV2: ReauthSchemaPlugin = {
  tables: {
    anonymous_sessions: anonymousSessions,
  },
  relations: {},
};