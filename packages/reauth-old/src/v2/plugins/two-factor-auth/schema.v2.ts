import { column, idColumn, table } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../../types';

// Two-Factor Authentication Methods
export const twoFactorMethods = table('two_factor_methods', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  user_id: column('user_id', 'varchar(255)'),
  method_type: column('method_type', 'varchar(50)'), // 'totp', 'sms', 'email', 'hardware'
  secret_encrypted: column('secret_encrypted', 'varchar(1000)').nullable(), // Encrypted TOTP secret
  phone_number_encrypted: column('phone_number_encrypted', 'varchar(500)').nullable(), // Encrypted phone for SMS
  email_encrypted: column('email_encrypted', 'varchar(500)').nullable(), // Email for 2FA codes
  is_primary: column('is_primary', 'bool').defaultTo(false),
  is_verified: column('is_verified', 'bool').defaultTo(false),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  verified_at: column('verified_at', 'timestamp').nullable(),
  last_used_at: column('last_used_at', 'timestamp').nullable(),
});

// Two-Factor Authentication Codes (SMS/Email)
export const twoFactorCodes = table('two_factor_codes', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  user_id: column('user_id', 'varchar(255)'),
  method_id: column('method_id', 'varchar(255)').nullable(), // Reference to two_factor_methods
  code_hash: column('code_hash', 'varchar(255)'),
  method_type: column('method_type', 'varchar(50)'),
  expires_at: column('expires_at', 'timestamp'),
  used_at: column('used_at', 'timestamp').nullable(),
  attempts: column('attempts', 'integer').defaultTo(0),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
});

// Backup Codes for Account Recovery
export const twoFactorBackupCodes = table('two_factor_backup_codes', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  user_id: column('user_id', 'varchar(255)'),
  code_hash: column('code_hash', 'varchar(255)'),
  used_at: column('used_at', 'timestamp').nullable(),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
});

// Hardware Security Keys (WebAuthn/FIDO2)
export const twoFactorHardwareTokens = table('two_factor_hardware_tokens', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  user_id: column('user_id', 'varchar(255)'),
  credential_id: column('credential_id', 'varchar(1000)'),
  public_key: column('public_key', 'varchar(2000)'),
  counter: column('counter', 'integer').defaultTo(0),
  name: column('name', 'varchar(255)').nullable(),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  last_used_at: column('last_used_at', 'timestamp').nullable(),
});

// Failed Authentication Attempts for Security Monitoring
export const twoFactorFailedAttempts = table('two_factor_failed_attempts', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  user_id: column('user_id', 'varchar(255)'),
  method_type: column('method_type', 'varchar(50)'),
  ip_address: column('ip_address', 'varchar(45)').nullable(), // Support both IPv4 and IPv6
  user_agent: column('user_agent', 'varchar(2000)').nullable(),
  attempted_at: column('attempted_at', 'timestamp').defaultTo$('now'),
});

// Export all tables as a schema plugin
export const twoFactorAuthSchema: ReauthSchemaPlugin = {
  tables: {
    two_factor_methods: twoFactorMethods,
    two_factor_codes: twoFactorCodes,
    two_factor_backup_codes: twoFactorBackupCodes,
    two_factor_hardware_tokens: twoFactorHardwareTokens,
    two_factor_failed_attempts: twoFactorFailedAttempts,
  },
  relations: {},
};