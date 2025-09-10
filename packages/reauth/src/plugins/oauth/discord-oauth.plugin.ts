import * as arctic from 'arctic';
import {
  createOAuthPlugin,
  BaseOAuthConfig,
} from './utils/oauth-plugin-factory';
import { column } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../types';

/**
 * Discord OAuth configuration
 */
export interface DiscordOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional Discord-specific scopes (optional)
   * Default scopes: 'identify', 'email'
   */
  scopes?: string[];
  /**
   * Whether to use PKCE flow (default: false for confidential clients)
   * Set to true for public clients (clientSecret should be null)
   */
  usePKCE?: boolean;
}

/**
 * Create Discord OAuth plugin
 * Discord supports both regular and PKCE flows
 */
export const discordOAuthPlugin = createOAuthPlugin<DiscordOAuthConfig>(
  'discord',
  'pkce', // Discord supports PKCE
  (config: DiscordOAuthConfig) =>
    new arctic.Discord(
      config.clientId,
      config.usePKCE ? null : config.clientSecret,
      config.redirectUri,
    ),
  ['identify', 'email'], // Default scopes
);

export default discordOAuthPlugin;

export const discordOAuthSchema: ReauthSchemaPlugin = {
  extendTables: {
    entities: {
      discord_id: column('discord_id', 'varchar(255)').nullable().unique(),
      discord_data: column('discord_data', 'json').nullable(),
    },
  },
};
