import * as arctic from 'arctic';
import {
  createOAuthPlugin,
  BaseOAuthConfig,
} from './utils/oauth-plugin-factory';

/**
 * Dropbox OAuth configuration
 */
export interface DropboxOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional Dropbox-specific scopes (optional)
   * Default scopes: 'account_info.read'
   */
  scopes?: string[];
  /**
   * Whether to use PKCE flow (default: false for confidential clients)
   * Set to true for public clients (clientSecret should be null)
   */
  usePKCE?: boolean;
}

/**
 * Create Dropbox OAuth plugin
 * Supports Dropbox OAuth with file access and account information
 */
export const dropboxOAuthPlugin = createOAuthPlugin<DropboxOAuthConfig>(
  'Dropbox',
  'regular',
  (config: DropboxOAuthConfig) =>
    new arctic.Dropbox(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    ),
  ['account_info.read'], // Default scopes
);

export default dropboxOAuthPlugin;

// Export schema for validation
export const dropboxOAuthSchema = {
  clientId: 'string',
  clientSecret: 'string',
  redirectUri: 'string',
  scopes: 'string[]?',
  usePKCE: 'boolean?',
} as const;