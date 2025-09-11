import * as arctic from 'arctic';
import {
  createOAuthPlugin,
  BaseOAuthConfig,
} from './utils/oauth-plugin-factory';

/**
 * Bitbucket OAuth configuration
 */
export interface BitbucketOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional Bitbucket-specific scopes (optional)
   * Default scopes: 'account', 'email'
   */
  scopes?: string[];
}

/**
 * Create Bitbucket OAuth plugin
 * Supports Bitbucket Cloud OAuth with repository and account access
 */
export const bitbucketOAuthPlugin = createOAuthPlugin<BitbucketOAuthConfig>(
  'Bitbucket',
  'regular',
  (config: BitbucketOAuthConfig) =>
    new arctic.Bitbucket(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    ),
  ['account', 'email'], // Default scopes
);

export default bitbucketOAuthPlugin;

// Export schema for validation
export const bitbucketOAuthSchema = {
  clientId: 'string',
  clientSecret: 'string',
  redirectUri: 'string',
  scopes: 'string[]?',
} as const;