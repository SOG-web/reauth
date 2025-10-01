import * as arctic from 'arctic';
import { createOAuthProvider } from '../utils';
import type { BaseOAuthConfig } from '../types';

/**
 * Twitch OAuth configuration
 */
export interface TwitchOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional Twitch-specific scopes (optional)
   * Default scopes: 'user:read:email', 'user:read:follows'
   */
  scopes?: string[];
}

/**
 * Twitch OAuth provider
 */
export const twitchOAuthProvider = createOAuthProvider<TwitchOAuthConfig>(
  'twitch',
  'regular',
  (config: TwitchOAuthConfig) =>
    new arctic.Twitch(config.clientId, config.clientSecret, config.redirectUri),
  ['user:read:email', 'user:read:follows'],
  {} as TwitchOAuthConfig, // Will be overridden by user config
);

export default twitchOAuthProvider;
