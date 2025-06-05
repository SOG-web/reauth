import * as arctic from 'arctic';
import { createOAuthPlugin, BaseOAuthConfig } from './utils/oauth-plugin-factory';

/**
 * Twitch OAuth configuration
 */
export interface TwitchOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional Twitch-specific scopes (optional)
   * Default scopes: 'user:read:email'
   */
  scopes?: string[];
}

/**
 * Create Twitch OAuth plugin
 * Twitch uses regular OAuth flow
 */
export const twitchOAuthPlugin = createOAuthPlugin<TwitchOAuthConfig>(
  'Twitch',
  'regular', // Twitch uses regular OAuth
  (config: TwitchOAuthConfig) => 
    new arctic.Twitch(
      config.clientId, 
      config.clientSecret, 
      config.redirectUri
    ),
  ['user:read:email'], // Default scopes
);

export default twitchOAuthPlugin; 