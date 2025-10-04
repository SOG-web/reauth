import * as arctic from 'arctic';
import { createOAuthProvider } from '../utils';
import type { BaseOAuthConfig } from '../types';

/**
 * Google OAuth configuration
 */
export interface GoogleOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional Google-specific scopes (optional)
   * Default scopes: 'openid', 'email', 'profile'
   */
  scopes?: string[];
}

/**
 * Google OAuth provider
 */
export const googleOAuthProvider = createOAuthProvider<GoogleOAuthConfig>(
  'google',
  'pkce',
  (config: GoogleOAuthConfig) =>
    new arctic.Google(config.clientId, config.clientSecret, config.redirectUri),
  ['openid', 'email', 'profile'],
  {} as GoogleOAuthConfig, // Will be overridden by user config
);

export default googleOAuthProvider;
