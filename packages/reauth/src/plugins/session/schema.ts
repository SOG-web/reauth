import { column, idColumn, table } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../types';

export const sessionSchema = table('sessions', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  entity_id: column('entity_id', 'varchar(255)'),
  token: column('token', 'varchar(255)'),
  expires_at: column('expires_at', 'timestamp'),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
});

export const sessionRelations = {
  entities: ({ many }) => ({
    sessions: many('sessions'),
  }),
  sessions: ({ one }) => ({
    entity: one('entities', ["entities", "id"]).foreignKey(),
  }),
};

export const sessionSchemaPlugin: ReauthSchemaPlugin = {
  tables: { sessions: sessionSchema },
  relations: sessionRelations,
};
