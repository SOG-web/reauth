import * as arctic from 'arctic';
import { createOAuthProvider } from '../utils';
import type { BaseOAuthConfig } from '../types';

/**
 * Twitter/X OAuth configuration
 */
export interface TwitterOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional Twitter/X-specific scopes (optional)
   * Default scopes: 'users.read', 'tweet.read'
   */
  scopes?: string[];
}

/**
 * Twitter/X OAuth provider
 */
export const twitterOAuthProvider = createOAuthProvider<TwitterOAuthConfig>(
  'twitter',
  'pkce',
  (config: TwitterOAuthConfig) =>
    new arctic.Twitter(config.clientId, config.clientSecret, config.redirectUri),
  ['users.read', 'tweet.read'],
  {} as TwitterOAuthConfig, // Will be overridden by user config
);

export default twitterOAuthProvider;
