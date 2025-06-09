import * as arctic from 'arctic';
import {
  createOAuthPlugin,
  BaseOAuthConfig,
} from './utils/oauth-plugin-factory';

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
