import { column, idColumn, table } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../types';

/**
 * OAuth identities table
 * Stores OAuth-specific data linked to identities
 */
const oauthIdentities = table('oauth_identities', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  identity_id: column('identity_id', 'varchar(255)'),
  provider: column('provider', 'varchar(100)'), // 'google', 'github', etc.
  provider_user_id: column('provider_user_id', 'varchar(255)'),
  access_token: column('access_token', 'varchar(1000)').nullable(),
  refresh_token: column('refresh_token', 'varchar(1000)').nullable(),
  token_expires_at: column('token_expires_at', 'timestamp').nullable(),
  scopes: column('scopes', 'json').nullable(), // Array of granted scopes
  provider_data: column('provider_data', 'json').nullable(), // Raw OAuth user data
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
}).unique('oauth_identity_provider_user_uk', ['provider', 'provider_user_id']);

export const oauthSchema: ReauthSchemaPlugin = {
  tables: {
    oauth_identities: oauthIdentities,
  },
  relations: {},
};

export default oauthSchema;
