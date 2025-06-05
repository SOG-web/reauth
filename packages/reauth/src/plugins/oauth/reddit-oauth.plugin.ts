import * as arctic from 'arctic';
import { createOAuthPlugin, BaseOAuthConfig } from './utils/oauth-plugin-factory';

/**
 * Reddit OAuth configuration
 */
export interface RedditOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional Reddit-specific scopes (optional)
   * Default scopes: 'identity'
   */
  scopes?: string[];
}

/**
 * Create Reddit OAuth plugin
 * Reddit uses regular OAuth flow
 */
export const redditOAuthPlugin = createOAuthPlugin<RedditOAuthConfig>(
  'Reddit',
  'regular', // Reddit uses regular OAuth
  (config: RedditOAuthConfig) => 
    new arctic.Reddit(
      config.clientId, 
      config.clientSecret, 
      config.redirectUri
    ),
  ['identity'], // Default scopes
);

export default redditOAuthPlugin; 