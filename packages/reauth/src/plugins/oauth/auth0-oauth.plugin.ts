import * as arctic from 'arctic';
import {
  createOAuthPlugin,
  BaseOAuthConfig,
} from './utils/oauth-plugin-factory';
import { column } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../types';

/**
 * Auth0 OAuth configuration
 */
export interface Auth0OAuthConfig extends BaseOAuthConfig {
  /**
   * Auth0 domain (without protocol, e.g., 'your-domain.auth0.com')
   */
  domain: string;
  /**
   * Additional Auth0-specific scopes (optional)
   * Default scopes: 'openid', 'profile', 'email'
   */
  scopes?: string[];
  /**
   * Whether to use PKCE flow (default: false for confidential clients)
   * Set to true for public clients (clientSecret should be null)
   */
  usePKCE?: boolean;
}

/**
 * Create Auth0 OAuth plugin
 * Auth0 supports both regular and PKCE flows
 */
export const auth0OAuthPlugin = createOAuthPlugin<Auth0OAuthConfig>(
  'authO',
  'pkce', // Auth0 supports PKCE
  (config: Auth0OAuthConfig) =>
    new arctic.Auth0(
      config.domain,
      config.clientId,
      config.usePKCE ? null : config.clientSecret,
      config.redirectUri,
    ),
  ['openid', 'profile', 'email'], // Default scopes
);

export default auth0OAuthPlugin;

export const auth0OAuthSchema: ReauthSchemaPlugin = {
  extendTables: {
    entities: {
      auth0_id: column('auth0_id', 'varchar(255)').nullable().unique(),
      auth0_data: column('auth0_data', 'json').nullable(),
    },
  },
};
