import * as arctic from 'arctic';
import { createOAuthProvider } from '../utils';
import type { BaseOAuthConfig } from '../types';

/**
 * GitHub OAuth configuration
 */
export interface GitHubOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional GitHub-specific scopes (optional)
   * Default scopes: 'user:email'
   */
  scopes?: string[];
}

/**
 * GitHub OAuth provider
 */
export const githubOAuthProvider = createOAuthProvider<GitHubOAuthConfig>(
  'github',
  'regular',
  (config: GitHubOAuthConfig) =>
    new arctic.GitHub(config.clientId, config.clientSecret, config.redirectUri),
  ['user:email'],
  {} as GitHubOAuthConfig, // Will be overridden by user config
);

export default githubOAuthProvider;
