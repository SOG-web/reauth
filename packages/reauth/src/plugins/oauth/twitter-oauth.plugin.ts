import * as arctic from 'arctic';
import {
  createOAuthPlugin,
  BaseOAuthConfig,
} from './utils/oauth-plugin-factory';
import { column } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../types';

/**
 * Twitter/X OAuth configuration
 */
export interface TwitterOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional Twitter-specific scopes (optional)
   * Default scopes: 'tweet.read', 'users.read'
   */
  scopes?: string[];
}

/**
 * Create Twitter/X OAuth plugin
 * Twitter uses regular OAuth flow
 */
export const twitterOAuthPlugin = createOAuthPlugin<TwitterOAuthConfig>(
  'Twitter',
  'regular', // Twitter uses regular OAuth
  (config: TwitterOAuthConfig) =>
    new arctic.Twitter(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    ),
  ['tweet.read', 'users.read'], // Default scopes
);

export default twitterOAuthPlugin;

export const twitterOAuthSchema: ReauthSchemaPlugin = {
  extendTables: {
    entities: {
      twitter_id: column('twitter_id', 'varchar(255)').nullable().unique(),
      twitter_data: column('twitter_data', 'json').nullable(),
    },
  },
};
