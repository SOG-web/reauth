import * as arctic from 'arctic';
import { createOAuthProvider } from '../utils';
import type { BaseOAuthConfig } from '../types';

/**
 * Spotify OAuth configuration
 */
export interface SpotifyOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional Spotify-specific scopes (optional)
   * Default scopes: 'user-read-email', 'user-read-private'
   */
  scopes?: string[];
}

/**
 * Spotify OAuth provider
 */
export const spotifyOAuthProvider = createOAuthProvider<SpotifyOAuthConfig>(
  'spotify',
  'pkce',
  (config: SpotifyOAuthConfig) =>
    new arctic.Spotify(config.clientId, config.clientSecret, config.redirectUri),
  ['user-read-email', 'user-read-private'],
  {} as SpotifyOAuthConfig, // Will be overridden by user config
);

export default spotifyOAuthProvider;
