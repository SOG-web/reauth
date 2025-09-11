import { column, idColumn, table } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../../types';

// Username-specific metadata attached to an identity via identity_id
// Note: Minimal schema since username has no verification flow
export const usernameIdentities = table('username_identities', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  identity_id: column('identity_id', 'varchar(255)'),
  // Optional: reset codes if enableResetByUsername is implemented
  reset_code: column('reset_code', 'varchar(255)').nullable(),
  reset_code_expires_at: column(
    'reset_code_expires_at',
    'timestamp',
  ).nullable(),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
}).unique('username_identity_uk', ['identity_id']);

export const usernamePasswordSchemaV2: ReauthSchemaPlugin = {
  tables: {
    username_identities: usernameIdentities,
  },
  relations: {},
};
