import { createOAuthPlugin } from '../plugin.v2';
import type { OAuthConfigV2, OAuthProviderConfig } from '../types';

/**
 * Reddit OAuth provider configuration
 */
export interface RedditOAuthConfig extends Omit<OAuthConfigV2, 'providers'> {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

/**
 * Create Reddit OAuth plugin
 * 
 * @example
 * ```typescript
 * const redditOAuth = createRedditOAuthPlugin({
 *   clientId: process.env.REDDIT_CLIENT_ID!,
 *   clientSecret: process.env.REDDIT_CLIENT_SECRET!,
 *   redirectUri: 'http://localhost:3000/auth/oauth/callback',
 *   scopes: ['identity'],
 * });
 * ```
 */
export function createRedditOAuthPlugin(config: RedditOAuthConfig) {
  const redditProvider: OAuthProviderConfig = {
    name: 'reddit',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: 'https://www.reddit.com/api/v1/authorize',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    userInfoUrl: 'https://oauth.reddit.com/api/v1/me',
    scopes: config.scopes || ['identity'],
    redirectUri: config.redirectUri,
    isActive: true,
  };

  return createOAuthPlugin({
    config: {
      ...config,
      providers: [redditProvider],
    },
  });
}

export default createRedditOAuthPlugin;