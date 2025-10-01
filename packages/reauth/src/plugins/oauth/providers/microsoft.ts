import * as arctic from 'arctic';
import { createOAuthProvider } from '../utils';
import type { BaseOAuthConfig } from '../types';

/**
 * Microsoft OAuth configuration
 */
export interface MicrosoftOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional Microsoft-specific scopes (optional)
   * Default scopes: 'openid', 'profile', 'email'
   */
  scopes?: string[];
}

/**
 * Microsoft OAuth provider
 */
export const microsoftOAuthProvider = createOAuthProvider<MicrosoftOAuthConfig>(
  'microsoft',
  'pkce',
  (config: MicrosoftOAuthConfig) =>
    new arctic.Microsoft(config.clientId, config.clientSecret, config.redirectUri),
  ['openid', 'profile', 'https://graph.microsoft.com/User.Read'],
  {} as MicrosoftOAuthConfig, // Will be overridden by user config
);

export default microsoftOAuthProvider;
