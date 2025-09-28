import { column } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../types';

export const usernamePasswordSchema: ReauthSchemaPlugin = {
  extendTables: {
    entities: {
      username: column('username', 'varchar(50)').nullable().unique(),
      password_hash: column('password_hash', 'varchar(255)').nullable(),
    },
  },
};

export default usernamePasswordSchema;
