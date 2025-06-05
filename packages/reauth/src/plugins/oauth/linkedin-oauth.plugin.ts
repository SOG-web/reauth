import * as arctic from 'arctic';
import { createOAuthPlugin, BaseOAuthConfig } from './utils/oauth-plugin-factory';

/**
 * LinkedIn OAuth configuration
 */
export interface LinkedInOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional LinkedIn-specific scopes (optional)
   * Default scopes: 'openid', 'profile', 'email'
   */
  scopes?: string[];
}

/**
 * Create LinkedIn OAuth plugin
 * LinkedIn uses regular OAuth 2.0 flow (not PKCE)
 */
export const linkedinOAuthPlugin = createOAuthPlugin<LinkedInOAuthConfig>(
  'LinkedIn',
  'regular',
  (config: LinkedInOAuthConfig) => 
    new arctic.LinkedIn(config.clientId, config.clientSecret, config.redirectUri),
  ['openid', 'profile', 'email'], // Default scopes
);

export default linkedinOAuthPlugin; 