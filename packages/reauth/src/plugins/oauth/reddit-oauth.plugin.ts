import * as arctic from 'arctic';
import {
  createOAuthPlugin,
  BaseOAuthConfig,
} from './utils/oauth-plugin-factory';
import { column } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../types';

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
    new arctic.Reddit(config.clientId, config.clientSecret, config.redirectUri),
  ['identity'], // Default scopes
);

export default redditOAuthPlugin;

export const redditOAuthSchema: ReauthSchemaPlugin = {
  extendTables: {
    entities: {
      reddit_id: column('reddit_id', 'varchar(255)').nullable().unique(),
      reddit_data: column('reddit_data', 'json').nullable(),
    },
  },
};
