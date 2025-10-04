import * as arctic from 'arctic';
import { createOAuthProvider } from '../utils';
import type { BaseOAuthConfig } from '../types';

/**
 * Microsoft OAuth configuration
 */
export interface MicrosoftOAuthConfig extends BaseOAuthConfig {
  /**
   * Microsoft tenant ID (default: 'common' for multi-tenant)
   */
  tenantId?: string;
  /**
   * Additional Microsoft-specific scopes (optional)
   * Default scopes: 'openid', 'profile', 'email', 'User.Read'
   */
  scopes?: string[];
}

/**
 * Microsoft OAuth provider
 * Microsoft uses PKCE flow with Entra ID
 */
export const microsoftOAuthProvider = createOAuthProvider<MicrosoftOAuthConfig>(
  'microsoft',
  'pkce',
  (config: MicrosoftOAuthConfig) =>
    new arctic.MicrosoftEntraId(
      config.tenantId || 'common',
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    ),
  ['openid', 'profile', 'email', 'User.Read'],
  {} as MicrosoftOAuthConfig, // Will be overridden by user config
);

export default microsoftOAuthProvider;
