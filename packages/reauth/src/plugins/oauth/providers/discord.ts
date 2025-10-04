import * as arctic from 'arctic';
import { createOAuthProvider } from '../utils';
import type { BaseOAuthConfig } from '../types';

/**
 * Discord OAuth configuration
 */
export interface DiscordOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional Discord-specific scopes (optional)
   * Default scopes: 'identify', 'email'
   */
  scopes?: string[];
}

/**
 * Discord OAuth provider
 */
export const discordOAuthProvider = createOAuthProvider<DiscordOAuthConfig>(
  'discord',
  'regular',
  (config: DiscordOAuthConfig) =>
    new arctic.Discord(config.clientId, config.clientSecret, config.redirectUri),
  ['identify', 'email'],
  {} as DiscordOAuthConfig, // Will be overridden by user config
);

export default discordOAuthProvider;
