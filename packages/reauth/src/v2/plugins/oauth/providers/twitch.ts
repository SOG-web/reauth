import { createOAuthPlugin } from '../plugin.v2';
import type { OAuthConfigV2, OAuthProviderConfig } from '../types';

/**
 * Twitch OAuth provider configuration
 */
export interface TwitchOAuthConfig extends Omit<OAuthConfigV2, 'providers'> {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

/**
 * Create Twitch OAuth plugin
 * 
 * @example
 * ```typescript
 * const twitchOAuth = createTwitchOAuthPlugin({
 *   clientId: process.env.TWITCH_CLIENT_ID!,
 *   clientSecret: process.env.TWITCH_CLIENT_SECRET!,
 *   redirectUri: 'http://localhost:3000/auth/oauth/callback',
 *   scopes: ['user:read:email'],
 * });
 * ```
 */
export function createTwitchOAuthPlugin(config: TwitchOAuthConfig) {
  const twitchProvider: OAuthProviderConfig = {
    name: 'twitch',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: 'https://id.twitch.tv/oauth2/authorize',
    tokenUrl: 'https://id.twitch.tv/oauth2/token',
    userInfoUrl: 'https://api.twitch.tv/helix/users',
    scopes: config.scopes || ['user:read:email'],
    redirectUri: config.redirectUri,
    isActive: true,
  };

  return createOAuthPlugin({
    config: {
      ...config,
      providers: [twitchProvider],
    },
  });
}

export default createTwitchOAuthPlugin;