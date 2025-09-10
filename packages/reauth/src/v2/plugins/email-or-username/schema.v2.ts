import { emailPasswordSchemaV2 } from '../email-password/schema.v2';
import { usernamePasswordSchemaV2 } from '../username/schema.v2';
import type { ReauthSchemaPlugin } from '../../../types';

/**
 * Email-or-username plugin schema.
 * 
 * This plugin doesn't define its own tables - it delegates to the underlying
 * email-password and username plugins. The schema combines both underlying
 * schemas to ensure all necessary tables are available.
 */
export const emailOrUsernameSchemaV2: ReauthSchemaPlugin = {
  tables: {
    // Include tables from email-password plugin
    ...emailPasswordSchemaV2.tables,
    // Include tables from username plugin  
    ...usernamePasswordSchemaV2.tables,
  },
  relations: {
    // Include relations from both plugins
    ...emailPasswordSchemaV2.relations,
    ...usernamePasswordSchemaV2.relations,
  },
};

export default emailOrUsernameSchemaV2;