import { createOAuthPlugin } from '../plugin.v2';
import type { OAuthConfigV2, OAuthProviderConfig } from '../types';

/**
 * Discord OAuth provider configuration
 */
export interface DiscordOAuthConfig extends Omit<OAuthConfigV2, 'providers'> {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

/**
 * Create Discord OAuth plugin
 * 
 * @example
 * ```typescript
 * const discordOAuth = createDiscordOAuthPlugin({
 *   clientId: process.env.DISCORD_CLIENT_ID!,
 *   clientSecret: process.env.DISCORD_CLIENT_SECRET!,
 *   redirectUri: 'http://localhost:3000/auth/oauth/callback',
 *   scopes: ['identify', 'email'],
 * });
 * ```
 */
export function createDiscordOAuthPlugin(config: DiscordOAuthConfig) {
  const discordProvider: OAuthProviderConfig = {
    name: 'discord',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userInfoUrl: 'https://discord.com/api/v10/users/@me',
    scopes: config.scopes || ['identify', 'email'],
    redirectUri: config.redirectUri,
    isActive: true,
  };

  return createOAuthPlugin({
    config: {
      ...config,
      providers: [discordProvider],
    },
  });
}

export default createDiscordOAuthPlugin;