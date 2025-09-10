import { column, idColumn, table } from 'fumadb/schema';

// V2 sessions table uses subject_type + subject_id instead of entity_id
export const sessionsV2 = table('sessions', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  subject_type: column('subject_type', 'varchar(255)'),
  subject_id: column('subject_id', 'varchar(255)'),
  token: column('token', 'varchar(255)'),
  expires_at: column('expires_at', 'timestamp').nullable(),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
}).unique('sessions_token_uk', ['token']);
