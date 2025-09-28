import { column, idColumn, table } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../types';

const admins = table('admins', {
  id: idColumn('id', 'uuid').defaultTo$('uuid'),
  entity_id: column('entity_id', 'uuid').unique(),
  permissions: column('permissions', 'varchar(255)'),
  roles: column('roles', 'varchar(255)'),
});

export const adminSchema: ReauthSchemaPlugin = {
  tables: { admins },
  extendTables: {
    entities: {
      banned: column('banned', 'bool').defaultTo(false),
      ban_reason: column('ban_reason', 'text').nullable(),
      banned_at: column('banned_at', 'timestamp').nullable(),
      banned_by: column('banned_by', 'uuid').nullable(),
    },
  },
};

export default adminSchema;
