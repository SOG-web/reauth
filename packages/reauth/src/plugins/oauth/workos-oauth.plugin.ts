import * as arctic from 'arctic';
import {
  createOAuthPlugin,
  BaseOAuthConfig,
} from './utils/oauth-plugin-factory';

/**
 * WorkOS OAuth configuration
 */
export interface WorkOSOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional WorkOS-specific scopes (optional)
   * Default scopes: 'openid', 'profile', 'email'
   */
  scopes?: string[];
  /**
   * Whether to use PKCE flow (default: false for confidential clients)
   * Set to true for public clients (clientSecret should be null)
   */
  usePKCE?: boolean;
}

/**
 * Create WorkOS OAuth plugin
 * WorkOS supports both regular and PKCE flows
 */
export const workosOAuthPlugin = createOAuthPlugin<WorkOSOAuthConfig>(
  'WorkOS',
  'pkce', // WorkOS supports PKCE
  (config: WorkOSOAuthConfig) =>
    new arctic.WorkOS(
      config.clientId,
      config.usePKCE ? null : config.clientSecret,
      config.redirectUri,
    ),
  ['openid', 'profile', 'email'], // Default scopes
);

export default workosOAuthPlugin;

// Export schema for validation
export const workosOAuthSchema = {
  clientId: 'string',
  clientSecret: 'string',
  redirectUri: 'string',
  scopes: 'string[]?',
  usePKCE: 'boolean?',
} as const;
