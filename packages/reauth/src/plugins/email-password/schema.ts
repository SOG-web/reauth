import { column } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../types';

export const emailPasswordSchema: ReauthSchemaPlugin = {
  extendTables: {
    entities: {
      email: column('email', 'varchar(255)').unique(),
      email_verified: column('email_verified', 'bool').nullable(),
      password_hash: column('password_hash', 'varchar(255)').nullable(),
      email_verification_code: column(
        'email_verification_code',
        'varchar(255)',
      ).nullable(),
      reset_password_code: column(
        'reset_password_code',
        'varchar(255)',
      ).nullable(),
      reset_password_code_expires_at: column(
        'reset_password_code_expires_at',
        'timestamp',
      ).nullable(),
    },
  },
};

export default emailPasswordSchema;
