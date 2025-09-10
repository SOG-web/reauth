import * as arctic from 'arctic';
import {
  createOAuthPlugin,
  BaseOAuthConfig,
} from './utils/oauth-plugin-factory';
import { column } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../types';

/**
 * Google OAuth configuration
 */
export interface GoogleOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional Google-specific scopes (optional)
   * Default scopes: 'openid', 'email', 'profile'
   */
  scopes?: string[];
}

/**
 * Create Google OAuth plugin
 * Google uses PKCE flow
 */
export const googleOAuthPlugin = createOAuthPlugin<GoogleOAuthConfig>(
  'Google',
  'pkce',
  (config: GoogleOAuthConfig) =>
    new arctic.Google(config.clientId, config.clientSecret, config.redirectUri),
  ['openid', 'email', 'profile'], // Default scopes
);

export default googleOAuthPlugin;

export const googleOAuthSchema: ReauthSchemaPlugin = {
  extendTables: {
    entities: {
      google_id: column('google_id', 'varchar(255)').nullable().unique(),
      google_data: column('google_data', 'json').nullable(),
    },
  },
};
