import { createOAuthPlugin } from '../plugin.v2';
import type { OAuthConfigV2, OAuthProviderConfig } from '../types';

/**
 * Spotify OAuth provider configuration
 */
export interface SpotifyOAuthConfig extends Omit<OAuthConfigV2, 'providers'> {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

/**
 * Create Spotify OAuth plugin
 * 
 * @example
 * ```typescript
 * const spotifyOAuth = createSpotifyOAuthPlugin({
 *   clientId: process.env.SPOTIFY_CLIENT_ID!,
 *   clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
 *   redirectUri: 'http://localhost:3000/auth/oauth/callback',
 *   scopes: ['user-read-email', 'user-read-private'],
 * });
 * ```
 */
export function createSpotifyOAuthPlugin(config: SpotifyOAuthConfig) {
  const spotifyProvider: OAuthProviderConfig = {
    name: 'spotify',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    userInfoUrl: 'https://api.spotify.com/v1/me',
    scopes: config.scopes || ['user-read-email', 'user-read-private'],
    redirectUri: config.redirectUri,
    isActive: true,
  };

  return createOAuthPlugin({
    config: {
      ...config,
      providers: [spotifyProvider],
    },
  });
}

export default createSpotifyOAuthPlugin;