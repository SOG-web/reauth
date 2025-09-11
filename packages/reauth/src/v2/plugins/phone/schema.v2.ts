import { column, idColumn, table } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../../types';

// Phone-specific metadata attached to an identity via identity_id
export const phoneIdentities = table('phone_identities', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  identity_id: column('identity_id', 'varchar(255)'),
  verification_code: column('verification_code', 'varchar(255)').nullable(),
  verification_code_expires_at: column(
    'verification_code_expires_at',
    'timestamp',
  ).nullable(),
  reset_code: column('reset_code', 'varchar(255)').nullable(),
  reset_code_expires_at: column(
    'reset_code_expires_at',
    'timestamp',
  ).nullable(),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
}).unique('phone_identity_uk', ['identity_id']);

export const phonePasswordSchemaV2: ReauthSchemaPlugin = {
  tables: {
    phone_identities: phoneIdentities,
  },
  relations: {},
};
