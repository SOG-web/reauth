import { createOAuthPlugin } from '../plugin.v2';
import type { OAuthConfigV2, OAuthProviderConfig } from '../types';

/**
 * Apple OAuth provider configuration
 */
export interface AppleOAuthConfig extends Omit<OAuthConfigV2, 'providers'> {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string; // PEM-formatted private key
  redirectUri: string;
  scopes?: string[];
}

/**
 * Create Apple OAuth plugin
 * 
 * Note: Apple OAuth requires additional configuration including Team ID, Key ID, and private key.
 * You'll need to configure Apple Sign In service in your Apple Developer account.
 * 
 * @example
 * ```typescript
 * const appleOAuth = createAppleOAuthPlugin({
 *   clientId: process.env.APPLE_CLIENT_ID!,
 *   teamId: process.env.APPLE_TEAM_ID!,
 *   keyId: process.env.APPLE_KEY_ID!,
 *   privateKey: process.env.APPLE_PRIVATE_KEY!,
 *   redirectUri: 'http://localhost:3000/auth/oauth/callback',
 *   scopes: ['name', 'email'],
 * });
 * ```
 */
export function createAppleOAuthPlugin(config: AppleOAuthConfig) {
  const appleProvider: OAuthProviderConfig = {
    name: 'apple',
    clientId: config.clientId,
    clientSecret: config.privateKey, // Store private key in clientSecret field for now
    authorizationUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    userInfoUrl: 'https://appleid.apple.com/auth/userinfo', // Apple doesn't have a standard userinfo endpoint
    scopes: config.scopes || ['name', 'email'],
    redirectUri: config.redirectUri,
    isActive: true,
  };

  return createOAuthPlugin({
    config: {
      ...config,
      providers: [appleProvider],
    },
  });
}

export default createAppleOAuthPlugin;