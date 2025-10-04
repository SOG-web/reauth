import * as arctic from 'arctic';
import { createOAuthProvider } from '../utils';
import type { BaseOAuthConfig } from '../types';

/**
 * Facebook OAuth configuration
 */
export interface FacebookOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional Facebook-specific scopes (optional)
   * Default scopes: 'email', 'public_profile'
   */
  scopes?: string[];
}

/**
 * Facebook OAuth provider
 */
export const facebookOAuthProvider = createOAuthProvider<FacebookOAuthConfig>(
  'facebook',
  'regular',
  (config: FacebookOAuthConfig) =>
    new arctic.Facebook(config.clientId, config.clientSecret, config.redirectUri),
  ['email', 'public_profile'],
  {} as FacebookOAuthConfig, // Will be overridden by user config
);

export default facebookOAuthProvider;
