import { column, idColumn, table } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../types';

const organizations = table('organizations', {
  id: idColumn('id', 'uuid').defaultTo$('uuid'),
  name: column('name', 'varchar(255)'),
  description: column('description', 'text').nullable(),
  owner_id: column('owner_id', 'uuid'),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
});

const organization_members = table('organization_members', {
  id: idColumn('id', 'uuid').defaultTo$('uuid'),
  organization_id: column('organization_id', 'uuid'),
  entity_id: column('entity_id', 'uuid'),
  role: column('role', 'varchar(50)').defaultTo('member'),
  permissions: column('permissions', 'json').nullable(),
  teams: column('teams', 'json').nullable(),
  joined_at: column('joined_at', 'timestamp').defaultTo$('now'),
});

export const organizationSchema: ReauthSchemaPlugin = {
  tables: { organizations, organization_members },
};

export default organizationSchema;
