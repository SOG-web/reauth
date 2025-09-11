import * as arctic from 'arctic';
import {
  createOAuthPlugin,
  BaseOAuthConfig,
} from './utils/oauth-plugin-factory';

/**
 * Slack OAuth configuration
 */
export interface SlackOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional Slack-specific scopes (optional)
   * Default scopes: 'users:read', 'users:read.email'
   */
  scopes?: string[];
  /**
   * Slack team ID (optional)
   * Restricts authentication to a specific Slack workspace
   */
  team?: string;
}

/**
 * Create Slack OAuth plugin
 * Supports Slack workspace authentication with granular permissions
 */
export const slackOAuthPlugin = createOAuthPlugin<SlackOAuthConfig>(
  'Slack',
  'regular',
  (config: SlackOAuthConfig) =>
    new arctic.Slack(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    ),
  ['users:read', 'users:read.email'], // Default scopes
);

export default slackOAuthPlugin;

// Export schema for validation
export const slackOAuthSchema = {
  clientId: 'string',
  clientSecret: 'string',
  redirectUri: 'string',
  scopes: 'string[]?',
  team: 'string?',
} as const;