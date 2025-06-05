import * as arctic from 'arctic';
import { createOAuthPlugin, BaseOAuthConfig } from './utils/oauth-plugin-factory';

/**
 * GitHub OAuth configuration
 */
export interface GitHubOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional GitHub-specific scopes (optional)
   * Default scopes: 'user:email', 'read:user'
   */
  scopes?: string[];
}

/**
 * Create GitHub OAuth plugin
 * GitHub uses regular OAuth 2.0 flow (not PKCE)
 */
export const githubOAuthPlugin = createOAuthPlugin<GitHubOAuthConfig>(
  'GitHub',
  'regular',
  (config: GitHubOAuthConfig) => 
    new arctic.GitHub(config.clientId, config.clientSecret, config.redirectUri),
  ['user:email', 'read:user'], // Default scopes
);

export default githubOAuthPlugin; 