import * as arctic from 'arctic';
import { createOAuthProvider } from '../utils';
import type { BaseOAuthConfig } from '../types';

/**
 * Apple OAuth configuration
 */
export interface AppleOAuthConfig extends BaseOAuthConfig {
  /**
   * Apple team ID (required for Apple Sign In)
   */
  teamId: string;
  /**
   * Apple private key ID (required for Apple Sign In)
   */
  keyId: string;
  /**
   * Apple private key (required for Apple Sign In)
   */
  privateKey: string;
  /**
   * Additional Apple-specific scopes (optional)
   * Default scopes: 'name', 'email'
   */
  scopes?: string[];
}

/**
 * Apple OAuth provider
 */
export const appleOAuthProvider = createOAuthProvider<AppleOAuthConfig>(
  'apple',
  'pkce',
  (config: AppleOAuthConfig) =>
    new arctic.Apple({
      clientId: config.clientId,
      teamId: config.teamId,
      keyId: config.keyId,
      certificate: config.privateKey,
      redirectUri: config.redirectUri,
    }),
  ['name', 'email'],
  {} as AppleOAuthConfig, // Will be overridden by user config
);

export default appleOAuthProvider;
