import * as arctic from 'arctic';
import { createOAuthProvider } from '../utils';
import type { BaseOAuthConfig } from '../types';

/**
 * Auth0 OAuth configuration
 */
export interface Auth0OAuthConfig extends BaseOAuthConfig {
  /**
   * Auth0 domain (e.g., 'your-domain.auth0.com')
   */
  domain: string;
  /**
   * Additional Auth0-specific scopes (optional)
   * Default scopes: 'openid', 'profile', 'email'
   */
  scopes?: string[];
}

/**
 * Auth0 OAuth provider
 */
export const auth0OAuthProvider = createOAuthProvider<Auth0OAuthConfig>(
  'auth0',
  'pkce',
  (config: Auth0OAuthConfig) =>
    new arctic.Auth0(config.domain, config.clientId, config.clientSecret, config.redirectUri),
  ['openid', 'profile', 'email'],
  {} as Auth0OAuthConfig, // Will be overridden by user config
);

export default auth0OAuthProvider;
