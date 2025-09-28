import { createOAuthPlugin } from '../plugin.v2';
import type { OAuthConfigV2, OAuthProviderConfig } from '../types';

/**
 * Twitter/X OAuth provider configuration
 */
export interface TwitterOAuthConfig extends Omit<OAuthConfigV2, 'providers'> {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

/**
 * Create Twitter OAuth plugin
 * 
 * @example
 * ```typescript
 * const twitterOAuth = createTwitterOAuthPlugin({
 *   clientId: process.env.TWITTER_CLIENT_ID!,
 *   clientSecret: process.env.TWITTER_CLIENT_SECRET!,
 *   redirectUri: 'http://localhost:3000/auth/oauth/callback',
 *   scopes: ['users.read', 'tweet.read'],
 * });
 * ```
 */
export function createTwitterOAuthPlugin(config: TwitterOAuthConfig) {
  const twitterProvider: OAuthProviderConfig = {
    name: 'twitter',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userInfoUrl: 'https://api.twitter.com/2/users/me',
    scopes: config.scopes || ['users.read', 'tweet.read'],
    redirectUri: config.redirectUri,
    isActive: true,
  };

  return createOAuthPlugin({
    config: {
      ...config,
      providers: [twitterProvider],
    },
  });
}

export default createTwitterOAuthPlugin;