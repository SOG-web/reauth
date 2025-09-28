import { column } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../types';

export const apiKeySchema: ReauthSchemaPlugin = {
  extendTables: {
    entities: {
      api_keys: column('api_keys', 'json').nullable(),
    },
  },
};

export default apiKeySchema;
