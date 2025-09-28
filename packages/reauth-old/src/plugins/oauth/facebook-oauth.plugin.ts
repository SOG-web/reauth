import * as arctic from 'arctic';
import {
  createOAuthPlugin,
  BaseOAuthConfig,
} from './utils/oauth-plugin-factory';
import { column } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../types';

/**
 * Facebook OAuth configuration
 */
export interface FacebookOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional Facebook-specific scopes (optional)
   * Default scopes: 'email', 'public_profile'
   */
  scopes?: string[];
}

/**
 * Create Facebook OAuth plugin
 * Facebook uses regular OAuth 2.0 flow (not PKCE)
 */
export const facebookOAuthPlugin = createOAuthPlugin<FacebookOAuthConfig>(
  'facebook',
  'regular',
  (config: FacebookOAuthConfig) =>
    new arctic.Facebook(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    ),
  ['email', 'public_profile'], // Default scopes
);

export default facebookOAuthPlugin;

export const facebookOAuthSchema: ReauthSchemaPlugin = {
  extendTables: {
    entities: {
      facebook_id: column('facebook_id', 'varchar(255)').nullable().unique(),
      facebook_data: column('facebook_data', 'json').nullable(),
    },
  },
};
