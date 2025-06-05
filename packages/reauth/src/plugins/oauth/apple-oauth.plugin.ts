import * as arctic from 'arctic';
import { createOAuthPlugin, BaseOAuthConfig } from './utils/oauth-plugin-factory';

/**
 * Apple OAuth configuration
 */
export interface AppleOAuthConfig extends BaseOAuthConfig {
  /**
   * Apple Team ID
   */
  teamId: string;
  /**
   * Apple Key ID
   */
  keyId: string;
  /**
   * Apple private key as Uint8Array (PKCS#8 format)
   * You can convert PEM string to Uint8Array using: 
   * new TextEncoder().encode(pemString.replace(/-----BEGIN PRIVATE KEY-----\n?/, '').replace(/\n?-----END PRIVATE KEY-----/, '').replace(/\n/g, ''))
   */
  privateKey: Uint8Array;
  /**
   * Additional Apple-specific scopes (optional)
   * Default scopes: 'name', 'email'
   */
  scopes?: string[];
}

/**
 * Create Apple OAuth plugin
 * Apple uses regular OAuth flow
 */
export const appleOAuthPlugin = createOAuthPlugin<AppleOAuthConfig>(
  'Apple',
  'regular', // Apple uses regular OAuth
  (config: AppleOAuthConfig) => 
    new arctic.Apple(
      config.clientId, 
      config.teamId,
      config.keyId,
      config.privateKey,
      config.redirectUri
    ),
  ['name', 'email'], // Default scopes
);

export default appleOAuthPlugin; 