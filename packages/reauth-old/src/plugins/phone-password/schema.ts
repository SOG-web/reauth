import { column } from 'fumadb/schema';
import { ReauthSchemaPlugin } from '../../types';

export const phonePasswordSchema: ReauthSchemaPlugin = {
  extendTables: {
    entities: {
      phone: column('phone', 'varchar(255)').nullable().unique(),
      phone_verified: column('phone_verified', 'bool').nullable(),
      phone_verification_code: column(
        'phone_verification_code',
        'varchar(255)',
      ).nullable(),
      phone_verification_code_expires_at: column(
        'phone_verification_code_expires_at',
        'timestamp',
      ).nullable(),
    },
  },
};
