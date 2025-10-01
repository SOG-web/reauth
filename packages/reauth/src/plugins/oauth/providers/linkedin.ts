import * as arctic from 'arctic';
import { createOAuthProvider } from '../utils';
import type { BaseOAuthConfig } from '../types';

/**
 * LinkedIn OAuth configuration
 */
export interface LinkedInOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional LinkedIn-specific scopes (optional)
   * Default scopes: 'openid', 'profile', 'email'
   */
  scopes?: string[];
}

/**
 * LinkedIn OAuth provider
 */
export const linkedinOAuthProvider = createOAuthProvider<LinkedInOAuthConfig>(
  'linkedin',
  'pkce',
  (config: LinkedInOAuthConfig) =>
    new arctic.LinkedIn(config.clientId, config.clientSecret, config.redirectUri),
  ['openid', 'profile', 'email'],
  {} as LinkedInOAuthConfig, // Will be overridden by user config
);

export default linkedinOAuthProvider;
