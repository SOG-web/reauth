import { fumadb } from 'fumadb';
import buildSchema from './base.schema';
import { ReauthSchemaPlugin } from './types';

export const reauthDb = (plugins?: ReauthSchemaPlugin[]) => {
  const schema = buildSchema(plugins);
  return fumadb({
    namespace: 'reauth',
    schemas: [schema],
  });
};
