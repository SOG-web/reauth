import { column, idColumn, table } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../types';

// Magic links for passwordless authentication
export const magicLinks = table('magic_links', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  subject_id: column('subject_id', 'varchar(255)'),
  token_hash: column('token_hash', 'varchar(255)'),
  email: column('email', 'varchar(255)'),
  expires_at: column('expires_at', 'timestamp'),
  used_at: column('used_at', 'timestamp').nullable(),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  metadata: column('metadata', 'json').nullable(),
});

// WebAuthn credentials for passwordless authentication
export const webauthnCredentials = table('webauthn_credentials', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  subject_id: column('subject_id', 'varchar(255)'),
  credential_id: column('credential_id', 'varchar(255)'),
  public_key: column('public_key', 'varchar(2048)'),
  counter: column('counter', 'bigint').defaultTo(BigInt(0)),
  transports: column('transports', 'json').nullable(),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  last_used_at: column('last_used_at', 'timestamp').nullable(),
  name: column('name', 'varchar(255)').nullable(),
  is_active: column('is_active', 'bool').defaultTo(true),
});

export const passwordlessSchema: ReauthSchemaPlugin = {
  tables: {
    magic_links: magicLinks,
    webauthn_credentials: webauthnCredentials,
  },
  relations: {},
};
