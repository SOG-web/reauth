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

// Verification codes for passwordless authentication (phone, email, whatsapp)
export const verificationCodes = table('verification_codes', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  subject_id: column('subject_id', 'varchar(255)').nullable(), // null for new users
  code_hash: column('code_hash', 'varchar(255)'),
  destination: column('destination', 'varchar(255)'), // phone, email, or whatsapp
  destination_type: column('destination_type', 'varchar(50)'), // 'phone', 'email', 'whatsapp'
  purpose: column('purpose', 'varchar(50)'), // 'login', 'register', 'verify'
  expires_at: column('expires_at', 'timestamp'),
  used_at: column('used_at', 'timestamp').nullable(),
  attempts: column('attempts', 'integer').defaultTo(0),
  max_attempts: column('max_attempts', 'integer').defaultTo(3),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  metadata: column('metadata', 'json').nullable(),
});

export const passwordlessSchema: ReauthSchemaPlugin = {
  tables: {
    magic_links: magicLinks,
    webauthn_credentials: webauthnCredentials,
    verification_codes: verificationCodes,
  },
  relations: {},
};
