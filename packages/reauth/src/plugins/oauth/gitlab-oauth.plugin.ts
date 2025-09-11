import * as arctic from 'arctic';
import {
  createOAuthPlugin,
  BaseOAuthConfig,
} from './utils/oauth-plugin-factory';

/**
 * GitLab OAuth configuration
 */
export interface GitLabOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional GitLab-specific scopes (optional)
   * Default scopes: 'read_user', 'read_api'
   */
  scopes?: string[];
  /**
   * GitLab instance URL (default: https://gitlab.com)
   * For self-hosted GitLab instances
   */
  baseUrl?: string;
}

/**
 * Create GitLab OAuth plugin
 * Supports both GitLab.com and self-hosted GitLab instances
 */
export const gitlabOAuthPlugin = createOAuthPlugin<GitLabOAuthConfig>(
  'GitLab',
  'regular',
  (config: GitLabOAuthConfig) =>
    new arctic.GitLab(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
      config.baseUrl || 'https://gitlab.com',
    ),
  ['read_user', 'read_api'], // Default scopes
);

export default gitlabOAuthPlugin;

// Export schema for validation
export const gitlabOAuthSchema = {
  clientId: 'string',
  clientSecret: 'string',
  redirectUri: 'string',
  scopes: 'string[]?',
  baseUrl: 'string?',
} as const;