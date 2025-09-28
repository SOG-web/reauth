import { fumadb } from 'fumadb';
import type { ReauthSchemaPlugin } from './types';
import buildSchema from './base.schema';

/**
 * Create a FumaDB factory for ReAuth schema.
 * Consumers should create a client with their adapter:
 *
 *   const factory = reauthDb([pluginSchemaA, pluginSchemaB])
 *   const client = factory.client(kyselyAdapter({ provider: 'postgres', db }))
 */
export const reauthDb = (plugins: ReauthSchemaPlugin[] = []) => {
  const schema = buildSchema(plugins);
  return fumadb({
    namespace: 'reauth',
    schemas: [schema],
  });
};
