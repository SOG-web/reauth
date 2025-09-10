import { fumadb } from 'fumadb';
import type { ReauthSchemaPlugin } from '../types';
import buildSchemaV2 from './base.schema.v2';

/**
 * Create a FumaDB factory for ReAuth V2 schema.
 * Consumers should create a client with their adapter:
 *
 *   const factory = reauthDbV2([pluginSchemaA, pluginSchemaB])
 *   const client = factory.client(kyselyAdapter({ provider: 'postgres', db }))
 */
export const reauthDbV2 = (plugins: ReauthSchemaPlugin[] = []) => {
  const v2 = buildSchemaV2(plugins);
  return fumadb({
    namespace: 'reauth',
    schemas: [v2],
  });
};
